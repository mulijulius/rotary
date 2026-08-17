-- Role approval workflow.
--
-- Previously an admin granting a role *was* the only way a row in
-- user_roles ever got created, so any row = access. Now a user picks a
-- desired role at sign-up and that only creates a *request*; an admin must
-- approve it before it grants anything. Existing rows were all created by
-- an admin directly (via /admin/users), so they're backfilled as already
-- approved — nobody currently in the system loses access from this change.

CREATE TYPE public.role_status AS ENUM ('pending', 'approved', 'revoked');

-- Replaced below by a partial unique index that only constrains *live*
-- rows — otherwise someone denied for a role could never request it again,
-- since their old (user_id, role) pair would still be sitting in history.
ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_role_key;

ALTER TABLE public.user_roles
  ADD COLUMN status       public.role_status NOT NULL DEFAULT 'pending',
  ADD COLUMN requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN decided_at   timestamptz,
  ADD COLUMN decided_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.user_roles SET status = 'approved', decided_at = now();

-- A user can hold at most one *live* (pending or approved) role at a time.
-- Past decisions (revoked/denied) stick around as history and don't count
-- against this, so someone can be re-approved for a different role later.
CREATE UNIQUE INDEX user_roles_one_active_role_per_user
  ON public.user_roles (user_id)
  WHERE status IN ('pending', 'approved');

-- has_role / is_officer must only honor roles an admin has actually approved.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_officer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','treasurer','secretary','editor')
      AND status = 'approved'
  )
$$;

-- A signed-up user may create their own request row, but only ever as
-- 'pending' — flipping it to 'approved' still requires an admin, via the
-- existing "Admins manage roles" ALL policy.
CREATE POLICY "Users request own role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Auto-create a pending role request straight from the sign-up form,
-- without needing the new session to already be usable client-side (email
-- confirmation may still be pending at this point). The requested role
-- travels in auth user metadata, set via supabase.auth.signUp({ options:
-- { data: { requested_role } } }).
CREATE OR REPLACE FUNCTION public.fn_create_pending_role_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
BEGIN
  BEGIN
    v_role := (NEW.raw_user_meta_data ->> 'requested_role')::public.app_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := NULL;
  END;

  IF v_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, status)
    VALUES (NEW.id, v_role, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_pending_role_request ON auth.users;
CREATE TRIGGER trg_create_pending_role_request
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fn_create_pending_role_request();

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_officer(uuid) TO authenticated;
