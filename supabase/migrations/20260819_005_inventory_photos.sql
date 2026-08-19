-- Inventory item photos.
--
-- Adds a photo_url column to inventory_items and a Supabase Storage
-- bucket to hold the actual image files. Photos are public to read
-- (so they can render in the member shop and admin views without a
-- signed URL), but only officers can upload/replace/delete them.

ALTER TABLE public.inventory_items
  ADD COLUMN photo_url text;

COMMENT ON COLUMN public.inventory_items.photo_url IS
  'Public URL of the item photo in the inventory-photos storage bucket.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-photos', 'inventory-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Inventory photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'inventory-photos');

CREATE POLICY "Officers upload inventory photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inventory-photos' AND public.is_officer(auth.uid()));

CREATE POLICY "Officers update inventory photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'inventory-photos' AND public.is_officer(auth.uid()))
WITH CHECK (bucket_id = 'inventory-photos' AND public.is_officer(auth.uid()));

CREATE POLICY "Officers delete inventory photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inventory-photos' AND public.is_officer(auth.uid()));
