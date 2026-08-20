-- Problem: recording a bill was done as two separate client-side inserts
-- (bills, then bill_lines). If the bill_lines insert failed - most commonly
-- because GL Settings (Accounts Payable account / default fund) wasn't
-- configured yet, which fn_sync_bill_journal_entry enforces - the app tried
-- to clean up by deleting the now-lineless bill header. But DELETE on
-- public.bills was revoked from authenticated users (see gl_interconnection
-- migration, section 8), so that cleanup delete itself failed with a
-- permissions error, which masked the real error and left a 0.00 "ghost"
-- bill behind in the list permanently.
--
-- Fix: do both inserts inside one SECURITY DEFINER function, in a single
-- transaction. If anything fails (including the GL posting trigger on
-- bill_lines), Postgres rolls back the whole thing automatically - no ghost
-- bill, no orphaned rows, and the caller gets the real error message.

CREATE OR REPLACE FUNCTION public.create_bill_with_lines(
  p_vendor_id      int,
  p_fiscal_year_id int,
  p_bill_date      date,
  p_due_date       date,
  p_memo           varchar,
  p_status         public.bill_status,
  p_lines          jsonb -- [{ "description": "...", "account_id": 1, "amount": 100.00 }, ...]
)
RETURNS public.bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill      public.bills%ROWTYPE;
  v_bill_no   varchar;
  v_line      jsonb;
  v_line_count int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer')) THEN
    RAISE EXCEPTION 'Only admin or treasurer roles can record bills.';
  END IF;

  SELECT jsonb_array_length(p_lines) INTO v_line_count;
  IF p_lines IS NULL OR v_line_count IS NULL OR v_line_count = 0 THEN
    RAISE EXCEPTION 'Add at least one line item with a description, account, and amount.';
  END IF;

  v_bill_no := 'BILL-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || floor(random() * 90 + 10)::text;

  INSERT INTO public.bills (
    bill_no, vendor_id, fiscal_year_id, bill_date, due_date, memo, status
  ) VALUES (
    v_bill_no, p_vendor_id, p_fiscal_year_id, p_bill_date, p_due_date, p_memo, p_status
  ) RETURNING * INTO v_bill;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO public.bill_lines (bill_id, description, account_id, amount)
    VALUES (
      v_bill.id,
      v_line->>'description',
      (v_line->>'account_id')::int,
      (v_line->>'amount')::numeric(14,2)
    );
  END LOOP;

  -- Re-select so the returned row reflects journal_entry_id if the lines
  -- insert trigger posted it (status = received/paid etc).
  SELECT * INTO v_bill FROM public.bills WHERE id = v_bill.id;
  RETURN v_bill;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bill_with_lines(int, int, date, date, varchar, public.bill_status, jsonb) TO authenticated;

-- ----------------------------------------------------------------------------
-- Clean up any pre-existing 0.00 "ghost" bills created by the old buggy flow
-- (bill header with no line items and never posted to the ledger). Safe to
-- run any time - a bill with journal_entry_id set is left untouched.
-- ----------------------------------------------------------------------------
DELETE FROM public.bills b
WHERE b.journal_entry_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.bill_lines bl WHERE bl.bill_id = b.id);
