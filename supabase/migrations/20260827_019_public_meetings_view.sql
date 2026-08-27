-- Public-safe read view for the public Events/Calendar page (/events).
--
-- Why this is needed:
-- The existing RLS policy "Public meetings are readable" on public.meetings
-- lets anon SELECT * on any row where is_public = true. That means an
-- anonymous visitor querying `meetings` directly would also receive
-- qr_token, qr_issued_at, checkin_opens_at, checkin_closes_at and
-- is_closed — internal fields used for the self check-in QR flow that
-- have no reason to be public.
--
-- This view exposes only the columns the public calendar actually needs
-- to render (title, type, date/time, venue, description, mandatory flag),
-- scoped to is_public = true meetings, so the /events page (and any other
-- public-facing consumer) can be pointed at it instead of the base table.
--
-- The underlying RLS policies on public.meetings are untouched, so the
-- admin panel and authenticated flows keep working exactly as before.

CREATE OR REPLACE VIEW public.v_public_meetings WITH (security_invoker = true) AS
SELECT
  id,
  title,
  meeting_type,
  meeting_date,
  start_time,
  end_time,
  venue,
  description,
  is_mandatory
FROM public.meetings
WHERE is_public = true;

COMMENT ON VIEW public.v_public_meetings IS
  'Public-safe projection of meetings (is_public = true only), excluding QR/check-in internals. Used by the public /events calendar.';

GRANT SELECT ON public.v_public_meetings TO anon, authenticated;
