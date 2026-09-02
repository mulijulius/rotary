-- editor_events was originally locked down with a single FOR ALL policy
-- that only let admin/editor read (or write) rows. That meant the club
-- calendar on the Back Office Overview page (src/components/site/ClubCalendar.tsx)
-- only ever showed pink "club event" markers to admin/editor — treasurer,
-- secretary, and member all queried the same table and silently got zero
-- rows back from RLS, so their Overview calendar looked meeting-only.
--
-- Fix: split the single FOR ALL policy into a SELECT policy open to any
-- authenticated back-office role, and a write policy (INSERT/UPDATE/DELETE)
-- still scoped to admin/editor. Nothing about who can *create* events
-- changes — this only widens who can *see* them.

DROP POLICY IF EXISTS "Admin/editor manage editor events" ON public.editor_events;

CREATE POLICY "Any authenticated role can view editor events" ON public.editor_events
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/editor write editor events" ON public.editor_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin/editor update editor events" ON public.editor_events
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_editor(auth.uid()))
  WITH CHECK (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin/editor delete editor events" ON public.editor_events
  FOR DELETE TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));
