import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Edit2, Trash2, Zap, ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  addProjectPhoto,
  deleteProjectPhoto,
  fetchProjectPhotos,
  uploadClubPhoto,
  type ProjectPhoto,
} from "@/lib/content-photos";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/projects")({
  component: AdminProjects,
});

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectStatus = Database["public"]["Enums"]["project_status"];

const PROJECT_STATUSES: ProjectStatus[] = ["planned", "ongoing", "completed"];

function AdminProjects() {
  const { role } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    area_of_focus: "",
    summary: "",
    story: "",
    status: "planned" as ProjectStatus,
    start_date: "",
    end_date: "",
    budget_amount: "",
    fund_id: null as number | null,
    cover_image_url: "",
    published: false,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Photo gallery for the project currently being edited (only available
  // once the project has an id — i.e. not while creating a brand new one).
  const [galleryPhotos, setGalleryPhotos] = useState<ProjectPhoto[]>([]);
  const [uploadingGalleryPhoto, setUploadingGalleryPhoto] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/projects] failed to load", error);
      toast.error("Couldn't load projects.");
      return;
    }
    setProjects(data);
  }

  async function loadGalleryPhotos(projectId: number) {
    try {
      setGalleryPhotos(await fetchProjectPhotos(projectId));
    } catch (err) {
      console.error("[admin/projects] failed to load photos", err);
      toast.error("Couldn't load project photos.");
    }
  }

  function handleOpenDialog(project?: Project) {
    if (project) {
      setEditingProject(project);
      setFormData({
        title: project.title,
        slug: project.slug,
        area_of_focus: project.area_of_focus,
        summary: project.summary || "",
        story: project.story || "",
        status: project.status,
        start_date: project.start_date || "",
        end_date: project.end_date || "",
        budget_amount: project.budget_amount?.toString() || "",
        fund_id: project.fund_id,
        cover_image_url: project.cover_image_url || "",
        published: project.published,
      });
      loadGalleryPhotos(project.id);
    } else {
      setEditingProject(null);
      setFormData({
        title: "",
        slug: "",
        area_of_focus: "",
        summary: "",
        story: "",
        status: "planned",
        start_date: "",
        end_date: "",
        budget_amount: "",
        fund_id: null,
        cover_image_url: "",
        published: false,
      });
      setGalleryPhotos([]);
    }
    setCoverFile(null);
    setCoverPreview(null);
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingProject(null);
    setCoverFile(null);
    setCoverPreview(null);
    setGalleryPhotos([]);
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

  async function uploadCoverIfNeeded(projectId: number): Promise<string | null> {
    if (!coverFile) return formData.cover_image_url || null;
    setUploadingCover(true);
    try {
      return await uploadClubPhoto(`projects/${projectId}`, coverFile);
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSaveProject() {
    if (!formData.title || !formData.slug || !formData.area_of_focus) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
      if (editingProject) {
        const coverUrl = await uploadCoverIfNeeded(editingProject.id);
        const { error } = await supabase
          .from("projects")
          .update({
            title: formData.title,
            slug: formData.slug,
            area_of_focus: formData.area_of_focus,
            summary: formData.summary || null,
            story: formData.story || null,
            status: formData.status,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : null,
            fund_id: formData.fund_id,
            cover_image_url: coverUrl,
            published: formData.published,
          })
          .eq("id", editingProject.id);
        if (error) throw error;
        toast.success("Project updated.");
      } else {
        const { data: inserted, error } = await supabase
          .from("projects")
          .insert({
            title: formData.title,
            slug: formData.slug,
            area_of_focus: formData.area_of_focus,
            summary: formData.summary || null,
            story: formData.story || null,
            status: formData.status,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : null,
            fund_id: formData.fund_id,
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
              .from("projects")
              .update({ cover_image_url: coverUrl })
              .eq("id", inserted.id);
            if (coverErr) console.error("[admin/projects] cover attach error", coverErr);
          }
        }
        toast.success("Project created. Reopen it to add gallery photos.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/projects] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save project.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddGalleryPhoto(file: File | null) {
    if (!file || !editingProject) return;
    setUploadingGalleryPhoto(true);
    try {
      const photo = await addProjectPhoto(editingProject.id, file);
      setGalleryPhotos((prev) => [...prev, photo]);
      toast.success("Photo added.");
    } catch (err) {
      console.error("[admin/projects] add photo error", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setUploadingGalleryPhoto(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  async function handleDeleteGalleryPhoto(photo: ProjectPhoto) {
    if (!confirm("Remove this photo from the project gallery?")) return;
    try {
      await deleteProjectPhoto(photo);
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      toast.success("Photo removed.");
    } catch (err) {
      console.error("[admin/projects] delete photo error", err);
      toast.error("Failed to remove photo.");
    }
  }

  async function handleTogglePublish(project: Project) {
    setBusyId(project.id.toString());
    try {
      const { error } = await supabase
        .from("projects")
        .update({ published: !project.published })
        .eq("id", project.id);
      if (error) throw error;
      toast.success(project.published ? "Project unpublished." : "Project published.");
      load();
    } catch (err) {
      console.error("[admin/projects] toggle publish error", err);
      toast.error("Failed to update project status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(project: Project) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setBusyId(project.id.toString());
    try {
      const { error } = await supabase.from("projects").delete().eq("id", project.id);
      if (error) throw error;
      toast.success("Project deleted.");
      load();
    } catch (err) {
      console.error("[admin/projects] delete error", err);
      toast.error("Failed to delete project.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "editor"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to projects.</div>;
  }

  const displayCover = coverPreview ?? formData.cover_image_url;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage community impact projects.
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Community Water Project"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="community-water-project"
                />
              </div>
              <div>
                <Label htmlFor="areaOfFocus">Area of Focus *</Label>
                <Input
                  id="areaOfFocus"
                  value={formData.area_of_focus}
                  onChange={(e) => setFormData({ ...formData, area_of_focus: e.target.value })}
                  placeholder="Water and Sanitation"
                />
              </div>
              <div>
                <Label htmlFor="summary">Summary (280 chars)</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) =>
                    setFormData({ ...formData, summary: e.target.value.slice(0, 280) })
                  }
                  placeholder="Brief description of the project..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="story">Project Story</Label>
                <Textarea
                  id="story"
                  value={formData.story}
                  onChange={(e) => setFormData({ ...formData, story: e.target.value })}
                  placeholder="Detailed story and impact..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as ProjectStatus })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="budget">Budget Amount</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    value={formData.budget_amount}
                    onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
                    placeholder="10000.00"
                  />
                </div>
              </div>

              {/* Cover image */}
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

              {/* Photo gallery — only once the project has an id */}
              {editingProject && (
                <div>
                  <Label>Project Photo Gallery</Label>
                  <div className="mt-1.5 grid grid-cols-4 gap-2">
                    {galleryPhotos.map((p) => (
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
                          onClick={() => handleDeleteGalleryPhoto(p)}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          title="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={uploadingGalleryPhoto}
                      className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {uploadingGalleryPhoto ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}
                    </button>
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAddGalleryPhoto(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    These appear in the project's photo gallery on the public Projects page.
                  </p>
                </div>
              )}
              {!editingProject && (
                <p className="text-xs text-muted-foreground">
                  Save the project first, then reopen it to add gallery photos.
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
                  onClick={handleSaveProject}
                  disabled={busyId === "save" || uploadingCover}
                  className="flex-1"
                >
                  {uploadingCover
                    ? "Uploading…"
                    : busyId === "save"
                      ? "Saving…"
                      : `${editingProject ? "Update" : "Create"} Project`}
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
              <TableHead>Title</TableHead>
              <TableHead>Area of Focus</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects === null && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {projects?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No projects yet.
                </TableCell>
              </TableRow>
            )}
            {projects?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    {p.cover_image_url && (
                      <img
                        src={p.cover_image_url}
                        alt=""
                        className="h-8 w-12 rounded object-cover"
                      />
                    )}
                    {p.title}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.area_of_focus}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "completed" ? "default" : "secondary"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-mono">
                  {p.budget_amount
                    ? `KES ${parseFloat(p.budget_amount.toString()).toFixed(2)}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={p.published ? "default" : "outline"}>
                    {p.published ? "Public" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleOpenDialog(p)}
                      title="Edit"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleTogglePublish(p)}
                      disabled={busyId === p.id.toString()}
                      title={p.published ? "Unpublish" : "Publish"}
                      className={`p-1 transition-colors disabled:opacity-50 ${p.published ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={busyId === p.id.toString()}
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
