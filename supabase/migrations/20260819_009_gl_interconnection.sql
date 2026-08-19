-- ============================================================================
-- GL Interconnection Fix
--
-- Problem: bills, invoices and payments were recorded as standalone rows.
-- Nothing ever created the matching journal_entries / journal_lines, so
-- recording a bill never touched Accounts Payable, issuing an invoice never
-- touched Accounts Receivable, and the financial statement views (which are
-- all driven off journal_lines) never reflected AP/AR activity at all.
--
-- Fix: every financial document now drives the general ledger automatically,
-- at the database level (so it can't be bypassed by any client):
--   - Recording a bill  -> Dr each line's account, Cr Accounts Payable
--   - Issuing an invoice -> Dr Accounts Receivable, Cr each line's account
--   - Recording a payment (receipt or disbursement) -> moves cash and
--     settles AR/AP, and updates the source bill/invoice status
--   - Voiding a bill/invoice/payment -> reverses the posted entry instead
--     of deleting history
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GL Settings: the default control accounts + fund used by automatic
--    postings. A single configurable row that ties every subsidiary ledger
--    (bills, invoices, payments) back to the same chart of accounts.
-- ----------------------------------------------------------------------------
CREATE TABLE public.gl_settings (
  id               smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ar_account_id    int REFERENCES public.accounts(id),
  ap_account_id    int REFERENCES public.accounts(id),
  cash_account_id  int REFERENCES public.accounts(id),
  default_fund_id  int REFERENCES public.funds(id),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.gl_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, UPDATE ON public.gl_settings TO authenticated;
GRANT ALL ON public.gl_settings TO service_role;
ALTER TABLE public.gl_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance staff read gl_settings" ON public.gl_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer'));
CREATE POLICY "Finance staff write gl_settings" ON public.gl_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer'));

-- ----------------------------------------------------------------------------
-- 2. Unify payments so the same table/flow covers member receipts (AR) and
--    vendor disbursements (AP), and generalize payment_allocations so a
--    payment can settle either an invoice or a bill.
-- ----------------------------------------------------------------------------
CREATE TYPE public.payment_direction AS ENUM ('receipt', 'disbursement');

ALTER TABLE public.payments
  ADD COLUMN payment_type public.payment_direction NOT NULL DEFAULT 'receipt',
  ADD COLUMN vendor_id    int REFERENCES public.vendors(id),
  ADD COLUMN voided       boolean NOT NULL DEFAULT false;

CREATE INDEX idx_payments_vendor ON public.payments(vendor_id);

ALTER TABLE public.payment_allocations
  ALTER COLUMN invoice_id DROP NOT NULL,
  ADD COLUMN bill_id bigint REFERENCES public.bills(id);

ALTER TABLE public.payment_allocations
  ADD CONSTRAINT chk_allocation_single_target CHECK (
    (invoice_id IS NOT NULL AND bill_id IS NULL) OR
    (invoice_id IS NULL AND bill_id IS NOT NULL)
  );

CREATE INDEX idx_payment_allocations_bill ON public.payment_allocations(bill_id);

-- ----------------------------------------------------------------------------
-- 3. Shared helper: reverse a posted journal entry with a mirrored entry
--    instead of deleting it, so history is never lost.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_reverse_journal_entry(p_je_id bigint, p_source_id bigint, p_memo text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orig      public.journal_entries%ROWTYPE;
  v_new_id    bigint;
  v_created_by bigint;
BEGIN
  SELECT * INTO v_orig FROM public.journal_entries WHERE id = p_je_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_created_by FROM public.members WHERE user_id = auth.uid();

  INSERT INTO public.journal_entries (
    entry_no, fiscal_year_id, fund_id, entry_date, memo, source_type, source_id, created_by, is_posted, posted_at
  ) VALUES (
    'REV-' || v_orig.entry_no || '-' || to_char(now(), 'HH24MISSMS'),
    v_orig.fiscal_year_id, v_orig.fund_id, CURRENT_DATE, p_memo, 'adjustment', p_source_id, v_created_by, true, now()
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.journal_lines (journal_entry_id, line_no, account_id, member_id, debit, credit, description)
  SELECT v_new_id, jl.line_no, jl.account_id, jl.member_id, jl.credit, jl.debit,
         'Reversal: ' || COALESCE(jl.description, '')
  FROM public.journal_lines jl
  WHERE jl.journal_entry_id = p_je_id;

  RETURN v_new_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Bills -> Accounts Payable
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_bill_journal_entry(p_bill_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bill            public.bills%ROWTYPE;
  v_total           numeric(14,2);
  v_je_id           bigint;
  v_ap_account_id   int;
  v_default_fund_id int;
  v_created_by      bigint;
  v_is_posted       boolean;
BEGIN
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT id INTO v_created_by FROM public.members WHERE user_id = auth.uid();

  IF v_bill.status = 'void' THEN
    IF v_bill.journal_entry_id IS NOT NULL THEN
      SELECT is_posted INTO v_is_posted FROM public.journal_entries WHERE id = v_bill.journal_entry_id;
      IF v_is_posted THEN
        PERFORM public.fn_reverse_journal_entry(v_bill.journal_entry_id, v_bill.id, 'Void bill ' || v_bill.bill_no);
      END IF;
    END IF;
    RETURN;
  END IF;

  IF v_bill.status = 'draft' THEN
    RETURN; -- nothing hits the ledger while a bill is still a draft
  END IF;

  IF v_bill.journal_entry_id IS NOT NULL THEN
    RETURN; -- already posted; line items are locked once posted (see guard trigger)
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total FROM public.bill_lines WHERE bill_id = p_bill_id;
  IF v_total <= 0 THEN
    RETURN; -- no line items recorded yet
  END IF;

  SELECT ap_account_id, default_fund_id INTO v_ap_account_id, v_default_fund_id FROM public.gl_settings WHERE id = 1;
  IF v_ap_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Payable default account is not configured. Set it under Chart of Accounts > GL Settings before recording bills.';
  END IF;
  IF v_default_fund_id IS NULL THEN
    RAISE EXCEPTION 'A default fund is not configured. Set it under Chart of Accounts > GL Settings before recording bills.';
  END IF;

  INSERT INTO public.journal_entries (
    entry_no, fiscal_year_id, fund_id, entry_date, memo, source_type, source_id, created_by, is_posted, posted_at
  ) VALUES (
    'BILL-' || v_bill.bill_no, v_bill.fiscal_year_id, v_default_fund_id, v_bill.bill_date,
    'Bill ' || v_bill.bill_no || COALESCE(' - ' || v_bill.memo, ''), 'bill', v_bill.id, v_created_by, true, now()
  ) RETURNING id INTO v_je_id;

  INSERT INTO public.journal_lines (journal_entry_id, line_no, account_id, debit, credit, description)
  SELECT v_je_id, row_number() OVER (ORDER BY bl.id), bl.account_id, bl.amount, 0, bl.description
  FROM public.bill_lines bl WHERE bl.bill_id = p_bill_id;

  INSERT INTO public.journal_lines (journal_entry_id, line_no, account_id, debit, credit, description)
  VALUES (
    v_je_id, (SELECT COALESCE(MAX(line_no), 0) + 1 FROM public.journal_lines WHERE journal_entry_id = v_je_id),
    v_ap_account_id, 0, v_total, 'Accounts Payable - Bill ' || v_bill.bill_no
  );

  UPDATE public.bills SET journal_entry_id = v_je_id WHERE id = p_bill_id;
END;
$$;

-- Lock line items once a bill has a posted journal entry; always allow the
-- very first insert (journal_entry_id is still null at that point).
CREATE OR REPLACE FUNCTION public.fn_guard_bill_lines_locked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_je_id   bigint;
  v_bill_no varchar;
BEGIN
  SELECT journal_entry_id, bill_no INTO v_je_id, v_bill_no
  FROM public.bills WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
  IF v_je_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify line items on bill % - it has already been posted to the ledger. Void the bill instead.', v_bill_no;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_guard_bill_lines_locked
BEFORE INSERT OR UPDATE OR DELETE ON public.bill_lines
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_bill_lines_locked();

-- Statement-level sync so a single multi-row line insert (the normal UI
-- flow: N line items inserted in one call) is only synced once, with the
-- full total, instead of racing itself row by row.
CREATE OR REPLACE FUNCTION public.fn_sync_bills_from_new_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bill_id bigint;
BEGIN
  FOR v_bill_id IN SELECT DISTINCT bill_id FROM new_rows LOOP
    PERFORM public.fn_sync_bill_journal_entry(v_bill_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bill_lines_insert_sync
AFTER INSERT ON public.bill_lines
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.fn_sync_bills_from_new_lines();

CREATE OR REPLACE FUNCTION public.fn_sync_bills_from_updated_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bill_id bigint;
BEGIN
  FOR v_bill_id IN SELECT DISTINCT bill_id FROM new_rows LOOP
    PERFORM public.fn_sync_bill_journal_entry(v_bill_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bill_lines_update_sync
AFTER UPDATE ON public.bill_lines
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.fn_sync_bills_from_updated_lines();

CREATE OR REPLACE FUNCTION public.fn_sync_bills_from_deleted_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bill_id bigint;
BEGIN
  FOR v_bill_id IN SELECT DISTINCT bill_id FROM old_rows LOOP
    PERFORM public.fn_sync_bill_journal_entry(v_bill_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bill_lines_delete_sync
AFTER DELETE ON public.bill_lines
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.fn_sync_bills_from_deleted_lines();

-- Cover status changes made after the bill row already exists (e.g. draft -> received, or -> void).
CREATE OR REPLACE FUNCTION public.fn_trg_bills_status_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fn_sync_bill_journal_entry(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bills_status_sync
AFTER UPDATE OF status ON public.bills
FOR EACH ROW WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.fn_trg_bills_status_sync();

-- Never let a posted bill's audit trail be deleted out from under its journal entry.
CREATE OR REPLACE FUNCTION public.fn_guard_bill_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete bill % - it has a posted journal entry. Void it instead.', OLD.bill_no;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_guard_bill_delete
BEFORE DELETE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_bill_delete();

-- ----------------------------------------------------------------------------
-- 5. Invoices -> Accounts Receivable (mirror of the bill logic above)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_invoice_journal_entry(p_invoice_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv             public.invoices%ROWTYPE;
  v_total           numeric(14,2);
  v_je_id           bigint;
  v_ar_account_id   int;
  v_default_fund_id int;
  v_created_by      bigint;
  v_is_posted       boolean;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT id INTO v_created_by FROM public.members WHERE user_id = auth.uid();

  IF v_inv.status = 'void' THEN
    IF v_inv.journal_entry_id IS NOT NULL THEN
      SELECT is_posted INTO v_is_posted FROM public.journal_entries WHERE id = v_inv.journal_entry_id;
      IF v_is_posted THEN
        PERFORM public.fn_reverse_journal_entry(v_inv.journal_entry_id, v_inv.id, 'Void invoice ' || v_inv.invoice_no);
      END IF;
    END IF;
    RETURN;
  END IF;

  IF v_inv.status = 'draft' THEN
    RETURN;
  END IF;

  IF v_inv.journal_entry_id IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total FROM public.invoice_lines WHERE invoice_id = p_invoice_id;
  IF v_total <= 0 THEN
    RETURN;
  END IF;

  SELECT ar_account_id, default_fund_id INTO v_ar_account_id, v_default_fund_id FROM public.gl_settings WHERE id = 1;
  IF v_ar_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable default account is not configured. Set it under Chart of Accounts > GL Settings before issuing invoices.';
  END IF;
  IF v_default_fund_id IS NULL THEN
    RAISE EXCEPTION 'A default fund is not configured. Set it under Chart of Accounts > GL Settings before issuing invoices.';
  END IF;

  INSERT INTO public.journal_entries (
    entry_no, fiscal_year_id, fund_id, entry_date, memo, source_type, source_id, created_by, is_posted, posted_at
  ) VALUES (
    'INV-' || v_inv.invoice_no, v_inv.fiscal_year_id, v_default_fund_id, v_inv.invoice_date,
    'Invoice ' || v_inv.invoice_no || COALESCE(' - ' || v_inv.memo, ''), 'invoice', v_inv.id, v_created_by, true, now()
  ) RETURNING id INTO v_je_id;

  INSERT INTO public.journal_lines (journal_entry_id, line_no, account_id, member_id, debit, credit, description)
  VALUES (v_je_id, 1, v_ar_account_id, v_inv.member_id, v_total, 0, 'Accounts Receivable - Invoice ' || v_inv.invoice_no);

  INSERT INTO public.journal_lines (journal_entry_id, line_no, account_id, debit, credit, description)
  SELECT v_je_id, row_number() OVER (ORDER BY il.id) + 1, il.account_id, 0, il.amount, il.description
  FROM public.invoice_lines il WHERE il.invoice_id = p_invoice_id;

  UPDATE public.invoices SET journal_entry_id = v_je_id WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_guard_invoice_lines_locked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_je_id      bigint;
  v_invoice_no varchar;
BEGIN
  SELECT journal_entry_id, invoice_no INTO v_je_id, v_invoice_no
  FROM public.invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_je_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify line items on invoice % - it has already been posted to the ledger. Void the invoice instead.', v_invoice_no;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_guard_invoice_lines_locked
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_lines
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_invoice_lines_locked();

CREATE OR REPLACE FUNCTION public.fn_sync_invoices_from_new_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice_id bigint;
BEGIN
  FOR v_invoice_id IN SELECT DISTINCT invoice_id FROM new_rows LOOP
    PERFORM public.fn_sync_invoice_journal_entry(v_invoice_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_invoice_lines_insert_sync
AFTER INSERT ON public.invoice_lines
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.fn_sync_invoices_from_new_lines();

CREATE OR REPLACE FUNCTION public.fn_sync_invoices_from_updated_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice_id bigint;
BEGIN
  FOR v_invoice_id IN SELECT DISTINCT invoice_id FROM new_rows LOOP
    PERFORM public.fn_sync_invoice_journal_entry(v_invoice_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_invoice_lines_update_sync
AFTER UPDATE ON public.invoice_lines
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.fn_sync_invoices_from_updated_lines();

CREATE OR REPLACE FUNCTION public.fn_sync_invoices_from_deleted_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice_id bigint;
BEGIN
  FOR v_invoice_id IN SELECT DISTINCT invoice_id FROM old_rows LOOP
    PERFORM public.fn_sync_invoice_journal_entry(v_invoice_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_invoice_lines_delete_sync
AFTER DELETE ON public.invoice_lines
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.fn_sync_invoices_from_deleted_lines();

CREATE OR REPLACE FUNCTION public.fn_trg_invoices_status_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fn_sync_invoice_journal_entry(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoices_status_sync
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.fn_trg_invoices_status_sync();

CREATE OR REPLACE FUNCTION public.fn_guard_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete invoice % - it has a posted journal entry. Void it instead.', OLD.invoice_no;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_guard_invoice_delete
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_invoice_delete();

-- ----------------------------------------------------------------------------
-- 6. Payments -> move cash and settle AR/AP
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_post_payment_journal_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ar_account_id   int;
  v_ap_account_id   int;
  v_default_fund_id int;
  v_fiscal_year_id  int;
  v_je_id           bigint;
  v_created_by      bigint;
BEGIN
  SELECT ar_account_id, ap_account_id, default_fund_id
  INTO v_ar_account_id, v_ap_account_id, v_default_fund_id
  FROM public.gl_settings WHERE id = 1;

  IF v_default_fund_id IS NULL THEN
    RAISE EXCEPTION 'A default fund is not configured. Set it under Chart of Accounts > GL Settings before recording payments.';
  END IF;

  SELECT id INTO v_fiscal_year_id FROM public.fiscal_years
  WHERE NEW.payment_date BETWEEN start_date AND end_date
  ORDER BY id DESC LIMIT 1;
  IF v_fiscal_year_id IS NULL THEN
    RAISE EXCEPTION 'No fiscal year covers payment date %. Create one before recording this payment.', NEW.payment_date;
  END IF;

  SELECT id INTO v_created_by FROM public.members WHERE user_id = auth.uid();

  IF NEW.payment_type = 'receipt' THEN
    IF v_ar_account_id IS NULL THEN
      RAISE EXCEPTION 'Accounts Receivable default account is not configured. Set it under Chart of Accounts > GL Settings.';
    END IF;

    INSERT INTO public.journal_entries (
      entry_no, fiscal_year_id, fund_id, entry_date, memo, source_type, source_id, created_by, is_posted, posted_at
    ) VALUES (
      'PMT-' || NEW.payment_no, v_fiscal_year_id, v_default_fund_id, NEW.payment_date,
      'Payment received ' || NEW.payment_no || COALESCE(' - ' || NEW.reference, ''), 'payment', NEW.id, v_created_by, true, now()
    ) RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (journal_entry_id, line_no, account_id, member_id, debit, credit, description)
    VALUES
      (v_je_id, 1, NEW.deposit_account_id, NEW.member_id, NEW.amount, 0, 'Received via ' || NEW.method || ' - ' || NEW.payment_no),
      (v_je_id, 2, v_ar_account_id, NEW.member_id, 0, NEW.amount, 'AR settlement - ' || NEW.payment_no);

  ELSE -- disbursement
    IF v_ap_account_id IS NULL THEN
      RAISE EXCEPTION 'Accounts Payable default account is not configured. Set it under Chart of Accounts > GL Settings.';
    END IF;

    INSERT INTO public.journal_entries (
      entry_no, fiscal_year_id, fund_id, entry_date, memo, source_type, source_id, created_by, is_posted, posted_at
    ) VALUES (
      'PMT-' || NEW.payment_no, v_fiscal_year_id, v_default_fund_id, NEW.payment_date,
      'Payment issued ' || NEW.payment_no || COALESCE(' - ' || NEW.reference, ''), 'payment', NEW.id, v_created_by, true, now()
    ) RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (journal_entry_id, line_no, account_id, debit, credit, description)
    VALUES
      (v_je_id, 1, v_ap_account_id, NEW.amount, 0, 'AP settlement - ' || NEW.payment_no),
      (v_je_id, 2, NEW.deposit_account_id, 0, NEW.amount, 'Paid via ' || NEW.method || ' - ' || NEW.payment_no);
  END IF;

  UPDATE public.payments SET journal_entry_id = v_je_id WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payments_post_je
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.fn_post_payment_journal_entry();

-- Voiding a payment reverses its journal entry and drops its allocations
-- (which in turn re-syncs the affected invoice/bill status - see section 7).
CREATE OR REPLACE FUNCTION public.fn_void_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.journal_entry_id IS NOT NULL THEN
    PERFORM public.fn_reverse_journal_entry(NEW.journal_entry_id, NEW.id, 'Void payment ' || NEW.payment_no);
  END IF;
  DELETE FROM public.payment_allocations WHERE payment_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payments_void
AFTER UPDATE OF voided ON public.payments
FOR EACH ROW WHEN (NEW.voided = true AND OLD.voided = false)
EXECUTE FUNCTION public.fn_void_payment();

-- ----------------------------------------------------------------------------
-- 7. Payment allocations -> keep invoice/bill status in lock-step with what
--    has actually been paid, and stop an allocation from over-applying.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_allocation_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total   numeric(14,2);
  v_applied numeric(14,2);
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total FROM public.invoice_lines WHERE invoice_id = NEW.invoice_id;
    SELECT COALESCE(SUM(amount_applied), 0) INTO v_applied
    FROM public.payment_allocations
    WHERE invoice_id = NEW.invoice_id AND id IS DISTINCT FROM NEW.id;
    IF v_applied + NEW.amount_applied > v_total THEN
      RAISE EXCEPTION 'Allocation of % exceeds the remaining balance on this invoice (total %, already applied %).',
        NEW.amount_applied, v_total, v_applied;
    END IF;
  END IF;

  IF NEW.bill_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total FROM public.bill_lines WHERE bill_id = NEW.bill_id;
    SELECT COALESCE(SUM(amount_applied), 0) INTO v_applied
    FROM public.payment_allocations
    WHERE bill_id = NEW.bill_id AND id IS DISTINCT FROM NEW.id;
    IF v_applied + NEW.amount_applied > v_total THEN
      RAISE EXCEPTION 'Allocation of % exceeds the remaining balance on this bill (total %, already applied %).',
        NEW.amount_applied, v_total, v_applied;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_allocation_amount
BEFORE INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_allocation_amount();

CREATE OR REPLACE FUNCTION public.fn_sync_doc_status_from_allocations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice_id bigint := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_bill_id    bigint := COALESCE(NEW.bill_id, OLD.bill_id);
  v_total      numeric(14,2);
  v_applied    numeric(14,2);
  v_status     text;
BEGIN
  IF v_invoice_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total FROM public.invoice_lines WHERE invoice_id = v_invoice_id;
    SELECT COALESCE(SUM(pa.amount_applied), 0) INTO v_applied
    FROM public.payment_allocations pa
    JOIN public.payments p ON p.id = pa.payment_id AND p.voided = false
    WHERE pa.invoice_id = v_invoice_id;

    IF v_total > 0 AND v_applied >= v_total THEN v_status := 'paid';
    ELSIF v_applied > 0 THEN v_status := 'partially_paid';
    ELSE v_status := 'issued';
    END IF;

    UPDATE public.invoices SET status = v_status::public.invoice_status
    WHERE id = v_invoice_id AND status NOT IN ('draft', 'void');
  END IF;

  IF v_bill_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total FROM public.bill_lines WHERE bill_id = v_bill_id;
    SELECT COALESCE(SUM(pa.amount_applied), 0) INTO v_applied
    FROM public.payment_allocations pa
    JOIN public.payments p ON p.id = pa.payment_id AND p.voided = false
    WHERE pa.bill_id = v_bill_id;

    IF v_total > 0 AND v_applied >= v_total THEN v_status := 'paid';
    ELSIF v_applied > 0 THEN v_status := 'partially_paid';
    ELSE v_status := 'received';
    END IF;

    UPDATE public.bills SET status = v_status::public.bill_status
    WHERE id = v_bill_id AND status NOT IN ('draft', 'void');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_payment_allocations_sync
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_doc_status_from_allocations();

-- ----------------------------------------------------------------------------
-- 8. Protect ledger integrity: once a document is posted it can only be
--    voided/reversed, never silently deleted, from client code.
-- ----------------------------------------------------------------------------
REVOKE DELETE ON public.bills, public.invoices, public.payments,
  public.journal_entries, public.journal_lines FROM authenticated;

-- ----------------------------------------------------------------------------
-- 9. Member AR balances should follow whichever account is actually
--    configured as Accounts Receivable, not a hardcoded account code.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_member_balances WITH (security_invoker = true) AS
SELECT m.id AS member_id, m.first_name || ' ' || m.last_name AS member_name, m.ri_number,
       COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance_due
FROM public.members m
LEFT JOIN public.journal_lines jl ON jl.member_id = m.id
LEFT JOIN public.accounts a ON a.id = jl.account_id AND a.id = (SELECT ar_account_id FROM public.gl_settings WHERE id = 1)
GROUP BY m.id, m.first_name, m.last_name, m.ri_number;

-- ----------------------------------------------------------------------------
-- 10. Vendor Accounts Payable balances, mirroring v_member_balances, for
--     visibility into what the club currently owes each vendor: total billed
--     (excluding voided bills) minus total actually paid (excluding voided
--     payments).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_vendor_balances WITH (security_invoker = true) AS
SELECT
  v.id AS vendor_id,
  v.name AS vendor_name,
  COALESCE(SUM(bl.amount), 0) - COALESCE((
    SELECT SUM(pa.amount_applied)
    FROM public.payment_allocations pa
    JOIN public.payments p ON p.id = pa.payment_id AND p.voided = false
    WHERE pa.bill_id IN (SELECT b2.id FROM public.bills b2 WHERE b2.vendor_id = v.id AND b2.status <> 'void')
  ), 0) AS balance_owed
FROM public.vendors v
LEFT JOIN public.bills b ON b.vendor_id = v.id AND b.status <> 'void'
LEFT JOIN public.bill_lines bl ON bl.bill_id = b.id
GROUP BY v.id, v.name;

GRANT SELECT ON public.v_vendor_balances TO authenticated, service_role;
