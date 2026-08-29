import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2, ArrowUp, ArrowDown, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import {
  addSlide,
  deleteSlide,
  fetchSlides,
  updateSlide,
  type SlideshowSlide,
} from "@/lib/slideshow-videos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function SlideshowManager() {
  const [slides, setSlides] = useState<SlideshowSlide[] | null>(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setSlides(await fetchSlides());
    } catch (err) {
      console.error("[admin/gallery/slideshow] failed to load", err);
      toast.error("Couldn't load slideshow images.");
    }
  }

  function handleFileSelected(picked: File | null) {
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (picked.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  async function handleAddSlide() {
    if (!file) {
      toast.error("Choose an image to add.");
      return;
    }
    setUploading(true);
    try {
      const nextOrder =
        slides && slides.length > 0 ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 0;
      const slide = await addSlide(file, caption.trim() || null, nextOrder);
      setSlides((prev) => [...(prev ?? []), slide]);
      setCaption("");
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Slide added.");
    } catch (err) {
      console.error("[admin/gallery/slideshow] add error", err);
      toast.error(err instanceof Error ? err.message : "Failed to add slide.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCaptionBlur(slide: SlideshowSlide, value: string) {
    if (value === (slide.caption || "")) return;
    try {
      const updated = await updateSlide(slide.id, { caption: value.trim() || null });
      setSlides((prev) => prev?.map((s) => (s.id === slide.id ? updated : s)) ?? null);
    } catch (err) {
      console.error("[admin/gallery/slideshow] caption update error", err);
      toast.error("Failed to save caption.");
    }
  }

  async function handleTogglePublish(slide: SlideshowSlide) {
    setBusyId(slide.id);
    try {
      const updated = await updateSlide(slide.id, { published: !slide.published });
      setSlides((prev) => prev?.map((s) => (s.id === slide.id ? updated : s)) ?? null);
    } catch (err) {
      console.error("[admin/gallery/slideshow] toggle error", err);
      toast.error("Failed to update slide.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(slide: SlideshowSlide, direction: -1 | 1) {
    if (!slides) return;
    const sorted = [...slides].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.id === slide.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;

    setBusyId(slide.id);
    try {
      const [a, b] = await Promise.all([
        updateSlide(slide.id, { sort_order: swapWith.sort_order }),
        updateSlide(swapWith.id, { sort_order: slide.sort_order }),
      ]);
      setSlides((prev) => prev?.map((s) => (s.id === a.id ? a : s.id === b.id ? b : s)) ?? null);
    } catch (err) {
      console.error("[admin/gallery/slideshow] reorder error", err);
      toast.error("Failed to reorder slides.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(slide: SlideshowSlide) {
    if (!confirm("Remove this slide from the home page slideshow?")) return;
    setBusyId(slide.id);
    try {
      await deleteSlide(slide);
      setSlides((prev) => prev?.filter((s) => s.id !== slide.id) ?? null);
      toast.success("Slide removed.");
    } catch (err) {
      console.error("[admin/gallery/slideshow] delete error", err);
      toast.error("Failed to remove slide.");
    } finally {
      setBusyId(null);
    }
  }

  const sortedSlides = slides ? [...slides].sort((a, b) => a.sort_order - b.sort_order) : null;

  return (
    <div>
      <div>
        <h2 className="text-lg font-bold text-foreground">Home Page Slideshow</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Images shown in the auto-rotating slideshow just below the header on the public home page.
          Each image can carry its own foreground text, shown over that image.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <Label>Add a slide</Label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="h-16 w-24 rounded-md border border-border object-cover"
              />
            ) : (
              <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Image
            </Button>
          </div>
          <div className="flex-1">
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Foreground text for this slide (optional)"
            />
          </div>
          <Button
            onClick={handleAddSlide}
            disabled={uploading || !file}
            className="gap-2 sm:self-start"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Slide
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {sortedSlides === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {sortedSlides?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No slides yet — add one above.
          </p>
        )}
        {sortedSlides?.map((slide, i) => (
          <div
            key={slide.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center"
          >
            <img
              src={slide.image_url}
              alt=""
              className="h-16 w-28 flex-none rounded-md object-cover"
            />
            <div className="flex-1">
              <Input
                defaultValue={slide.caption || ""}
                placeholder="Foreground text for this slide"
                onBlur={(e) => handleCaptionBlur(slide, e.target.value)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {slide.published ? "Published" : "Hidden"}
              </p>
            </div>
            <div className="flex flex-none items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                title="Move up"
                onClick={() => handleMove(slide, -1)}
                disabled={busyId === slide.id || i === 0}
                className="p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Move down"
                onClick={() => handleMove(slide, 1)}
                disabled={busyId === slide.id || i === (sortedSlides?.length ?? 0) - 1}
                className="p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <div className="mx-1 flex items-center gap-1.5">
                <Checkbox
                  id={`pub-${slide.id}`}
                  checked={slide.published}
                  onCheckedChange={() => handleTogglePublish(slide)}
                  disabled={busyId === slide.id}
                />
                <Label htmlFor={`pub-${slide.id}`} className="cursor-pointer text-xs">
                  Live
                </Label>
              </div>
              <button
                type="button"
                title="Delete slide"
                onClick={() => handleDelete(slide)}
                disabled={busyId === slide.id}
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
