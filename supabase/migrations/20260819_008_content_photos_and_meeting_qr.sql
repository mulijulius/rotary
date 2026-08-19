-- Photo uploads for Projects/News/Gallery, and meeting-QR self check-in.
--
-- Three independent things bundled into one migration:
--
--   1. A public `club-photos` storage bucket so editors/admins can upload
--      real image files (cover images for projects/news/gallery albums,
--      plus per-project and per-album photo galleries) instead of pasting
--      external URLs. Follows the exact same public-read / officer-write
--      pattern as `inventory-photos` (20260819_005_inventory_photos.sql)
--      and `member-avatars` (20260819_007_member_self_profile.sql).
--      Upload path convention (enforced client-side, not by policy):
--        projects/<project_id>/cover-<timestamp>.<ext>
--        projects/<project_id>/photos/<timestamp>.<ext>
--        news/<article_id>/cover-<timestamp>.<ext>
--        gallery/<album_id>/cover-<timestamp>.<ext>
--        gallery/<album_id>/photos/<timestamp>.<ext>
--
--   2. A `qr_token` (+ `qr_issued_at`) column on `meetings`, mirroring the
--      existing `members.qr_token` badge pattern. Today's QR flow is
--      "member's badge gets scanned by staff" (members.qr_token, used by
--      /attendance/check-in). This adds the reverse flow: a per-meeting
--      QR code that a member scans themselves, from inside their own
--      back-office portal, to self-record attendance.
--
--   3. A new RLS policy on `attendance` allowing a signed-in member to
--      INSERT their *own* attendance row (and only their own) while a
--      meeting's QR check-in window is open. Previously the only INSERT
--      policy was "Officers manage attendance" (is_officer only) — a
--      plain `member` role had no way to write their own attendance row
--      at all, which is what self-service QR check-in requires.

-- ---------------------------------------------------------------------
-- 1. club-photos storage bucket
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('club-photos', 'club-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Club photos are publicly readable" ON storage.objects;
CREATE POLICY "Club photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'club-photos');

DROP POLICY IF EXISTS "Officers upload club photos" ON storage.objects;
CREATE POLICY "Officers upload club photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-photos' AND public.is_officer(auth.uid()));

DROP POLICY IF EXISTS "Officers update club photos" ON storage.objects;
CREATE POLICY "Officers update club photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'club-photos' AND public.is_officer(auth.uid()))
WITH CHECK (bucket_id = 'club-photos' AND public.is_officer(auth.uid()));

DROP POLICY IF EXISTS "Officers delete club photos" ON storage.objects;
CREATE POLICY "Officers delete club photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'club-photos' AND public.is_officer(auth.uid()));

-- ---------------------------------------------------------------------
-- 2. Per-meeting QR token
-- ---------------------------------------------------------------------

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS qr_token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS qr_issued_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.meetings.qr_token IS
  'Token embedded in the meeting''s check-in QR code. An admin/secretary can rotate it (fresh gen_random_uuid()) to invalidate a previously printed/displayed code.';

-- ---------------------------------------------------------------------
-- 3. Member self check-in via QR
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Members self check in via QR" ON public.attendance;
CREATE POLICY "Members self check in via QR" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Members may only write an attendance row for themselves...
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    -- ...and only while that meeting's QR check-in window is open.
    AND EXISTS (
      SELECT 1 FROM public.meetings mt
      WHERE mt.id = attendance.meeting_id
        AND mt.is_closed = false
        AND mt.checkin_opens_at IS NOT NULL
        AND mt.checkin_closes_at IS NOT NULL
        AND now() BETWEEN mt.checkin_opens_at AND mt.checkin_closes_at
    )
  );
