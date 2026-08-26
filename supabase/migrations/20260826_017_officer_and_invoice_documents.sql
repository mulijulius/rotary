-- Document uploads for invoices and board positions (club officials).
--
-- Two independent things bundled into one migration:
--
--   1. An attachment on each invoice, so the Treasurer can attach the
--      supporting document/photo (receipt, request letter, etc.) right
--      when the invoice is raised. Unlike `club-photos`
--      (20260819_008_content_photos_and_meeting_qr.sql), these files are
--      NOT public — invoices can carry sensitive member financial detail —
--      so they live in a new private `club-documents` bucket and are
--      fetched via short-lived signed URLs instead of public URLs. Only
--      the storage *path* is stored on the row; the signed URL is minted
--      on demand client-side.
--
--   2. A `board_position_documents` table so each club official (the rows
--      of `board_positions` — President, Secretary, Treasurer, etc. for a
--      given fiscal year) has a place to attach documents tied to that
--      role: the Secretary's meeting minutes, the Treasurer's handover
--      notes, and so on. Files live in the same private `club-documents`
--      bucket. Read access is open to any signed-in member (not just
--      officers) so the documents are actually reachable by "someone else"
--      later, as opposed to sitting in a bucket only the uploader can see;
--      write access stays officer-only, matching every other
--      officer-authored table in this schema (board_positions itself,
--      meetings, projects, etc.)
--
-- Upload path convention (enforced client-side, not by policy):
--   invoices/<invoice_no>/<timestamp>-<rand>.<ext>
--   board-positions/<board_position_id>/<timestamp>-<rand>.<ext>

-- ---------------------------------------------------------------------
-- 1. club-documents storage bucket (private — signed URLs only)
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('club-documents', 'club-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members read club documents" ON storage.objects;
CREATE POLICY "Members read club documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'club-documents');

DROP POLICY IF EXISTS "Officers upload club documents" ON storage.objects;
CREATE POLICY "Officers upload club documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-documents' AND public.is_officer(auth.uid()));

DROP POLICY IF EXISTS "Officers update club documents" ON storage.objects;
CREATE POLICY "Officers update club documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'club-documents' AND public.is_officer(auth.uid()))
WITH CHECK (bucket_id = 'club-documents' AND public.is_officer(auth.uid()));

DROP POLICY IF EXISTS "Officers delete club documents" ON storage.objects;
CREATE POLICY "Officers delete club documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'club-documents' AND public.is_officer(auth.uid()));

-- ---------------------------------------------------------------------
-- 2. Invoice attachment (single document/image raised with the invoice)
-- ---------------------------------------------------------------------

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS attachment_path        text,
  ADD COLUMN IF NOT EXISTS attachment_name         varchar(255),
  ADD COLUMN IF NOT EXISTS attachment_size         bigint,
  ADD COLUMN IF NOT EXISTS attachment_uploaded_at  timestamptz;

COMMENT ON COLUMN public.invoices.attachment_path IS
  'Object path (not a full URL) inside the private club-documents storage bucket. Resolve to a viewable link with a short-lived signed URL, never getPublicUrl.';

-- ---------------------------------------------------------------------
-- 3. Per-official documents (minutes, handover notes, club documents)
-- ---------------------------------------------------------------------

CREATE TABLE public.board_position_documents (
  id                bigserial PRIMARY KEY,
  board_position_id int NOT NULL REFERENCES public.board_positions(id) ON DELETE CASCADE,
  title             varchar(200) NOT NULL,
  file_path         text NOT NULL,
  file_name         varchar(255) NOT NULL,
  file_size         bigint,
  uploaded_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_position_documents_position ON public.board_position_documents(board_position_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_position_documents TO authenticated;
GRANT ALL ON public.board_position_documents TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.board_position_documents_id_seq TO authenticated;

ALTER TABLE public.board_position_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read officer documents" ON public.board_position_documents
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Officers manage officer documents" ON public.board_position_documents
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid()))
  WITH CHECK (public.is_officer(auth.uid()));
