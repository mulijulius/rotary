-- Fix: the club-documents bucket was created with
--   INSERT INTO storage.buckets (id, name, public) VALUES (...) ON CONFLICT (id) DO NOTHING;
-- (20260826_017_officer_and_invoice_documents.sql). ON CONFLICT DO NOTHING
-- means if this bucket id already existed for any reason (created by hand
-- in the Supabase dashboard before the migration ran, or recreated later
-- through the dashboard UI) with a restrictive file_size_limit or
-- allowed_mime_types, this migration never touched it and the client-side
-- 15MB check in src/lib/club-documents.ts would NOT match the bucket's
-- real limit — Storage would reject the upload with a policy/limit error
-- that the UI surfaces only as a generic toast, easy to miss on mobile.
--
-- This makes the bucket state explicit and matches what the app's own
-- validation already assumes: no bucket-level mime restriction, and a
-- generous size ceiling (bigger than the 15MB the client already enforces,
-- so the client check is always the binding one).

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 20971520, -- 20MB, headroom above the 15MB client-side cap
  allowed_mime_types = NULL   -- NULL = no restriction
WHERE id = 'club-documents';
