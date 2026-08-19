-- Member self-service profile editing.
--
-- Until now, `members` had no UPDATE policy for the row's own owner at
-- all — only admin/secretary (via "Admin/secretary manage members") could
-- write to it, and a plain member's only path to changing their own
-- contact info was the officer-approved `profile_edit_requests` queue
-- from 20260817120000_role_scoped_admin_workflows.sql. That queue is left
-- in place (still useful for an audited trail on request), but this
-- migration additionally lets a signed-in member update their own row
-- directly for the low-risk fields — name, phone, photo — with the save
-- landing immediately instead of waiting on an officer.
--
-- Three things:
--   1. A new RLS policy letting a member UPDATE the members row linked to
--      their own auth account.
--   2. A tightened `fn_restrict_member_updates` trigger so that a
--      self-service edit (not admin/secretary) still can't touch email or
--      classification — those stay officer-controlled since email backs
--      login identity and classification is a club-assigned designation.
--      Status/QR/RI-number/user_id were already admin-only via the
--      existing checks in that trigger.
--   3. A public-read, owner-scoped `member-avatars` storage bucket so
--      members can upload their own profile photo, following the same
--      pattern as `inventory-photos` (20260819_005_inventory_photos.sql).
--   4. Adds `members` to the `supabase_realtime` publication so the
--      profile page (and anything else watching a member row) can
--      subscribe to live changes instead of only refetching after its
--      own save.

-- ---------------------------------------------------------------------
-- 1. Let a member update their own row
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Members update own profile" ON public.members;
CREATE POLICY "Members update own profile" ON public.members
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. Restrict which fields a self-service edit may touch
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_restrict_member_updates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR current_setting('rotary.bypass_member_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.qr_token IS DISTINCT FROM OLD.qr_token
     OR NEW.qr_issued_at IS DISTINCT FROM OLD.qr_issued_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.ri_number IS DISTINCT FROM OLD.ri_number THEN
    RAISE EXCEPTION 'Only an admin can change member status, QR credentials, RI number, or account linkage.';
  END IF;

  -- A member editing their own profile (i.e. not admin, and not a
  -- secretary using the officer members page) may only change their name,
  -- phone, and photo. Email and classification still require an officer.
  IF NOT public.has_role(auth.uid(), 'secretary') AND auth.uid() = OLD.user_id THEN
    IF NEW.email IS DISTINCT FROM OLD.email OR NEW.classification IS DISTINCT FROM OLD.classification THEN
      RAISE EXCEPTION 'Contact a club officer to change your email or classification.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- Trigger already exists (trg_restrict_member_updates) and points at this
-- function by name, so replacing the function body is enough; no need to
-- recreate the trigger itself.

-- ---------------------------------------------------------------------
-- 3. Avatar storage bucket
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-avatars', 'member-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Member avatars are publicly readable" ON storage.objects;
CREATE POLICY "Member avatars are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'member-avatars');

-- Upload path convention: `${auth.uid()}/<filename>`. A member can only
-- write inside their own folder; officers can write into anyone's folder
-- (e.g. Admin -> Members -> photo dialog, uploading on behalf of someone).
DROP POLICY IF EXISTS "Members upload own avatar" ON storage.objects;
CREATE POLICY "Members upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'member-avatars'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_officer(auth.uid()))
);

DROP POLICY IF EXISTS "Members update own avatar" ON storage.objects;
CREATE POLICY "Members update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'member-avatars'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_officer(auth.uid()))
)
WITH CHECK (
  bucket_id = 'member-avatars'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_officer(auth.uid()))
);

DROP POLICY IF EXISTS "Members delete own avatar" ON storage.objects;
CREATE POLICY "Members delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'member-avatars'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_officer(auth.uid()))
);

-- ---------------------------------------------------------------------
-- 4. Realtime: let clients subscribe to live changes on their own row
-- ---------------------------------------------------------------------

ALTER TABLE public.members REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- already added (e.g. migration re-run)
END $$;
