-- ============================================================================
-- Fix: saving GL Settings silently "succeeded" with nothing written.
--
-- Cause: gl_settings has an UPDATE RLS policy requiring an approved admin/
-- treasurer role. A plain PostgREST `.update().eq("id", 1)` from a caller
-- who doesn't satisfy that policy updates ZERO rows and returns NO error -
-- Postgres/PostgREST just silently filters the row out. The client code had
-- no way to distinguish "saved" from "blocked, 0 rows touched", so it always
-- showed a success toast.
--
-- Fix: move the save behind a SECURITY DEFINER RPC that explicitly checks
-- the caller's role and RAISEs a real, catchable error if they're not
-- authorized, instead of relying on RLS to fail silently.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_save_gl_settings(
  p_ar_account_id             int,
  p_ap_account_id             int,
  p_cash_account_id           int,
  p_default_fund_id           int,
  p_product_sales_account_id  int
)
RETURNS public.gl_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gl_settings;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer')) THEN
    RAISE EXCEPTION 'You do not have permission to change GL Settings. Only an approved admin or treasurer can do this.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.gl_settings
  SET ar_account_id            = p_ar_account_id,
      ap_account_id            = p_ap_account_id,
      cash_account_id          = p_cash_account_id,
      default_fund_id          = p_default_fund_id,
      product_sales_account_id = p_product_sales_account_id,
      updated_at               = now()
  WHERE id = 1
  RETURNING * INTO v_row;

  -- Belt and braces: the row is seeded by migration and should always exist,
  -- but if it's ever missing, create it instead of returning a silent NULL.
  IF v_row.id IS NULL THEN
    INSERT INTO public.gl_settings (
      id, ar_account_id, ap_account_id, cash_account_id, default_fund_id, product_sales_account_id, updated_at
    ) VALUES (
      1, p_ar_account_id, p_ap_account_id, p_cash_account_id, p_default_fund_id, p_product_sales_account_id, now()
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_save_gl_settings(int, int, int, int, int) TO authenticated;
