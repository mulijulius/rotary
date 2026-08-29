-- Home page slideshow + Gallery > Slideshow/Videos back-office management.
--
-- Adds two new content tables, both managed from a new "Slideshow" section
-- inside the existing Gallery area of the editor portal:
--
--   1. slideshow_slides — images shown in the auto-rotating slideshow that
--      renders on the public home page, just below the site header. Each
--      slide carries its own foreground caption text, which is rendered
--      over the image on the public page.
--
--   2. gallery_videos — a video library editors can add to (either a file
--      upload or a YouTube link). These aren't wired into any public page
--      yet — that placement is decided later — but the data model, storage
--      and admin UI to manage them are in place now so editors can start
--      populating it. A nullable `placement` tag lets a future public page
--      query "give me the videos tagged for section X" once that's decided.
--
-- Follows the exact same public-read-when-published / officer-write pattern
-- as gallery_albums / news_articles / projects (see the DO-loop in
-- 20260816160725_5d3445ef-f36d-477f-9651-2e40de515d38.sql).

-- ---------------------------------------------------------------------
-- 0. video_source enum
-- ---------------------------------------------------------------------

CREATE TYPE public.video_source AS ENUM ('upload', 'youtube');

-- ---------------------------------------------------------------------
-- 1. slideshow_slides
-- ---------------------------------------------------------------------

CREATE TABLE public.slideshow_slides (
  id         bigserial PRIMARY KEY,
  image_url  text NOT NULL,
  caption    varchar(300),
  sort_order int NOT NULL DEFAULT 0,
  published  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.slideshow_slides IS
  'Images for the auto-rotating slideshow on the public home page. `caption` is optional foreground text overlaid on that specific image.';

-- ---------------------------------------------------------------------
-- 2. gallery_videos
-- ---------------------------------------------------------------------

CREATE TABLE public.gallery_videos (
  id             bigserial PRIMARY KEY,
  title          varchar(160) NOT NULL,
  description    varchar(300),
  source         public.video_source NOT NULL DEFAULT 'youtube',
  video_url      text NOT NULL,
  thumbnail_url  text,
  -- Free-text tag an editor/admin can set later to say where this video
  -- should appear on the public site (e.g. "home_hero", "events_page").
  -- Nothing reads this yet — it's here so the data is ready once a public
  -- placement is decided.
  placement      varchar(60),
  sort_order     int NOT NULL DEFAULT 0,
  published      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gallery_videos IS
  'Uploaded videos or YouTube links added from Gallery > Videos. Not yet rendered on any public page — `placement` is a free-text tag reserved for that.';

-- ---------------------------------------------------------------------
-- 3. Grants + RLS (same shape as gallery_albums/projects/news_articles)
-- ---------------------------------------------------------------------

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['slideshow_slides','gallery_videos'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Published %1$s are public" ON public.%1$I FOR SELECT TO anon, authenticated USING (published = true)', t);
    EXECUTE format('CREATE POLICY "Editors read all %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_officer(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "Editors manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()))', t);
  END LOOP;
END $do$;

-- ---------------------------------------------------------------------
-- 4. club-videos storage bucket
--
-- Slide images reuse the existing public `club-photos` bucket (folder
-- "slideshow/<slide_id>", same as gallery/projects covers). Videos get
-- their own bucket since they're much larger and benefit from a mime/size
-- limit at the bucket level.
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-videos',
  'club-videos',
  true,
  209715200, -- 200MB
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Club videos are publicly readable" ON storage.objects;
CREATE POLICY "Club videos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'club-videos');

DROP POLICY IF EXISTS "Officers upload club videos" ON storage.objects;
CREATE POLICY "Officers upload club videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-videos' AND public.is_officer(auth.uid()));

DROP POLICY IF EXISTS "Officers update club videos" ON storage.objects;
CREATE POLICY "Officers update club videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'club-videos' AND public.is_officer(auth.uid()))
WITH CHECK (bucket_id = 'club-videos' AND public.is_officer(auth.uid()));

DROP POLICY IF EXISTS "Officers delete club videos" ON storage.objects;
CREATE POLICY "Officers delete club videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'club-videos' AND public.is_officer(auth.uid()));
