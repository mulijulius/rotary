-- Financial Statements Views and Functions
-- Provides comprehensive financial reporting capabilities

-- Income Statement View (Profit & Loss)
CREATE OR REPLACE VIEW public.v_income_statement WITH (security_invoker = true) AS
SELECT
  fy.id AS fiscal_year_id,
  fy.name AS fiscal_year_name,
  fy.start_date,
  fy.end_date,
  acc.code,
  acc.name,
  acc.type,
  SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END) AS total_debit,
  SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END) AS total_credit,
  SUM(CASE
    WHEN acc.normal_balance = 'debit' THEN COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)
    ELSE COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
  END) AS balance
FROM public.fiscal_years fy
CROSS JOIN public.accounts acc
LEFT JOIN public.journal_entries je ON je.fiscal_year_id = fy.id AND je.is_posted = true
LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = acc.id
WHERE acc.type IN ('income', 'expense')
GROUP BY fy.id, fy.name, fy.start_date, fy.end_date, acc.id, acc.code, acc.name, acc.type;

GRANT SELECT ON public.v_income_statement TO authenticated;

-- Balance Sheet View
CREATE OR REPLACE VIEW public.v_balance_sheet WITH (security_invoker = true) AS
SELECT
  fy.id AS fiscal_year_id,
  fy.name AS fiscal_year_name,
  fy.end_date AS as_of_date,
  acc.code,
  acc.name,
  acc.type,
  acc.parent_account_id,
  SUM(CASE
    WHEN acc.normal_balance = 'debit' THEN COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)
    ELSE COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
  END) AS balance
FROM public.fiscal_years fy
CROSS JOIN public.accounts acc
LEFT JOIN public.journal_entries je ON je.fiscal_year_id = fy.id AND je.is_posted = true AND je.entry_date <= fy.end_date
LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = acc.id
WHERE acc.type IN ('asset', 'liability', 'equity')
GROUP BY fy.id, fy.name, fy.end_date, acc.id, acc.code, acc.name, acc.type, acc.parent_account_id;

GRANT SELECT ON public.v_balance_sheet TO authenticated;

-- Cash Flow Statement View
CREATE OR REPLACE VIEW public.v_cash_flow_statement WITH (security_invoker = true) AS
SELECT
  fy.id AS fiscal_year_id,
  fy.name AS fiscal_year_name,
  fy.start_date,
  fy.end_date,
  CASE
    WHEN acc.code LIKE '4%' OR acc.code LIKE '5%' THEN 'operating'
    WHEN acc.code LIKE '3%' THEN 'investing'
    ELSE 'financing'
  END AS activity_type,
  acc.code,
  acc.name,
  SUM(CASE
    WHEN acc.normal_balance = 'debit' THEN COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)
    ELSE COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
  END) AS amount
FROM public.fiscal_years fy
CROSS JOIN public.accounts acc
LEFT JOIN public.journal_entries je ON je.fiscal_year_id = fy.id AND je.is_posted = true
LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = acc.id
WHERE acc.code LIKE '1%' OR acc.code LIKE '3%' OR acc.code LIKE '4%' OR acc.code LIKE '5%'
GROUP BY fy.id, fy.name, fy.start_date, fy.end_date, acc.id, acc.code, acc.name;

GRANT SELECT ON public.v_cash_flow_statement TO authenticated;

-- Statement of Equity View
CREATE OR REPLACE VIEW public.v_statement_of_equity WITH (security_invoker = true) AS
SELECT
  fy.id AS fiscal_year_id,
  fy.name AS fiscal_year_name,
  fy.start_date,
  fy.end_date,
  acc.code,
  acc.name,
  SUM(CASE
    WHEN acc.normal_balance = 'credit' THEN COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
    ELSE COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)
  END) AS amount
FROM public.fiscal_years fy
CROSS JOIN public.accounts acc
LEFT JOIN public.journal_entries je ON je.fiscal_year_id = fy.id AND je.is_posted = true
LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = acc.id
WHERE acc.type = 'equity'
GROUP BY fy.id, fy.name, fy.start_date, fy.end_date, acc.id, acc.code, acc.name;

GRANT SELECT ON public.v_statement_of_equity TO authenticated;

-- Historical Account Balances View
CREATE OR REPLACE VIEW public.v_account_history WITH (security_invoker = true) AS
SELECT
  fy.id AS fiscal_year_id,
  fy.name AS fiscal_year_name,
  fy.end_date AS period_end,
  acc.code,
  acc.name,
  acc.type,
  SUM(CASE
    WHEN acc.normal_balance = 'debit' THEN COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)
    ELSE COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
  END) AS period_balance
FROM public.fiscal_years fy
CROSS JOIN public.accounts acc
LEFT JOIN public.journal_entries je ON je.fiscal_year_id = fy.id AND je.is_posted = true
LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = acc.id
GROUP BY fy.id, fy.name, fy.end_date, acc.id, acc.code, acc.name, acc.type;

GRANT SELECT ON public.v_account_history TO authenticated;

-- Inventory Valuation View
CREATE OR REPLACE VIEW public.v_inventory_valuation WITH (security_invoker = true) AS
SELECT
  ii.id,
  ii.name,
  ii.category,
  ii.quantity,
  ii.unit_cost,
  ii.total_value,
  ii.accumulated_depreciation,
  ii.book_value,
  ii.status,
  ii.purchase_date,
  ii.depreciation_years,
  COUNT(DISTINCT im.id) AS movements_count,
  MAX(im.movement_date) AS last_movement_date
FROM public.inventory_items ii
LEFT JOIN public.inventory_movements im ON im.inventory_item_id = ii.id
GROUP BY ii.id, ii.name, ii.category, ii.quantity, ii.unit_cost, ii.total_value,
         ii.accumulated_depreciation, ii.book_value, ii.status, ii.purchase_date, ii.depreciation_years;

GRANT SELECT ON public.v_inventory_valuation TO authenticated;

-- Inventory valuation over time (per fiscal year), for trend charts.
CREATE OR REPLACE VIEW public.v_inventory_valuation_history WITH (security_invoker = true) AS
SELECT
  fy.id AS fiscal_year_id,
  fy.name AS fiscal_year_name,
  fy.end_date AS period_end,
  COUNT(DISTINCT ii.id) AS items_count,
  COALESCE(SUM(ii.total_value), 0) AS total_cost,
  COALESCE(SUM(ds.accumulated_to_date), 0) AS accumulated_depreciation,
  COALESCE(SUM(ii.total_value), 0) - COALESCE(SUM(ds.accumulated_to_date), 0) AS book_value
FROM public.fiscal_years fy
LEFT JOIN public.inventory_items ii
  ON ii.purchase_date IS NULL OR ii.purchase_date <= fy.end_date
LEFT JOIN public.depreciation_schedules ds
  ON ds.inventory_item_id = ii.id AND ds.fiscal_year_id = fy.id
GROUP BY fy.id, fy.name, fy.end_date;

GRANT SELECT ON public.v_inventory_valuation_history TO authenticated;

-- Period-over-Period Comparison View
CREATE OR REPLACE VIEW public.v_period_comparison WITH (security_invoker = true) AS
WITH ranked_periods AS (
  SELECT
    ROW_NUMBER() OVER (PARTITION BY acc.id ORDER BY fy.end_date) AS period_rank,
    fy.id AS fiscal_year_id,
    fy.name AS fiscal_year_name,
    fy.end_date,
    acc.id AS account_id,
    acc.code,
    acc.name,
    acc.type,
    SUM(CASE
      WHEN acc.normal_balance = 'debit' THEN COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)
      ELSE COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
    END) AS balance
  FROM public.fiscal_years fy
  CROSS JOIN public.accounts acc
  LEFT JOIN public.journal_entries je ON je.fiscal_year_id = fy.id AND je.is_posted = true
  LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = acc.id
  GROUP BY fy.id, fy.name, fy.end_date, acc.id, acc.code, acc.name, acc.type
)
SELECT
  curr.fiscal_year_id,
  curr.fiscal_year_name,
  curr.end_date,
  curr.account_id,
  curr.code,
  curr.name,
  curr.type,
  curr.balance AS current_balance,
  prev.balance AS previous_balance,
  (curr.balance - COALESCE(prev.balance, 0)) AS variance,
  CASE
    WHEN COALESCE(prev.balance, 0) = 0 THEN NULL
    ELSE ((curr.balance - COALESCE(prev.balance, 0)) / COALESCE(prev.balance, 0) * 100)
  END AS variance_percent
FROM ranked_periods curr
LEFT JOIN ranked_periods prev ON curr.period_rank = prev.period_rank + 1 AND curr.account_id = prev.account_id;

GRANT SELECT ON public.v_period_comparison TO authenticated;

-- Financial Summary by Period
CREATE OR REPLACE VIEW public.v_financial_summary WITH (security_invoker = true) AS
SELECT
  fy.id AS fiscal_year_id,
  fy.name AS fiscal_year_name,
  fy.start_date,
  fy.end_date,
  SUM(CASE WHEN acc.type = 'income' THEN ABS(COALESCE(acc.balance, 0)) ELSE 0 END) AS total_income,
  SUM(CASE WHEN acc.type = 'expense' THEN ABS(COALESCE(acc.balance, 0)) ELSE 0 END) AS total_expenses,
  SUM(CASE WHEN acc.type = 'asset' THEN COALESCE(acc.balance, 0) ELSE 0 END) AS total_assets,
  SUM(CASE WHEN acc.type = 'liability' THEN COALESCE(acc.balance, 0) ELSE 0 END) AS total_liabilities,
  SUM(CASE WHEN acc.type = 'equity' THEN COALESCE(acc.balance, 0) ELSE 0 END) AS total_equity
FROM public.fiscal_years fy
CROSS JOIN LATERAL (
  SELECT
    a.id,
    a.type,
    SUM(CASE
      WHEN a.normal_balance = 'debit' THEN COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)
      ELSE COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
    END) AS balance
  FROM public.accounts a
  LEFT JOIN public.journal_entries je ON je.fiscal_year_id = fy.id AND je.is_posted = true
  LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = a.id
  GROUP BY a.id, a.type
) acc
GROUP BY fy.id, fy.name, fy.start_date, fy.end_date;

GRANT SELECT ON public.v_financial_summary TO authenticated;

-- Security hygiene: SECURITY DEFINER helpers must not be callable by
-- signed-out visitors (Postgres grants EXECUTE to PUBLIC by default).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_officer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_secretary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_editor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_secretary_or_editor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_reissue_qr_token(bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_decide_leave_request(bigint, boolean, varchar) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_decide_profile_edit_request(bigint, boolean, varchar) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_calculate_depreciation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_log_role_decision() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_create_pending_role_request() FROM PUBLIC, anon;
