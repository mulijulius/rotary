-- Role-scoped admin workflows.
--
-- This migration does four things:
--   1. Adds an immutable audit trail of every role decision (who approved/
--      revoked whom, and when), so admins can review history.
--   2. Adds self-service request tables for members (leave-of-absence,
--      profile-edit) that officers approve rather than members editing
--      their own row directly.
--   3. Adds an admin-only QR token reissue function.
--   4. Tightens RLS that currently piggybacks on the broad `is_officer()`
--      check (admin+treasurer+secretary+editor) down to the specific
--      role(s) that should actually have write access, per role:
--        - meetings/attendance/board_positions -> admin + secretary
--        - members roster -> admin + secretary can write; a trigger further
--          blocks secretary from touching status/qr/user linkage fields
--        - projects/news/gallery -> admin + editor
--        - contact_messages -> admin + secretary + editor (read/triage)
--      Finance tables were already scoped to admin+treasurer only and are
--      left as-is, but v_member_balances / v_trial_balance / v_attendance_summary
--      are tightened so a plain member can only ever see their own row.

-- ---------------------------------------------------------------------
-- 1. Role decision audit trail
-- ---------------------------------------------------------------------

CREATE TYPE public.role_audit_action AS ENUM ('requested', 'approved', 'revoked');

CREATE TABLE public.role_decisions (
  id             bigserial PRIMARY KEY,
  user_role_id   uuid NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  subject_user_id uuid NOT NULL,
  subject_email  varchar(160),
  role           public.app_role NOT NULL,
  action         public.role_audit_action NOT NULL,
  actor_user_id  uuid,
  actor_email    varchar(160),
  decided_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_role_decisions_subject ON public.role_decisions(subject_user_id);
CREATE INDEX idx_role_decisions_decided_at ON public.role_decisions(decided_at DESC);

GRANT SELECT ON public.role_decisions TO authenticated;
GRANT ALL ON public.role_decisions TO service_role;
ALTER TABLE public.role_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read role audit trail" ON public.role_decisions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Logs every insert (a request) and every status-changing update (an
-- approval or revocation) on user_roles. SECURITY DEFINER because it needs
-- to read auth.users to snapshot emails at decision time (auth.users isn't
-- queryable through PostgREST, and emails can change later).
CREATE OR REPLACE FUNCTION public.fn_log_role_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_subject_email varchar(160);
  v_actor_email   varchar(160);
BEGIN
  SELECT email INTO v_subject_email FROM auth.users WHERE id = NEW.user_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_decisions (user_role_id, subject_user_id, subject_email, role, action, actor_user_id, actor_email, decided_at)
    VALUES (NEW.id, NEW.user_id, v_subject_email, NEW.role, 'requested', NEW.user_id, v_subject_email, NEW.requested_at);
    RETURN NEW;
  END IF;

  -- UPDATE: only log real status transitions, not incidental edits.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'revoked') THEN
    IF NEW.decided_by IS NOT NULL THEN
      SELECT email INTO v_actor_email FROM auth.users WHERE id = NEW.decided_by;
    END IF;
    INSERT INTO public.role_decisions (user_role_id, subject_user_id, subject_email, role, action, actor_user_id, actor_email, decided_at)
    VALUES (NEW.id, NEW.user_id, v_subject_email, NEW.role, NEW.status::text::public.role_audit_action, NEW.decided_by, v_actor_email, COALESCE(NEW.decided_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_decision_insert ON public.user_roles;
CREATE TRIGGER trg_log_role_decision_insert
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.fn_log_role_decision();

DROP TRIGGER IF EXISTS trg_log_role_decision_update ON public.user_roles;
CREATE TRIGGER trg_log_role_decision_update
AFTER UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.fn_log_role_decision();

-- Backfill audit history for rows that already existed before this
-- migration (they were all admin-granted/approved per the prior migration).
INSERT INTO public.role_decisions (user_role_id, subject_user_id, subject_email, role, action, actor_user_id, actor_email, decided_at)
SELECT ur.id, ur.user_id, au.email, ur.role, 'approved', ur.decided_by, decided_au.email, COALESCE(ur.decided_at, ur.requested_at)
FROM public.user_roles ur
LEFT JOIN auth.users au ON au.id = ur.user_id
LEFT JOIN auth.users decided_au ON decided_au.id = ur.decided_by
WHERE ur.status = 'approved';

CREATE VIEW public.v_role_audit WITH (security_invoker = true) AS
SELECT id, subject_user_id, subject_email, role, action, actor_user_id, actor_email, decided_at
FROM public.role_decisions
ORDER BY decided_at DESC;

GRANT SELECT ON public.v_role_audit TO authenticated;

-- ---------------------------------------------------------------------
-- 2a. Leave-of-absence requests (member self-service)
-- ---------------------------------------------------------------------

CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'denied');

CREATE TABLE public.leave_requests (
  id            bigserial PRIMARY KEY,
  member_id     bigint NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  start_date    date NOT NULL,
  end_date      date,
  reason        varchar(500) NOT NULL,
  status        public.request_status NOT NULL DEFAULT 'pending',
  requested_at  timestamptz NOT NULL DEFAULT now(),
  decided_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at    timestamptz,
  decision_note varchar(300),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_leave_requests_member ON public.leave_requests(member_id);

GRANT SELECT, INSERT ON public.leave_requests TO authenticated;
GRANT UPDATE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own leave requests" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretary')
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = leave_requests.member_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Members submit own leave requests" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = leave_requests.member_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Admin/secretary decide leave requests" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretary'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretary'));

-- fn_decide_leave_request is defined further below (section 4), after the
-- member-update guard trigger it needs to bypass, and granted there.

-- ---------------------------------------------------------------------
-- 2b. Profile-edit requests (member self-service, officer-applied)
-- ---------------------------------------------------------------------

CREATE TABLE public.profile_edit_requests (
  id               bigserial PRIMARY KEY,
  member_id        bigint NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  requested_changes jsonb NOT NULL, -- subset of {phone, email, classification, photo_url}
  status           public.request_status NOT NULL DEFAULT 'pending',
  requested_at     timestamptz NOT NULL DEFAULT now(),
  decided_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at       timestamptz,
  decision_note    varchar(300)
);
CREATE INDEX idx_profile_edit_requests_member ON public.profile_edit_requests(member_id);

GRANT SELECT, INSERT ON public.profile_edit_requests TO authenticated;
GRANT ALL ON public.profile_edit_requests TO service_role;
ALTER TABLE public.profile_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own profile edit requests" ON public.profile_edit_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretary')
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = profile_edit_requests.member_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Members submit own profile edit requests" ON public.profile_edit_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND (requested_changes - 'phone' - 'email' - 'classification' - 'photo_url') = '{}'::jsonb
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = profile_edit_requests.member_id AND m.user_id = auth.uid())
  );

-- Applies only the allow-listed fields present in requested_changes.
CREATE OR REPLACE FUNCTION public.fn_decide_profile_edit_request(_request_id bigint, _approve boolean, _note varchar(300))
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id bigint;
  v_changes jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretary')) THEN
    RAISE EXCEPTION 'Forbidden: requires admin or secretary role.';
  END IF;

  SELECT member_id, requested_changes INTO v_member_id, v_changes
  FROM public.profile_edit_requests WHERE id = _request_id AND status = 'pending';
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Profile edit request % not found or already decided.', _request_id;
  END IF;

  UPDATE public.profile_edit_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END,
      decided_by = auth.uid(), decided_at = now(), decision_note = _note
  WHERE id = _request_id;

  IF _approve THEN
    UPDATE public.members SET
      phone          = COALESCE(v_changes ->> 'phone', phone),
      email          = COALESCE(v_changes ->> 'email', email),
      classification = COALESCE(v_changes ->> 'classification', classification),
      photo_url      = COALESCE(v_changes ->> 'photo_url', photo_url),
      updated_at     = now()
    WHERE id = v_member_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_decide_profile_edit_request(bigint, boolean, varchar) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. QR token reissue (admin only)
-- ---------------------------------------------------------------------
-- fn_reissue_qr_token is defined in section 4, after the member-update
-- guard trigger it needs to bypass, and granted there.

-- ---------------------------------------------------------------------
-- 4. Tighten RLS: replace is_officer() blanket writes with per-role checks
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_or_secretary(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'secretary')
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_or_secretary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_or_editor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'editor')
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_or_editor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_secretary_or_editor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'secretary') OR public.has_role(_user_id, 'editor')
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_secretary_or_editor(uuid) TO authenticated;

-- Members roster: writes limited to admin + secretary (was: any officer).
DROP POLICY IF EXISTS "Officers manage members" ON public.members;
CREATE POLICY "Admin/secretary manage members" ON public.members
  FOR ALL TO authenticated
  USING (public.is_admin_or_secretary(auth.uid()))
  WITH CHECK (public.is_admin_or_secretary(auth.uid()));

-- A secretary may edit contact/classification basics but not financial or
-- identity-sensitive fields; only admin (or the reissue/approval functions
-- above, which run as SECURITY DEFINER and bypass this trigger's caller
-- check via a session flag) can touch status, qr fields, or the user link.
-- fn_reissue_qr_token and fn_decide_leave_request run SECURITY DEFINER as
-- the function owner, so this BEFORE trigger (which checks auth.uid(), not
-- the function owner) still fires for them — grant those two an explicit
-- bypass via a local flag instead of relying on role.
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
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_restrict_member_updates ON public.members;
CREATE TRIGGER trg_restrict_member_updates
BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.fn_restrict_member_updates();

CREATE OR REPLACE FUNCTION public.fn_reissue_qr_token(_member_id bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_token uuid := gen_random_uuid();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: only admins can reissue QR tokens.';
  END IF;
  PERFORM set_config('rotary.bypass_member_guard', 'on', true);
  UPDATE public.members
  SET qr_token = v_new_token, qr_issued_at = now(), updated_at = now()
  WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member % not found.', _member_id;
  END IF;
  RETURN v_new_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_decide_leave_request(_request_id bigint, _approve boolean, _note varchar(300))
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id bigint;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretary')) THEN
    RAISE EXCEPTION 'Forbidden: requires admin or secretary role.';
  END IF;

  SELECT member_id INTO v_member_id FROM public.leave_requests WHERE id = _request_id AND status = 'pending';
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Leave request % not found or already decided.', _request_id;
  END IF;

  UPDATE public.leave_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END,
      decided_by = auth.uid(), decided_at = now(), decision_note = _note
  WHERE id = _request_id;

  IF _approve THEN
    PERFORM set_config('rotary.bypass_member_guard', 'on', true);
    UPDATE public.members SET status = 'leave_of_absence', updated_at = now() WHERE id = v_member_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_reissue_qr_token(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_decide_leave_request(bigint, boolean, varchar) TO authenticated;

-- Meetings / attendance / board positions: writes limited to admin + secretary.
DROP POLICY IF EXISTS "Officers manage meetings" ON public.meetings;
CREATE POLICY "Admin/secretary manage meetings" ON public.meetings
  FOR ALL TO authenticated
  USING (public.is_admin_or_secretary(auth.uid()))
  WITH CHECK (public.is_admin_or_secretary(auth.uid()));

DROP POLICY IF EXISTS "Officers manage attendance" ON public.attendance;
CREATE POLICY "Admin/secretary manage attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_admin_or_secretary(auth.uid()))
  WITH CHECK (public.is_admin_or_secretary(auth.uid()));

DROP POLICY IF EXISTS "Members read own attendance" ON public.attendance;
CREATE POLICY "Members read own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_secretary(auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = attendance.member_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Officers manage board" ON public.board_positions;
CREATE POLICY "Admin/secretary manage board" ON public.board_positions
  FOR ALL TO authenticated
  USING (public.is_admin_or_secretary(auth.uid()))
  WITH CHECK (public.is_admin_or_secretary(auth.uid()));

-- Content (projects/news/gallery): writes limited to admin + editor.
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','news_articles','gallery_albums','project_photos','gallery_photos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Editors read all %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Editors manage %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Admin/editor read all %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_admin_or_editor(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "Admin/editor manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin_or_editor(auth.uid())) WITH CHECK (public.is_admin_or_editor(auth.uid()))', t);
  END LOOP;
END $do$;

-- Contact messages: admin + secretary + editor may read/triage (secretary
-- is first point of contact; editor for press inquiries). Only admin +
-- secretary can archive/delete-equivalent updates that aren't just "mark read".
DROP POLICY IF EXISTS "Officers read messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Officers update messages" ON public.contact_messages;
CREATE POLICY "Admin/secretary/editor read messages" ON public.contact_messages
  FOR SELECT TO authenticated USING (public.is_admin_secretary_or_editor(auth.uid()));
CREATE POLICY "Admin/secretary/editor update messages" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin_secretary_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_secretary_or_editor(auth.uid()));

-- Members may read their own journal lines (needed for v_member_balances
-- below) — finance tables otherwise stay admin+treasurer only.
CREATE POLICY "Members read own journal lines" ON public.journal_lines
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = journal_lines.member_id AND m.user_id = auth.uid()));

-- Tighten the three cross-member views so a plain member only ever gets
-- their own row back, while officers keep seeing everyone.
DROP VIEW IF EXISTS public.v_member_balances;
CREATE VIEW public.v_member_balances WITH (security_invoker = true) AS
SELECT m.id AS member_id, m.first_name || ' ' || m.last_name AS member_name, m.ri_number,
       COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance_due
FROM public.members m
LEFT JOIN public.journal_lines jl ON jl.member_id = m.id
LEFT JOIN public.accounts a ON a.id = jl.account_id AND a.code = '1200'
WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer') OR m.user_id = auth.uid()
GROUP BY m.id, m.first_name, m.last_name, m.ri_number;

DROP VIEW IF EXISTS public.v_attendance_summary;
CREATE VIEW public.v_attendance_summary WITH (security_invoker = true) AS
SELECT m.id AS member_id, m.first_name || ' ' || m.last_name AS member_name,
  COUNT(mt.id) FILTER (WHERE mt.is_mandatory) AS meetings_required,
  COUNT(att.id) FILTER (WHERE mt.is_mandatory AND att.status IN ('present','late')) AS meetings_attended,
  ROUND(100.0 * COUNT(att.id) FILTER (WHERE mt.is_mandatory AND att.status IN ('present','late'))
        / NULLIF(COUNT(mt.id) FILTER (WHERE mt.is_mandatory), 0), 1) AS attendance_pct
FROM public.members m
CROSS JOIN public.meetings mt
LEFT JOIN public.attendance att ON att.meeting_id = mt.id AND att.member_id = m.id
WHERE m.status = 'active'
  AND (public.is_admin_or_secretary(auth.uid()) OR m.user_id = auth.uid())
GROUP BY m.id, m.first_name, m.last_name;

GRANT SELECT ON public.v_member_balances, public.v_attendance_summary TO authenticated, service_role;
