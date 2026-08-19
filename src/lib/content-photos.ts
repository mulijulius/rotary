// Photo upload + gallery helpers for the public content modules
// (Projects, News, Gallery). All images live in the single public
// `club-photos` storage bucket (see
// 20260819_008_content_photos_and_meeting_qr.sql), under a folder per
// content type and record id. Only officers (admin/treasurer/secretary/
// editor) can write here — enforced by storage RLS, not just this file —
// so this is the client-side shape, not the actual security boundary.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProjectPhoto = Database["public"]["Tables"]["project_photos"]["Row"];
export type GalleryPhoto = Database["public"]["Tables"]["gallery_photos"]["Row"];

const MAX_BYTES = 5 * 1024 * 1024;

function assertIsImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 5MB.");
  }
}

// Uploads a single image into `club-photos` under the given folder and
// returns its public URL. Folder examples: "projects/12", "news/7",
// "gallery/3/photos".
export async function uploadClubPhoto(folder: string, file: File): Promise<string> {
  assertIsImage(file);
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("club-photos").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("club-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteClubPhotoByUrl(publicUrl: string): Promise<void> {
  const marker = "/object/public/club-photos/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return; // not a club-photos URL (e.g. legacy external URL) — nothing to clean up
  const path = publicUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from("club-photos").remove([path]);
  if (error) console.error("[content-photos] failed to delete storage object", error);
}

// ---------------------------------------------------------------------
// Project photo gallery (project_photos)
// ---------------------------------------------------------------------

export async function fetchProjectPhotos(projectId: number): Promise<ProjectPhoto[]> {
  const { data, error } = await supabase
    .from("project_photos")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addProjectPhoto(
  projectId: number,
  file: File,
  caption?: string,
): Promise<ProjectPhoto> {
  const imageUrl = await uploadClubPhoto(`projects/${projectId}/photos`, file);
  const { data, error } = await supabase
    .from("project_photos")
    .insert({ project_id: projectId, image_url: imageUrl, caption: caption || null })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProjectPhoto(photo: ProjectPhoto): Promise<void> {
  const { error } = await supabase.from("project_photos").delete().eq("id", photo.id);
  if (error) throw error;
  await deleteClubPhotoByUrl(photo.image_url);
}

// ---------------------------------------------------------------------
// Gallery album photos (gallery_photos)
// ---------------------------------------------------------------------

export async function fetchGalleryPhotos(albumId: number): Promise<GalleryPhoto[]> {
  const { data, error } = await supabase
    .from("gallery_photos")
    .select("*")
    .eq("album_id", albumId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addGalleryPhoto(
  albumId: number,
  file: File,
  caption?: string,
): Promise<GalleryPhoto> {
  const imageUrl = await uploadClubPhoto(`gallery/${albumId}/photos`, file);
  const { data, error } = await supabase
    .from("gallery_photos")
    .insert({ album_id: albumId, image_url: imageUrl, caption: caption || null })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGalleryPhoto(photo: GalleryPhoto): Promise<void> {
  const { error } = await supabase.from("gallery_photos").delete().eq("id", photo.id);
  if (error) throw error;
  await deleteClubPhotoByUrl(photo.image_url);
}
