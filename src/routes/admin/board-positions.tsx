import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, FileText, Upload, Download, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUnsavedFormGuard } from "@/lib/unsaved-form-tracker";
import { loadDraft, saveDraft, clearDraft } from "@/lib/persisted-draft";
import {
  fetchBoardPositionDocuments,
  addBoardPositionDocument,
  deleteClubDocument,
  getClubDocumentUrl,
  formatFileSize,
  type ClubDocument,
} from "@/lib/club-documents";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/board-positions")({
  component: AdminBoardPositions,
});

type BoardPosition = Database["public"]["Tables"]["board_positions"]["Row"];
type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"];
type Member = Database["public"]["Tables"]["members"]["Row"];

// Keyed per-position so a restored draft only ever reappears in the same
// position's Documents dialog it was typed into.
function docDraftKey(positionId: number): string {
  return `admin-board-position-doc-${positionId}`;
}

type BoardPositionDocDraft = {
  docTitle: string;
  hadFile: boolean;
};

function AdminBoardPositions() {
  const { role, session } = useAuth();
  const [positions, setPositions] = useState<(BoardPosition & { fiscal_year_name: string; member_name: string })[] | null>(null);
  const [years, setYears] = useState<FiscalYear[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPosition, setEditingPosition] = useState<BoardPosition | null>(null);
  const [formData, setFormData] = useState({
    fiscal_year_id: 0,
    member_id: 0,
    title: "",
    bio: "",
    sort_order: 0,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const [docsPosition, setDocsPosition] = useState<(BoardPosition & { member_name: string }) | null>(null);
  const [docs, setDocs] = useState<ClubDocument[] | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  // True right after a draft was restored but the file itself — which
  // can't survive a mobile tab discard/reload (see
  // src/lib/persisted-draft.ts) — hasn't been reattached yet.
  const [restoredFilePending, setRestoredFilePending] = useState(false);

  useUnsavedFormGuard(Boolean(docTitle.trim() || docFile));
  const [docBusyId, setDocBusyId] = useState<number | null>(null);

  // Keep the draft saved as the user fills the dialog in, keyed to the
  // open position so it only restores into the same position's dialog.
  useEffect(() => {
    if (!docsPosition) return;
    const key = docDraftKey(docsPosition.id);
    if (!docTitle.trim() && !docFile && !restoredFilePending) {
      clearDraft(key);
      return;
    }
    saveDraft<BoardPositionDocDraft>(key, {
      docTitle,
      hadFile: Boolean(docFile) || restoredFilePending,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsPosition, docTitle, docFile, restoredFilePending]);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadPositions(parseInt(selectedYear));
    }
  }, [selectedYear]);

  async function loadYears() {
    const { data, error } = await supabase
      .from("fiscal_years")
      .select("*")
      .order("name", { ascending: false });
    if (error) {
      console.error("[admin/board-positions] failed to load years", error);
      return;
    }
    setYears(data);
    if (data.length > 0) {
      setSelectedYear(data[0]!.id.toString());
    }
  }

  async function loadPositions(yearId: number) {
    const { data, error } = await supabase
      .from("board_positions")
      .select(`*,fiscal_year:fiscal_years(name),member:members(first_name,last_name)`)
      .eq("fiscal_year_id", yearId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[admin/board-positions] failed to load", error);
      toast.error("Couldn't load board positions.");
      return;
    }
    setPositions(
      data.map((p: any) => ({
        ...p,
        fiscal_year_name: p.fiscal_year.name,
        member_name: `${p.member.first_name} ${p.member.last_name}`,
      }))
    );
  }

  async function loadMembers() {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("status", "active")
      .order("last_name", { ascending: true });
    if (error) {
      console.error("[admin/board-positions] failed to load members", error);
      return;
    }
    setMembers(data);
  }

  function handleOpenDialog(position?: BoardPosition) {
    loadMembers();
    if (position) {
      setEditingPosition(position);
      setFormData({
        fiscal_year_id: position.fiscal_year_id,
        member_id: position.member_id,
        title: position.title,
        bio: position.bio || "",
        sort_order: position.sort_order,
      });
    } else {
      setEditingPosition(null);
      setFormData({
        fiscal_year_id: parseInt(selectedYear),
        member_id: 0,
        title: "",
        bio: "",
        sort_order: 0,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingPosition(null);
  }

  async function handleSavePosition() {
    if (!formData.fiscal_year_id || !formData.member_id || !formData.title) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
      if (editingPosition) {
        const { error } = await supabase
          .from("board_positions")
          .update({
            fiscal_year_id: formData.fiscal_year_id,
            member_id: formData.member_id,
            title: formData.title,
            bio: formData.bio || null,
            sort_order: formData.sort_order,
          })
          .eq("id", editingPosition.id);
        if (error) throw error;
        toast.success("Board position updated.");
      } else {
        const { error } = await supabase.from("board_positions").insert({
          fiscal_year_id: formData.fiscal_year_id,
          member_id: formData.member_id,
          title: formData.title,
          bio: formData.bio || null,
          sort_order: formData.sort_order,
        });
        if (error) throw error;
        toast.success("Board position created.");
      }
      handleCloseDialog();
      loadPositions(formData.fiscal_year_id);
    } catch (err) {
      console.error("[admin/board-positions] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save board position.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(position: BoardPosition) {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setBusyId(position.id.toString());
    try {
      const { error } = await supabase
        .from("board_positions")
        .delete()
        .eq("id", position.id);
      if (error) throw error;
      toast.success("Board position deleted.");
      loadPositions(position.fiscal_year_id);
    } catch (err) {
      console.error("[admin/board-positions] delete error", err);
      toast.error("Failed to delete board position.");
    } finally {
      setBusyId(null);
    }
  }

  function handleOpenDocsDialog(position: BoardPosition & { member_name: string }) {
    // Restore any in-progress draft for this position — see
    // src/lib/persisted-draft.ts: opening the native file picker on
    // mobile can get this dialog's whole page reloaded from scratch by
    // the browser before the upload finishes, which would otherwise
    // silently wipe the title and lose track of the file.
    const draft = loadDraft<BoardPositionDocDraft>(docDraftKey(position.id));
    setDocsPosition(position);
    setDocTitle(draft?.docTitle ?? "");
    setDocFile(null);
    setRestoredFilePending(Boolean(draft?.hadFile));
    if (draft?.hadFile) {
      toast.message("Your form was restored, but the file needs reattaching.", {
        description: "The browser reloaded this page in the background — pick the file again before uploading.",
        duration: 10000,
      });
    }
    setDocs(null);
    loadDocs(position.id);
  }

  function handleCloseDocsDialog() {
    if (docsPosition) clearDraft(docDraftKey(docsPosition.id));
    setDocsPosition(null);
    setDocs(null);
    setDocTitle("");
    setDocFile(null);
    setRestoredFilePending(false);
  }

  async function loadDocs(boardPositionId: number) {
    try {
      const data = await fetchBoardPositionDocuments(boardPositionId);
      setDocs(data);
    } catch (err) {
      console.error("[admin/board-positions] failed to load documents", err);
      toast.error("Couldn't load documents.");
      setDocs([]);
    }
  }

  function handleDocFileChange(file: File | null) {
    if (file && file.size > 15 * 1024 * 1024) {
      toast.error("File must be under 15MB.");
      return;
    }
    setDocFile(file);
    // A real file was (re)attached, so the "needs reattaching" notice no
    // longer applies.
    if (file) setRestoredFilePending(false);
  }

  async function handleUploadDoc() {
    if (!docsPosition) return;
    if (!docTitle.trim()) {
      toast.error("Give the document a title (e.g. \"Meeting minutes – 12 Aug 2026\").");
      return;
    }
    if (!docFile) {
      toast.error("Choose a file to upload.");
      return;
    }
    setUploadingDoc(true);
    try {
      const doc = await addBoardPositionDocument(docsPosition.id, docFile, docTitle.trim(), session?.user.id ?? null);
      setDocs((prev) => [doc, ...(prev || [])]);
      clearDraft(docDraftKey(docsPosition.id));
      setDocTitle("");
      setDocFile(null);
      setRestoredFilePending(false);
      toast.success("Document uploaded.");
    } catch (err) {
      console.error("[admin/board-positions] document upload error", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleViewDoc(doc: ClubDocument) {
    setDocBusyId(doc.id);
    try {
      const url = await getClubDocumentUrl(doc.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("[admin/board-positions] document view error", err);
      toast.error("Couldn't open the document.");
    } finally {
      setDocBusyId(null);
    }
  }

  async function handleDeleteDoc(doc: ClubDocument) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    setDocBusyId(doc.id);
    try {
      await deleteClubDocument(doc);
      setDocs((prev) => (prev || []).filter((d) => d.id !== doc.id));
      toast.success("Document deleted.");
    } catch (err) {
      console.error("[admin/board-positions] document delete error", err);
      toast.error("Failed to delete document.");
    } finally {
      setDocBusyId(null);
    }
  }

  if (role && !["admin", "secretary"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to board position management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Board Positions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage leadership positions and member bios.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Position
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-96 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPosition ? "Edit Board Position" : "Add Board Position"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="yearSelect">Fiscal Year *</Label>
                <Select
                  value={formData.fiscal_year_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, fiscal_year_id: parseInt(v) })}
                >
                  <SelectTrigger id="yearSelect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years?.map((y) => (
                      <SelectItem key={y.id} value={y.id.toString()}>
                        {y.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="memberSelect">Member *</Label>
                <Select
                  value={formData.member_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, member_id: parseInt(v) })}
                >
                  <SelectTrigger id="memberSelect">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members?.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.first_name} {m.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="President"
                />
              </div>
              <div>
                <Label htmlFor="bio">Biography</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Brief biography for the public board page..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSavePosition} disabled={busyId === "save"} className="flex-1">
                  {editingPosition ? "Update" : "Add"} Position
                </Button>
                <Button variant="outline" onClick={handleCloseDialog} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        <Label>Filter by Fiscal Year</Label>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years?.map((y) => (
              <SelectItem key={y.id} value={y.id.toString()}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions === null && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {positions?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No board positions for this fiscal year.
                </TableCell>
              </TableRow>
            )}
            {positions?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold text-foreground">{p.member_name}</TableCell>
                <TableCell className="text-sm font-medium">{p.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{p.bio}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.sort_order}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleOpenDocsDialog(p)}
                      title="Documents"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDialog(p)}
                      title="Edit"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
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

      <Dialog open={!!docsPosition} onOpenChange={(open) => !open && handleCloseDocsDialog()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Documents{docsPosition ? ` — ${docsPosition.title} (${docsPosition.member_name})` : ""}
            </DialogTitle>
          </DialogHeader>
          {docsPosition && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Meeting minutes, handover notes, or any other document tied to this position. Any signed-in member
                can view or download what's uploaded here.
              </p>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="docTitle">Title *</Label>
                  <Input
                    id="docTitle"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder='e.g. "Meeting minutes – 12 Aug 2026"'
                  />
                </div>
                {docFile ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{docFile.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(docFile.size)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDocFileChange(null)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {restoredFilePending && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                        Your title was restored, but the file wasn't — your browser reloaded this tab in the
                        background. Please choose the file again.
                      </p>
                    )}
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors">
                      <Upload className="h-4 w-4" />
                      Choose a file
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleDocFileChange(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                )}
                <Button onClick={handleUploadDoc} disabled={uploadingDoc} size="sm" className="w-full gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingDoc ? "Uploading…" : "Upload Document"}
                </Button>
              </div>

              <div className="space-y-2">
                {docs === null && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
                {docs?.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
                )}
                {docs?.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {doc.file_name}
                          {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""} ·{" "}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handleViewDoc(doc)}
                        disabled={docBusyId === doc.id}
                        title="View / download"
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc)}
                        disabled={docBusyId === doc.id}
                        title="Delete"
                        className="p-1 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={handleCloseDocsDialog} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
