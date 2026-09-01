import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Upload, Download, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth, isOfficerRole } from "@/lib/auth";
import { useUnsavedFormGuard } from "@/lib/unsaved-form-tracker";
import {
  fetchClubDocuments,
  addClubDocument,
  deleteClubDocument,
  getClubDocumentUrl,
  formatFileSize,
  categoryLabel,
  type ClubDocumentWithContext,
  type ClubDocumentCategory,
} from "@/lib/club-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/club-documents")({
  component: AdminClubDocuments,
});

const CATEGORY_FILTERS: { value: string; label: string } = { value: "all", label: "All documents" };
const CATEGORIES: ClubDocumentCategory[] = ["general", "minutes", "handover", "financial", "other"];

function AdminClubDocuments() {
  const { role, session } = useAuth();
  const canUpload = isOfficerRole(role ?? null);

  const [docs, setDocs] = useState<ClubDocumentWithContext[] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<ClubDocumentCategory>("general");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useUnsavedFormGuard(Boolean(docTitle.trim() || docFile));

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await fetchClubDocuments();
      setDocs(data);
    } catch (err) {
      console.error("[admin/club-documents] failed to load", err);
      toast.error("Couldn't load club documents.");
      setDocs([]);
    }
  }

  const filtered = useMemo(() => {
    if (!docs) return null;
    if (categoryFilter === "all") return docs;
    return docs.filter((d) => d.category === categoryFilter);
  }, [docs, categoryFilter]);

  function handleFileChange(file: File | null) {
    if (file && file.size > 15 * 1024 * 1024) {
      toast.error("File must be under 15MB.");
      return;
    }
    setDocFile(file);
  }

  async function handleUpload() {
    if (!docTitle.trim()) {
      toast.error('Give the document a title (e.g. "AGM Notice – September 2026").');
      return;
    }
    if (!docFile) {
      toast.error("Choose a file to upload.");
      return;
    }
    setUploading(true);
    try {
      const doc = await addClubDocument({
        file: docFile,
        title: docTitle.trim(),
        uploadedBy: session?.user.id ?? null,
        category: docCategory,
      });
      setDocs((prev) => [
        {
          ...doc,
          position_title: null,
          uploader_position_first_name: null,
          uploader_position_last_name: null,
          fiscal_year_name: null,
        } as ClubDocumentWithContext,
        ...(prev || []),
      ]);
      setDocTitle("");
      setDocFile(null);
      toast.success("Document uploaded.");
    } catch (err) {
      console.error("[admin/club-documents] upload error", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleView(doc: ClubDocumentWithContext) {
    if (!doc.id || !doc.file_path) return;
    setBusyId(doc.id);
    try {
      const url = await getClubDocumentUrl(doc.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("[admin/club-documents] view error", err);
      toast.error("Couldn't open the document.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(doc: ClubDocumentWithContext) {
    if (!doc.id || !doc.file_path) return;
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    setBusyId(doc.id);
    try {
      await deleteClubDocument({ id: doc.id, file_path: doc.file_path });
      setDocs((prev) => (prev || []).filter((d) => d.id !== doc.id));
      toast.success("Document deleted.");
    } catch (err) {
      console.error("[admin/club-documents] delete error", err);
      toast.error("Failed to delete document.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Club Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Meeting minutes, handover notes, and other club documents. Any signed-in member can view or download —
          officers can also upload here.
        </p>
      </div>

      {canUpload && (
        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-foreground">Upload a club document</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="clubDocTitle">Title *</Label>
              <Input
                id="clubDocTitle"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder='e.g. "AGM Notice – September 2026"'
              />
            </div>
            <div>
              <Label htmlFor="clubDocCategory">Category</Label>
              <Select value={docCategory} onValueChange={(v) => setDocCategory(v as ClubDocumentCategory)}>
                <SelectTrigger id="clubDocCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                onClick={() => handleFileChange(null)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                title="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors">
              <Upload className="h-4 w-4" />
              Choose a file
              <input type="file" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
            </label>
          )}
          <Button onClick={handleUpload} disabled={uploading} size="sm" className="gap-2">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Upload Document"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Documents tied to a specific board position (e.g. a single officer's handover notes) can still be
            uploaded from that position's Documents dialog on the Board Positions page — they'll show up here too.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Label className="shrink-0">Filter</Label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATEGORY_FILTERS.value}>{CATEGORY_FILTERS.label}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {categoryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Position / Year</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered === null && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {filtered?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No documents yet.
                </TableCell>
              </TableRow>
            )}
            {filtered?.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.title}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {doc.file_name}
                    {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{categoryLabel(doc.category || "general")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {doc.position_title
                    ? `${doc.position_title}${
                        doc.uploader_position_first_name ? ` (${doc.uploader_position_first_name} ${doc.uploader_position_last_name ?? ""})` : ""
                      }`
                    : "—"}
                  {doc.fiscal_year_name ? ` · ${doc.fiscal_year_name}` : ""}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {doc.document_date
                    ? new Date(doc.document_date).toLocaleDateString()
                    : doc.created_at
                    ? new Date(doc.created_at).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleView(doc)}
                      disabled={busyId === doc.id}
                      title="View / download"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {canUpload && (
                      <button
                        onClick={() => handleDelete(doc)}
                        disabled={busyId === doc.id}
                        title="Delete"
                        className="p-1 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
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
