// Helpers for the two new Gallery > Slideshow sub-sections:
//   - Slideshow images (public home page hero slideshow), stored in
//     `slideshow_slides` with images in the existing `club-photos` bucket.
//   - Gallery videos (uploaded files or YouTube links), stored in
//     `gallery_videos` with uploaded files in the new `club-videos` bucket.
// See 20260828_020_home_slideshow_and_gallery_videos.sql for the schema,
// RLS and storage policies. Only officers (admin/treasurer/secretary/
// editor) can write — enforced by RLS/storage policies, not by this file.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { uploadClubPhoto, deleteClubPhotoByUrl } from "@/lib/content-photos";

export type SlideshowSlide = Database["public"]["Tables"]["slideshow_slides"]["Row"];
export type GalleryVideo = Database["public"]["Tables"]["gallery_videos"]["Row"];
export type VideoSource = Database["public"]["Enums"]["video_source"];

// ---------------------------------------------------------------------
// Home page slideshow (slideshow_slides)
// ---------------------------------------------------------------------

export async function fetchSlides(publishedOnly = false): Promise<SlideshowSlide[]> {
  let query = supabase
    .from("slideshow_slides")
    .select("*")
    .order("sort_order", { ascending: true });
  if (publishedOnly) query = query.eq("published", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addSlide(
  file: File,
  caption: string | null,
  sortOrder: number,
): Promise<SlideshowSlide> {
  const imageUrl = await uploadClubPhoto("slideshow", file);
  const { data, error } = await supabase
    .from("slideshow_slides")
    .insert({ image_url: imageUrl, caption: caption || null, sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSlide(
  id: number,
  fields: Partial<Pick<SlideshowSlide, "caption" | "sort_order" | "published">>,
): Promise<SlideshowSlide> {
  const { data, error } = await supabase
    .from("slideshow_slides")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSlide(slide: SlideshowSlide): Promise<void> {
  const { error } = await supabase.from("slideshow_slides").delete().eq("id", slide.id);
  if (error) throw error;
  await deleteClubPhotoByUrl(slide.image_url);
}

// ---------------------------------------------------------------------
// Gallery videos (gallery_videos) — upload or YouTube link
// ---------------------------------------------------------------------

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function assertIsVideoFile(file: File) {
  if (!file.type.startsWith("video/")) {
    throw new Error("Please choose a video file.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Video must be under 200MB.");
  }
}

// Uploads a video file into the `club-videos` bucket and returns its
// public URL.
export async function uploadClubVideo(file: File): Promise<string> {
  assertIsVideoFile(file);
  const ext = file.name.split(".").pop() || "mp4";
  const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("club-videos").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("club-videos").getPublicUrl(path);
  return data.publicUrl;
}

async function deleteClubVideoByUrl(publicUrl: string): Promise<void> {
  const marker = "/object/public/club-videos/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return; // e.g. a YouTube link — nothing in storage to remove
  const path = publicUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from("club-videos").remove([path]);
  if (error) console.error("[slideshow-videos] failed to delete storage object", error);
}

// Accepts a full YouTube URL (watch, youtu.be, shorts, embed) or a bare
// 11-char video ID and returns the video ID, or null if it doesn't look
// like YouTube at all.
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1) || null;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const match = url.pathname.match(/\/(embed|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[2] ?? null;
    }
  } catch {
    // not a valid URL at all
  }
  return null;
}

export function youtubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export async function fetchVideos(publishedOnly = false): Promise<GalleryVideo[]> {
  let query = supabase.from("gallery_videos").select("*").order("sort_order", { ascending: true });
  if (publishedOnly) query = query.eq("published", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addUploadedVideo(
  file: File,
  title: string,
  description: string | null,
  sortOrder: number,
): Promise<GalleryVideo> {
  const videoUrl = await uploadClubVideo(file);
  const { data, error } = await supabase
    .from("gallery_videos")
    .insert({
      title,
      description: description || null,
      source: "upload",
      video_url: videoUrl,
      thumbnail_url: null,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addYouTubeVideo(
  urlOrId: string,
  title: string,
  description: string | null,
  sortOrder: number,
): Promise<GalleryVideo> {
  const videoId = extractYouTubeId(urlOrId);
  if (!videoId) throw new Error("That doesn't look like a valid YouTube link or video ID.");
  const { data, error } = await supabase
    .from("gallery_videos")
    .insert({
      title,
      description: description || null,
      source: "youtube",
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail_url: youtubeThumbnail(videoId),
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateVideo(
  id: number,
  fields: Partial<
    Pick<GalleryVideo, "title" | "description" | "placement" | "sort_order" | "published">
  >,
): Promise<GalleryVideo> {
  const { data, error } = await supabase
    .from("gallery_videos")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVideo(video: GalleryVideo): Promise<void> {
  const { error } = await supabase.from("gallery_videos").delete().eq("id", video.id);
  if (error) throw error;
  if (video.source === "upload") await deleteClubVideoByUrl(video.video_url);
}
