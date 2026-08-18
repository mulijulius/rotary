-- Financial Statements Views and Functions
-- Provides comprehensive financial reporting capabilities

-- Income Statement View (Profit & Loss)
-- Shows revenues and expenses for a specific period
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
GROUP BY fy.id, fy.name, fy.start_date, fy.end_date, acc.id, acc.code, acc.name, acc.type
ORDER BY fy.id DESC, acc.type DESC, acc.code;

GRANT SELECT ON public.v_income_statement TO authenticated;

-- Balance Sheet View
-- Shows financial position at a specific point in time
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
GROUP BY fy.id, fy.name, fy.end_date, acc.id, acc.code, acc.name, acc.type, acc.parent_account_id
ORDER BY fy.id DESC, 
  CASE WHEN acc.type = 'asset' THEN 1 WHEN acc.type = 'liability' THEN 2 ELSE 3 END,
  acc.code;

GRANT SELECT ON public.v_balance_sheet TO authenticated;

-- Cash Flow Statement View
-- Tracks cash movements across operating, investing, and financing activities
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
GROUP BY fy.id, fy.name, fy.start_date, fy.end_date, acc.id, acc.code, acc.name
ORDER BY fy.id DESC, activity_type, acc.code;

GRANT SELECT ON public.v_cash_flow_statement TO authenticated;

-- Statement of Equity View
-- Shows changes in equity over the period
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
GROUP BY fy.id, fy.name, fy.start_date, fy.end_date, acc.id, acc.code, acc.name
ORDER BY fy.id DESC, acc.code;

GRANT SELECT ON public.v_statement_of_equity TO authenticated;

-- Historical Account Balances View
-- Allows tracking account balances over time for trend analysis
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
GROUP BY fy.id, fy.name, fy.end_date, acc.id, acc.code, acc.name, acc.type
ORDER BY fy.end_date DESC, acc.type, acc.code;

GRANT SELECT ON public.v_account_history TO authenticated;

-- Inventory Valuation View
-- Shows inventory items with their current and historical valuations
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
         ii.accumulated_depreciation, ii.book_value, ii.status, ii.purchase_date, ii.depreciation_years
ORDER BY ii.category, ii.name;

GRANT SELECT ON public.v_inventory_valuation TO authenticated;

-- Period-over-Period Comparison View
-- Allows comparing account balances across fiscal periods
CREATE OR REPLACE VIEW public.v_period_comparison WITH (security_invoker = true) AS
WITH ranked_periods AS (
  SELECT
    ROW_NUMBER() OVER (ORDER BY fy.end_date) AS period_rank,
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
LEFT JOIN ranked_periods prev ON curr.period_rank = prev.period_rank + 1 AND curr.account_id = prev.account_id
ORDER BY curr.fiscal_year_id DESC, curr.type, curr.code;

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
LEFT JOIN v_income_statement ON v_income_statement.fiscal_year_id = fy.id
LEFT JOIN v_balance_sheet ON v_balance_sheet.fiscal_year_id = fy.id
CROSS JOIN LATERAL (
  SELECT
    acc.id,
    acc.type,
    SUM(CASE 
      WHEN acc.normal_balance = 'debit' THEN COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)
      ELSE COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
    END) AS balance
  FROM public.accounts acc
  LEFT JOIN public.journal_entries je ON je.fiscal_year_id = fy.id AND je.is_posted = true
  LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = acc.id
  GROUP BY acc.id, acc.type
) acc
GROUP BY fy.id, fy.name, fy.start_date, fy.end_date
ORDER BY fy.id DESC;

GRANT SELECT ON public.v_financial_summary TO authenticated;
