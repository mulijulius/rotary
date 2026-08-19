import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Edit2, Trash2, ImagePlus, X, Loader2, Images } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  addGalleryPhoto,
  deleteGalleryPhoto,
  fetchGalleryPhotos,
  uploadClubPhoto,
  type GalleryPhoto,
} from "@/lib/content-photos";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/gallery")({
  component: AdminGallery,
});

type GalleryAlbum = Database["public"]["Tables"]["gallery_albums"]["Row"];

function AdminGallery() {
  const { role } = useAuth();
  const [albums, setAlbums] = useState<GalleryAlbum[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<GalleryAlbum | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    event_date: "",
    cover_image_url: "",
    published: true,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Photos for the album currently open in the dialog.
  const [albumPhotos, setAlbumPhotos] = useState<GalleryPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("gallery_albums")
      .select("*")
      .order("event_date", { ascending: false });
    if (error) {
      console.error("[admin/gallery] failed to load", error);
      toast.error("Couldn't load gallery albums.");
      return;
    }
    setAlbums(data);
  }

  async function loadAlbumPhotos(albumId: number) {
    try {
      setAlbumPhotos(await fetchGalleryPhotos(albumId));
    } catch (err) {
      console.error("[admin/gallery] failed to load photos", err);
      toast.error("Couldn't load album photos.");
    }
  }

  function handleOpenDialog(album?: GalleryAlbum) {
    if (album) {
      setEditingAlbum(album);
      setFormData({
        title: album.title,
        event_date: album.event_date || "",
        cover_image_url: album.cover_image_url || "",
        published: album.published,
      });
      loadAlbumPhotos(album.id);
    } else {
      setEditingAlbum(null);
      setFormData({
        title: "",
        event_date: new Date().toISOString().slice(0, 10),
        cover_image_url: "",
        published: true,
      });
      setAlbumPhotos([]);
    }
    setCoverFile(null);
    setCoverPreview(null);
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingAlbum(null);
    setCoverFile(null);
    setCoverPreview(null);
    setAlbumPhotos([]);
  }

  function handleCoverSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function uploadCoverIfNeeded(albumId: number): Promise<string | null> {
    if (!coverFile) return formData.cover_image_url || null;
    setUploadingCover(true);
    try {
      return await uploadClubPhoto(`gallery/${albumId}`, coverFile);
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSaveAlbum() {
    if (!formData.title) {
      toast.error("Please enter an album title.");
      return;
    }

    setBusyId("save");
    try {
      if (editingAlbum) {
        const coverUrl = await uploadCoverIfNeeded(editingAlbum.id);
        const { error } = await supabase
          .from("gallery_albums")
          .update({
            title: formData.title,
            event_date: formData.event_date || null,
            cover_image_url: coverUrl,
            published: formData.published,
          })
          .eq("id", editingAlbum.id);
        if (error) throw error;
        toast.success("Album updated.");
      } else {
        const { data: inserted, error } = await supabase
          .from("gallery_albums")
          .insert({
            title: formData.title,
            event_date: formData.event_date || null,
            cover_image_url: null,
            published: formData.published,
          })
          .select()
          .single();
        if (error) throw error;

        if (coverFile && inserted) {
          const coverUrl = await uploadCoverIfNeeded(inserted.id);
          if (coverUrl) {
            const { error: coverErr } = await supabase
              .from("gallery_albums")
              .update({ cover_image_url: coverUrl })
              .eq("id", inserted.id);
            if (coverErr) console.error("[admin/gallery] cover attach error", coverErr);
          }
        }
        toast.success("Album created. Reopen it to add photos.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/gallery] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save album.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddAlbumPhoto(file: File | null) {
    if (!file || !editingAlbum) return;
    setUploadingPhoto(true);
    try {
      const photo = await addGalleryPhoto(editingAlbum.id, file);
      setAlbumPhotos((prev) => [...prev, photo]);
      toast.success("Photo added.");
    } catch (err) {
      console.error("[admin/gallery] add photo error", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleDeleteAlbumPhoto(photo: GalleryPhoto) {
    if (!confirm("Remove this photo from the album?")) return;
    try {
      await deleteGalleryPhoto(photo);
      setAlbumPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      toast.success("Photo removed.");
    } catch (err) {
      console.error("[admin/gallery] delete photo error", err);
      toast.error("Failed to remove photo.");
    }
  }

  async function handleTogglePublish(album: GalleryAlbum) {
    setBusyId(album.id.toString());
    try {
      const { error } = await supabase
        .from("gallery_albums")
        .update({ published: !album.published })
        .eq("id", album.id);
      if (error) throw error;
      toast.success(album.published ? "Album hidden." : "Album published.");
      load();
    } catch (err) {
      console.error("[admin/gallery] toggle publish error", err);
      toast.error("Failed to update album status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(album: GalleryAlbum) {
    if (!confirm("Delete this album and all its photos? This cannot be undone.")) return;
    setBusyId(album.id.toString());
    try {
      const { error } = await supabase.from("gallery_albums").delete().eq("id", album.id);
      if (error) throw error;
      toast.success("Album deleted.");
      load();
    } catch (err) {
      console.error("[admin/gallery] delete error", err);
      toast.error("Failed to delete album.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "editor"].includes(role)) {
    return (
      <div className="text-muted-foreground">You don't have access to gallery management.</div>
    );
  }

  const displayCover = coverPreview ?? formData.cover_image_url;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage photo albums from events and projects.
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Album
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAlbum ? "Edit Album" : "Create Album"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Album Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Annual Gala 2024"
                />
              </div>
              <div>
                <Label htmlFor="eventDate">Event Date</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Cover Image</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  {displayCover ? (
                    <img
                      src={displayCover}
                      alt="Cover preview"
                      className="h-16 w-24 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                      <ImagePlus className="h-5 w-5" />
                    </div>
                  )}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCoverSelected(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {uploadingCover ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {displayCover ? "Change" : "Upload"}
                  </Button>
                </div>
              </div>

              {editingAlbum && (
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Images className="h-3.5 w-3.5" /> Album Photos
                  </Label>
                  <div className="mt-1.5 grid grid-cols-4 gap-2">
                    {albumPhotos.map((p) => (
                      <div
                        key={p.id}
                        className="group relative aspect-square overflow-hidden rounded-md border border-border"
                      >
                        <img
                          src={p.image_url}
                          alt={p.caption || ""}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteAlbumPhoto(p)}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          title="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAddAlbumPhoto(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
              )}
              {!editingAlbum && (
                <p className="text-xs text-muted-foreground">
                  Save the album first, then reopen it to add photos.
                </p>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, published: checked === true })
                  }
                />
                <Label htmlFor="published" className="cursor-pointer">
                  Published (visible to public)
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveAlbum}
                  disabled={busyId === "save" || uploadingCover}
                  className="flex-1"
                >
                  {uploadingCover
                    ? "Uploading…"
                    : busyId === "save"
                      ? "Saving…"
                      : `${editingAlbum ? "Update" : "Create"} Album`}
                </Button>
                <Button variant="outline" onClick={handleCloseDialog} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Album Title</TableHead>
              <TableHead>Event Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {albums === null && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {albums?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No albums yet.
                </TableCell>
              </TableRow>
            )}
            {albums?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    {a.cover_image_url && (
                      <img
                        src={a.cover_image_url}
                        alt=""
                        className="h-8 w-12 rounded object-cover"
                      />
                    )}
                    {a.title}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.event_date ? new Date(a.event_date).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-sm">{a.published ? "Published" : "Private"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleOpenDialog(a)}
                      title="Edit"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleTogglePublish(a)}
                      disabled={busyId === a.id.toString()}
                      className="px-2 py-1 text-xs rounded border transition-colors disabled:opacity-50"
                    >
                      {a.published ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      disabled={busyId === a.id.toString()}
                      title="Delete"
                      className="p-1 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
