-- Fix: v_club_documents was created (20260901_023_club_documents.sql)
-- without `WITH (security_invoker = true)`, unlike every other view in
-- this schema (v_income_statement, v_balance_sheet, v_role_audit, etc).
--
-- Without security_invoker, a view runs with the privileges of its
-- OWNER (the migration-running role, e.g. postgres/supabase_admin),
-- which has BYPASSRLS. That makes the view's behavior inconsistent
-- with the RLS policies on the underlying club_documents table and
-- with the rest of this codebase's convention, and is worth closing
-- even though the current row-level policy is USING (true) either way.
--
-- This does not by itself explain "upload succeeds but the row never
-- shows up" — if that keeps happening after this migration, the cause
-- is almost certainly the PostgREST schema cache (see the next
-- migration) or an RLS/auth issue on write, not this view.

CREATE OR REPLACE VIEW public.v_club_documents WITH (security_invoker = true) AS
SELECT
  d.id,
  d.category,
  d.title,
  d.file_path,
  d.file_name,
  d.file_size,
  d.uploaded_by,
  d.created_at,
  d.document_date,
  d.board_position_id,
  bp.title AS position_title,
  m.first_name AS uploader_position_first_name,
  m.last_name AS uploader_position_last_name,
  COALESCE(d.fiscal_year_id, bp.fiscal_year_id) AS fiscal_year_id,
  fy.name AS fiscal_year_name
FROM public.club_documents d
LEFT JOIN public.board_positions bp ON bp.id = d.board_position_id
LEFT JOIN public.members m ON m.id = bp.member_id
LEFT JOIN public.fiscal_years fy ON fy.id = COALESCE(d.fiscal_year_id, bp.fiscal_year_id);

GRANT SELECT ON public.v_club_documents TO authenticated;
