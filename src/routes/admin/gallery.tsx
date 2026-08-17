import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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

  function handleOpenDialog(album?: GalleryAlbum) {
    if (album) {
      setEditingAlbum(album);
      setFormData({
        title: album.title,
        event_date: album.event_date || "",
        cover_image_url: album.cover_image_url || "",
        published: album.published,
      });
    } else {
      setEditingAlbum(null);
      setFormData({
        title: "",
        event_date: new Date().toISOString().split("T")[0],
        cover_image_url: "",
        published: true,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingAlbum(null);
  }

  async function handleSaveAlbum() {
    if (!formData.title) {
      toast.error("Please enter an album title.");
      return;
    }

    setBusyId("save");
    try {
      if (editingAlbum) {
        const { error } = await supabase
          .from("gallery_albums")
          .update({
            title: formData.title,
            event_date: formData.event_date || null,
            cover_image_url: formData.cover_image_url || null,
            published: formData.published,
          })
          .eq("id", editingAlbum.id);
        if (error) throw error;
        toast.success("Album updated.");
      } else {
        const { error } = await supabase.from("gallery_albums").insert({
          title: formData.title,
          event_date: formData.event_date || null,
          cover_image_url: formData.cover_image_url || null,
          published: formData.published,
        });
        if (error) throw error;
        toast.success("Album created.");
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
      const { error } = await supabase
        .from("gallery_albums")
        .delete()
        .eq("id", album.id);
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
    return <div className="text-muted-foreground">You don't have access to gallery management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage photo albums from events and projects.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Album
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                <Label htmlFor="coverImage">Cover Image URL</Label>
                <Input
                  id="coverImage"
                  value={formData.cover_image_url}
                  onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked === true })}
                />
                <Label htmlFor="published" className="cursor-pointer">Published (visible to public)</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveAlbum} disabled={busyId === "save"} className="flex-1">
                  {editingAlbum ? "Update" : "Create"} Album
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
                <TableCell className="font-semibold text-foreground">{a.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.event_date ? new Date(a.event_date).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {a.published ? "Published" : "Private"}
                </TableCell>
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

      <div className="mt-6 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
        <p className="font-semibold">Photo Upload Coming Soon</p>
        <p className="mt-1">Soon you'll be able to upload and manage individual photos within each album directly from this interface.</p>
      </div>
    </div>
  );
}
