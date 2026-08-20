-- Problem: approving/fulfilling a product order has no financial effect.
-- product_orders.invoice_id exists but nothing ever populates it, so a
-- member "purchase" never becomes Accounts Receivable, never shows on
-- financial statements, and there's no invoice to record payment against.
--
-- Fix: give admins/treasurers a one-click way to turn an approved (or
-- fulfilled) order into a real, posted invoice for the buying member -
-- reusing the exact same invoice + invoice_lines + GL posting machinery
-- that manual invoices already go through (see 20260819_009_gl_interconnection.sql).
--
-- Follows the same pattern as create_bill_with_lines
-- (20260820_011_atomic_bill_creation.sql): one SECURITY DEFINER function,
-- one transaction, so a failure (e.g. GL Settings not configured) rolls
-- back cleanly instead of leaving a ghost invoice or a half-linked order.

-- ----------------------------------------------------------------------------
-- 1. Add a configurable revenue account for product/shop sales, alongside
--    the existing AR/AP/cash defaults in gl_settings.
-- ----------------------------------------------------------------------------
ALTER TABLE public.gl_settings
  ADD COLUMN IF NOT EXISTS product_sales_account_id int REFERENCES public.accounts(id);

COMMENT ON COLUMN public.gl_settings.product_sales_account_id IS
  'Income account credited when a product order is turned into an invoice (Chart of Accounts > GL Settings).';

-- ----------------------------------------------------------------------------
-- 2. Atomic "invoice this order" function.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_invoice_from_product_order(p_order_id bigint)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order              public.product_orders%ROWTYPE;
  v_item_name          varchar;
  v_sales_account_id   int;
  v_fiscal_year_id     int;
  v_invoice            public.invoices%ROWTYPE;
  v_invoice_no         varchar;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer')) THEN
    RAISE EXCEPTION 'Only admin or treasurer roles can invoice product orders.';
  END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product order not found.';
  END IF;

  IF v_order.invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'Order % has already been invoiced.', v_order.order_no;
  END IF;

  IF v_order.status NOT IN ('approved', 'fulfilled') THEN
    RAISE EXCEPTION 'Only approved or fulfilled orders can be invoiced (order % is %).', v_order.order_no, v_order.status;
  END IF;

  SELECT name INTO v_item_name FROM public.inventory_items WHERE id = v_order.inventory_item_id;

  SELECT product_sales_account_id INTO v_sales_account_id FROM public.gl_settings WHERE id = 1;
  IF v_sales_account_id IS NULL THEN
    RAISE EXCEPTION 'Product Sales Revenue account is not configured. Set it under Chart of Accounts > GL Settings before invoicing orders.';
  END IF;

  -- Prefer the open fiscal year covering today; fall back to the most
  -- recent open one so this still works if year boundaries are a day off.
  SELECT id INTO v_fiscal_year_id FROM public.fiscal_years
  WHERE NOT is_closed AND CURRENT_DATE BETWEEN start_date AND end_date
  ORDER BY start_date DESC LIMIT 1;

  IF v_fiscal_year_id IS NULL THEN
    SELECT id INTO v_fiscal_year_id FROM public.fiscal_years
    WHERE NOT is_closed
    ORDER BY start_date DESC LIMIT 1;
  END IF;

  IF v_fiscal_year_id IS NULL THEN
    RAISE EXCEPTION 'No open fiscal year found. Set one up under Fiscal Years before invoicing orders.';
  END IF;

  v_invoice_no := 'INV-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || floor(random() * 90 + 10)::text;

  INSERT INTO public.invoices (
    invoice_no, member_id, fiscal_year_id, invoice_date, due_date, memo, status
  ) VALUES (
    v_invoice_no, v_order.member_id, v_fiscal_year_id, CURRENT_DATE, CURRENT_DATE,
    'Product order ' || v_order.order_no, 'issued'
  ) RETURNING * INTO v_invoice;

  INSERT INTO public.invoice_lines (invoice_id, description, account_id, quantity, unit_price)
  VALUES (
    v_invoice.id,
    COALESCE(v_item_name, 'Product') || ' (order ' || v_order.order_no || ')',
    v_sales_account_id,
    v_order.quantity,
    v_order.unit_price
  );

  UPDATE public.product_orders SET invoice_id = v_invoice.id WHERE id = p_order_id;

  -- Re-select so the returned row reflects journal_entry_id, which the
  -- invoice_lines insert trigger (trg_invoice_lines_insert_sync) posts
  -- synchronously within this same transaction.
  SELECT * INTO v_invoice FROM public.invoices WHERE id = v_invoice.id;
  RETURN v_invoice;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invoice_from_product_order(bigint) TO authenticated;
