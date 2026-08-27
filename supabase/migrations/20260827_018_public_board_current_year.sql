## Full corrected script (drop + recreate the view)

```sql
-- Fixes the public /leadership page, which currently renders a
-- hard-coded array in src/lib/club-content.ts instead of reading from
-- board_positions. Two problems are addressed here:
--
-- 1. v_public_board (20260816160725_5d3445ef-...) was declared with
--    `security_invoker = true`. Since `members` SELECT is restricted to
--    `TO authenticated` and only your own row or an officer
--    ("Members read roster" policy), an anonymous site visitor querying
--    the view through their own (anon) privileges got zero rows back
--    from the members join — the view was effectively unusable from the
--    public site, which is presumably why it was never wired up and the
--    page fell back to hard-coded data. Dropping `security_invoker`
--    (view runs with the definer's privileges instead, i.e. bypasses
--    row-level security on the underlying tables) fixes that. This is
--    safe here because the view only ever selects a curated, already
--    intentionally-public set of columns (name, title, bio, photo,
--    ordering) — never email, phone, ri_number, or anything else on
--    `members`.
-- 2. The view didn't expose enough to resolve "the current Rotary year"
--    client-side, so we add fiscal_year_id + the year's start/end dates.
--
-- Column set, join shape, and the public SELECT grant are otherwise
-- unchanged from the original migration.

DROP VIEW IF EXISTS public.v_public_board;

CREATE VIEW public.v_public_board AS
SELECT
  bp.id,
  bp.title,
  bp.sort_order,
  bp.bio,
  bp.fiscal_year_id,
  m.first_name,
  m.last_name,
  m.photo_url,
  fy.name       AS fiscal_year,
  fy.start_date AS fiscal_year_start,
  fy.end_date   AS fiscal_year_end
FROM public.board_positions bp
JOIN public.members m ON m.id = bp.member_id
JOIN public.fiscal_years fy ON fy.id = bp.fiscal_year_id
ORDER BY fy.start_date DESC, bp.sort_order ASC;

-- Re-issue grant so this migration is safe to run standalone / against a
-- fresh database.
GRANT SELECT ON public.v_public_board TO anon, authenticated;
```