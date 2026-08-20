-- Stock should move the moment a member places an order, not only once a
-- treasurer later marks it "fulfilled". Today a popular item can be
-- oversold: five members can each "buy" the last 2 units before anyone
-- reviews the queue, because fn_fulfil_product_order only touched
-- inventory_items.quantity on the fulfilled transition.
--
-- This migration:
--   1. Deducts quantity from inventory_items the instant a product_orders
--      row is inserted (member places the order), atomically and with a
--      row lock so concurrent buyers can't oversell the same stock.
--   2. Rejects the order outright (RAISE EXCEPTION, so the insert never
--      happens) if there isn't enough stock left — this is what powers the
--      "out of stock" / insufficient-stock messaging in the shop UI.
--   3. Restores quantity automatically if an order is later cancelled,
--      since the stock was already reserved/removed at insert time.
--   4. Removes the old fulfilled-transition deduction, since fulfilling an
--      order no longer needs to touch quantity — it already happened.

-- ----------------------------------------------------------------------------
-- 1 & 2. Deduct stock on order placement (BEFORE INSERT so we can also
--    reject the insert when stock is insufficient).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_deduct_stock_on_order_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_qty numeric(10,2);
  v_new_qty numeric(10,2);
  v_item_name varchar;
BEGIN
  SELECT quantity, name INTO v_old_qty, v_item_name
  FROM public.inventory_items
  WHERE id = NEW.inventory_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  IF v_old_qty <= 0 THEN
    RAISE EXCEPTION '% is out of stock.', v_item_name;
  END IF;

  IF NEW.quantity > v_old_qty THEN
    RAISE EXCEPTION 'Only % unit(s) of % left in stock.', v_old_qty, v_item_name;
  END IF;

  v_new_qty := v_old_qty - NEW.quantity;

  UPDATE public.inventory_items SET quantity = v_new_qty, updated_at = now()
  WHERE id = NEW.inventory_item_id;

  INSERT INTO public.inventory_movements (
    inventory_item_id, movement_type, quantity_changed, old_quantity, new_quantity,
    notes, recorded_by, movement_date
  ) VALUES (
    NEW.inventory_item_id, 'usage', -NEW.quantity, v_old_qty, v_new_qty,
    'Member order ' || NEW.order_no || ' placed', NEW.member_id, CURRENT_DATE
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_stock_on_order_insert ON public.product_orders;
CREATE TRIGGER trg_deduct_stock_on_order_insert
BEFORE INSERT ON public.product_orders
FOR EACH ROW EXECUTE FUNCTION public.fn_deduct_stock_on_order_insert();

GRANT EXECUTE ON FUNCTION public.fn_deduct_stock_on_order_insert() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Restore stock if an order is cancelled after the fact (stock was
--    already removed at insert time, so cancelling must give it back).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_restore_stock_on_order_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_qty numeric(10,2);
  v_new_qty numeric(10,2);
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    SELECT quantity INTO v_old_qty FROM public.inventory_items WHERE id = NEW.inventory_item_id FOR UPDATE;
    v_new_qty := v_old_qty + NEW.quantity;

    UPDATE public.inventory_items SET quantity = v_new_qty, updated_at = now()
    WHERE id = NEW.inventory_item_id;

    INSERT INTO public.inventory_movements (
      inventory_item_id, movement_type, quantity_changed, old_quantity, new_quantity,
      notes, recorded_by, movement_date
    ) VALUES (
      NEW.inventory_item_id, 'usage', NEW.quantity, v_old_qty, v_new_qty,
      'Order ' || NEW.order_no || ' cancelled, stock restored', COALESCE(NEW.decided_by, NEW.member_id), CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock_on_order_cancel ON public.product_orders;
CREATE TRIGGER trg_restore_stock_on_order_cancel
AFTER UPDATE ON public.product_orders
FOR EACH ROW EXECUTE FUNCTION public.fn_restore_stock_on_order_cancel();

GRANT EXECUTE ON FUNCTION public.fn_restore_stock_on_order_cancel() TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Fulfilling an order no longer deducts stock — it was already deducted
--    when the order was placed. Keep the function as a harmless no-op
--    rather than dropping it outright, in case anything still references
--    it, but stop it from double-decrementing quantity.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_fulfil_product_order ON public.product_orders;

CREATE OR REPLACE FUNCTION public.fn_fulfil_product_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stock is now deducted at order-placement time (see
  -- fn_deduct_stock_on_order_insert). Marking an order "fulfilled" is a
  -- fulfilment/status change only and must not touch inventory quantity
  -- again, or stock would be deducted twice for the same order.
  RETURN NEW;
END;
$$;
