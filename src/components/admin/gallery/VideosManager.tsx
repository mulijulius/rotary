import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2, Video as VideoIcon, Youtube } from "lucide-react";
import { toast } from "sonner";

import {
  addUploadedVideo,
  addYouTubeVideo,
  deleteVideo,
  fetchVideos,
  updateVideo,
  type GalleryVideo,
} from "@/lib/slideshow-videos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type Mode = "upload" | "youtube";

export function VideosManager() {
  const [videos, setVideos] = useState<GalleryVideo[] | null>(null);
  const [mode, setMode] = useState<Mode>("youtube");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setVideos(await fetchVideos());
    } catch (err) {
      console.error("[admin/gallery/videos] failed to load", err);
      toast.error("Couldn't load videos.");
    }
  }

  function handleFileSelected(picked: File | null) {
    if (!picked) return;
    if (!picked.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    if (picked.size > 200 * 1024 * 1024) {
      toast.error("Video must be under 200MB.");
      return;
    }
    setFile(picked);
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setYoutubeInput("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAddVideo() {
    if (!title.trim()) {
      toast.error("Give the video a title.");
      return;
    }
    if (mode === "upload" && !file) {
      toast.error("Choose a video file to upload.");
      return;
    }
    if (mode === "youtube" && !youtubeInput.trim()) {
      toast.error("Paste a YouTube link or video ID.");
      return;
    }

    setSaving(true);
    try {
      const nextOrder =
        videos && videos.length > 0 ? Math.max(...videos.map((v) => v.sort_order)) + 1 : 0;
      const video =
        mode === "upload"
          ? await addUploadedVideo(
              file as File,
              title.trim(),
              description.trim() || null,
              nextOrder,
            )
          : await addYouTubeVideo(
              youtubeInput.trim(),
              title.trim(),
              description.trim() || null,
              nextOrder,
            );
      setVideos((prev) => [...(prev ?? []), video]);
      resetForm();
      toast.success("Video added.");
    } catch (err) {
      console.error("[admin/gallery/videos] add error", err);
      toast.error(err instanceof Error ? err.message : "Failed to add video.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(video: GalleryVideo) {
    setBusyId(video.id);
    try {
      const updated = await updateVideo(video.id, { published: !video.published });
      setVideos((prev) => prev?.map((v) => (v.id === video.id ? updated : v)) ?? null);
    } catch (err) {
      console.error("[admin/gallery/videos] toggle error", err);
      toast.error("Failed to update video.");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePlacementBlur(video: GalleryVideo, value: string) {
    if (value === (video.placement || "")) return;
    try {
      const updated = await updateVideo(video.id, { placement: value.trim() || null });
      setVideos((prev) => prev?.map((v) => (v.id === video.id ? updated : v)) ?? null);
    } catch (err) {
      console.error("[admin/gallery/videos] placement update error", err);
      toast.error("Failed to save placement tag.");
    }
  }

  async function handleDelete(video: GalleryVideo) {
    if (!confirm("Delete this video? This cannot be undone.")) return;
    setBusyId(video.id);
    try {
      await deleteVideo(video);
      setVideos((prev) => prev?.filter((v) => v.id !== video.id) ?? null);
      toast.success("Video deleted.");
    } catch (err) {
      console.error("[admin/gallery/videos] delete error", err);
      toast.error("Failed to delete video.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div>
        <h2 className="text-lg font-bold text-foreground">Videos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a video file or add a YouTube link. These aren't shown on any public page yet —
          that placement will be wired up later — but everything saved here is ready for it.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <Label>Add a video</Label>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "youtube" ? "default" : "outline"}
            onClick={() => setMode("youtube")}
            className="gap-1.5"
          >
            <Youtube className="h-3.5 w-3.5" /> YouTube Link
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "upload" ? "default" : "outline"}
            onClick={() => setMode("upload")}
            className="gap-1.5"
          >
            <VideoIcon className="h-3.5 w-3.5" /> Upload File
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="video-title">Title *</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Club Handwashing Day 2026"
            />
          </div>

          {mode === "youtube" ? (
            <div>
              <Label htmlFor="video-youtube">YouTube URL or video ID *</Label>
              <Input
                id="video-youtube"
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          ) : (
            <div>
              <Label>Video file * (under 200MB)</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Video
                </Button>
                {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="video-description">Description (optional)</Label>
            <Textarea
              id="video-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short note about this video"
              rows={2}
            />
          </div>

          <Button onClick={handleAddVideo} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Video
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {videos === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {videos?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No videos yet — add one above.
          </p>
        )}
        {videos?.map((video) => (
          <div
            key={video.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-start"
          >
            <div className="flex h-16 w-28 flex-none items-center justify-center overflow-hidden rounded-md bg-muted">
              {video.thumbnail_url ? (
                <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <VideoIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{video.title}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {video.source === "youtube" ? "YouTube" : "Uploaded"}
                </span>
              </div>
              {video.description && (
                <p className="mt-1 text-sm text-muted-foreground">{video.description}</p>
              )}
              <div className="mt-2 max-w-xs">
                <Label htmlFor={`placement-${video.id}`} className="text-xs text-muted-foreground">
                  Placement tag (optional — decide later where this appears)
                </Label>
                <Input
                  id={`placement-${video.id}`}
                  defaultValue={video.placement || ""}
                  placeholder="e.g. home_hero, events_page"
                  className="mt-1 h-8 text-sm"
                  onBlur={(e) => handlePlacementBlur(video, e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-none items-center gap-2 self-end sm:self-start">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id={`vid-pub-${video.id}`}
                  checked={video.published}
                  onCheckedChange={() => handleTogglePublish(video)}
                  disabled={busyId === video.id}
                />
                <Label htmlFor={`vid-pub-${video.id}`} className="cursor-pointer text-xs">
                  Live
                </Label>
              </div>
              <button
                type="button"
                title="Delete video"
                onClick={() => handleDelete(video)}
                disabled={busyId === video.id}
                className="p-1.5 text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
