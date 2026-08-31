-- Club Documents: generalizes the per-official `board_position_documents`
-- table (20260826_017_officer_and_invoice_documents.sql) into a club-wide
-- documents feature.
--
-- What changes and why:
--
--   1. Table renamed board_position_documents -> club_documents. The name
--      "club documents" is what's shown across every dashboard now, and
--      the table backs more than just per-official uploads. Renaming a
--      table keeps its OID, so every existing RLS policy, grant, and the
--      storage bucket wiring from the previous migration keep working
--      unchanged — nothing needs to be re-created.
--
--   2. board_position_id becomes nullable. A document no longer has to be
--      filed under a specific board position — an officer can upload a
--      general club document (AGM notice, policy doc, etc.) that isn't
--      tied to anyone's role.
--
--   3. New `category` column ('general' | 'minutes' | 'handover' |
--      'financial' | 'other'). Lets the Secretary's meeting-minutes
--      uploads (see the /admin/minutes screen) show up distinctly from
--      generic per-position documents while living in the same table and
--      the same RLS/storage rules.
--
--   4. New `fiscal_year_id` (nullable, independent of board_position_id)
--      and `document_date` (e.g. the date of the meeting a minutes doc
--      covers) so documents not tied to a position can still be filtered
--      by year and sorted meaningfully.
--
--   5. `v_club_documents` view joins in the position title, member name,
--      and fiscal year name so every dashboard can query one place
--      instead of re-implementing the join. Read access mirrors the
--      underlying table: any signed-in member. This follows the same
--      pattern as v_public_board (20260816160725) — RLS on the base
--      table is still enforced through the view.
--
-- Nothing about who can read/write changes: any signed-in member can
-- still read, and only officers (admin/treasurer/secretary/editor, per
-- public.is_officer) can still write — enforced by the RLS policies
-- carried over from the original migration.

ALTER TABLE public.board_position_documents RENAME TO club_documents;

ALTER TABLE public.club_documents
  ALTER COLUMN board_position_id DROP NOT NULL;

ALTER TABLE public.club_documents
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS fiscal_year_id int REFERENCES public.fiscal_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_date date;

ALTER TABLE public.club_documents
  ADD CONSTRAINT club_documents_category_check
  CHECK (category IN ('general', 'minutes', 'handover', 'financial', 'other'));

CREATE INDEX IF NOT EXISTS idx_club_documents_category ON public.club_documents(category);
CREATE INDEX IF NOT EXISTS idx_club_documents_fiscal_year ON public.club_documents(fiscal_year_id);

COMMENT ON TABLE public.club_documents IS
  'Club-wide documents: meeting minutes, handover notes, and other files. Optionally tied to a board_position and/or fiscal_year. Read: any signed-in member. Write: officers only (see RLS policies carried over from board_position_documents).';
COMMENT ON COLUMN public.club_documents.category IS
  'general | minutes | handover | financial | other. Drives which dashboard screen a document surfaces under.';

-- ---------------------------------------------------------------------
-- Joined view for cross-dashboard listing
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_club_documents AS
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
