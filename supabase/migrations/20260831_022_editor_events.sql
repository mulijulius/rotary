-- Editor-managed calendar events.
--
-- Distinct from public.meetings (which admin/secretary manage for the
-- weekly-meeting / QR check-in workflow). This table lets the Editor role
-- post standalone events (fundraisers, community drives, announcements,
-- etc.) from the Back Office, which then show up on the public /events
-- calendar in pink, separate from the green/amber/rose meeting statuses.
--
-- Every row in this table is, by construction, only ever written by an
-- admin or editor (see RLS below), so the calendar can safely treat any
-- event surfaced from here as "posted by an editor" without needing to
-- track the author's role per-row.

CREATE TABLE public.editor_events (
  id          bigserial PRIMARY KEY,
  title       varchar(160) NOT NULL,
  event_date  date NOT NULL,
  start_time  time,
  end_time    time,
  venue       varchar(200),
  description text,
  is_public   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_editor_events_date ON public.editor_events(event_date);

-- Keep updated_at current on every edit.
CREATE OR REPLACE FUNCTION public.fn_touch_editor_events_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_editor_events_touch_updated_at
  BEFORE UPDATE ON public.editor_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_editor_events_updated_at();

-- Stamp created_by from the session automatically — the client never sets
-- this itself, so it can't be spoofed to attribute an event to someone else.
CREATE OR REPLACE FUNCTION public.fn_stamp_editor_events_created_by()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_editor_events_stamp_created_by
  BEFORE INSERT ON public.editor_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_editor_events_created_by();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_events TO authenticated;
GRANT ALL ON public.editor_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.editor_events_id_seq TO authenticated;

ALTER TABLE public.editor_events ENABLE ROW LEVEL SECURITY;

-- Only admin/editor (public.is_admin_or_editor, added in
-- 20260817120000_role_scoped_admin_workflows.sql) can read or write this
-- table directly. The public calendar reads through the view below instead.
CREATE POLICY "Admin/editor manage editor events" ON public.editor_events
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_or_editor(auth.uid()));

-- Public-safe projection for the /events calendar (mirrors the
-- v_public_meetings pattern from 20260827_019_public_meetings_view.sql):
-- only the columns the calendar needs to render, scoped to is_public =
-- true, so anon never touches created_by or the base table's RLS surface.
CREATE OR REPLACE VIEW public.v_public_editor_events WITH (security_invoker = true) AS
SELECT
  id,
  title,
  event_date,
  start_time,
  end_time,
  venue,
  description
FROM public.editor_events
WHERE is_public = true;

COMMENT ON VIEW public.v_public_editor_events IS
  'Public-safe projection of editor_events (is_public = true only). Used by the public /events calendar to render editor-posted events in pink.';

GRANT SELECT ON public.v_public_editor_events TO anon, authenticated;
