-- Member <-> auth account linking.
--
-- Members were creatable (Admin -> Members -> Add Member) with no way to
-- tie the row to the auth account that will actually log in and use the
-- member portal (Admin -> Shop etc.), which all key off
-- `members.user_id = auth.uid()`. Signing up only ever created a pending
-- row in `user_roles` (role access) with nothing connecting it to a
-- `members` row (profile data) — the two were never joined. This migration
-- adds the missing link, admin-only, plus a uniqueness guard so one
-- account can't end up mapped to two member profiles (or vice versa).
--
-- Both functions bypass `fn_restrict_member_updates` (which already blocks
-- non-admin UPDATEs to `user_id`) via the same session-flag pattern used by
-- fn_reissue_qr_token / fn_decide_leave_request, then additionally
-- re-check the caller is admin themselves before touching anything, since
-- that trigger's own admin check would otherwise make this redundant only
-- for admins — non-admin callers must never reach the UPDATE at all.

-- One auth account can back at most one member profile.
CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_unique
  ON public.members(user_id) WHERE user_id IS NOT NULL;

-- Link (or relink) a member profile to an auth account. Approving a member
-- this way also clears any pending role request that account is waiting
-- on — from the admin's side, linking a profile *is* the approval a new
-- sign-up is waiting for, so this does both in one action instead of
-- requiring a second trip to Admin -> Users.
CREATE OR REPLACE FUNCTION public.fn_link_member_account(_member_id bigint, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing_member bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: only admins can link member accounts.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  SELECT id INTO v_existing_member
  FROM public.members WHERE user_id = _user_id AND id <> _member_id;
  IF v_existing_member IS NOT NULL THEN
    RAISE EXCEPTION 'That account is already linked to another member profile (#%).', v_existing_member;
  END IF;

  PERFORM set_config('rotary.bypass_member_guard', 'on', true);
  UPDATE public.members SET user_id = _user_id, updated_at = now() WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member % not found.', _member_id;
  END IF;

  UPDATE public.user_roles
  SET status = 'approved', decided_at = now(), decided_by = auth.uid()
  WHERE user_id = _user_id AND status = 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_link_member_account(bigint, uuid) TO authenticated;

-- Remove the link between a member profile and an auth account (e.g. it
-- was linked to the wrong person). Does not touch role approval either way.
CREATE OR REPLACE FUNCTION public.fn_unlink_member_account(_member_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: only admins can unlink member accounts.';
  END IF;

  PERFORM set_config('rotary.bypass_member_guard', 'on', true);
  UPDATE public.members SET user_id = NULL, updated_at = now() WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member % not found.', _member_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_unlink_member_account(bigint) TO authenticated;
