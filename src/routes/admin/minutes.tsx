import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Upload, Download, Trash2, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUnsavedFormGuard } from "@/lib/unsaved-form-tracker";
import { loadDraft, saveDraft, clearDraft } from "@/lib/persisted-draft";
import {
  fetchClubDocuments,
  addClubDocument,
  deleteClubDocument,
  getClubDocumentUrl,
  formatFileSize,
  type ClubDocumentWithContext,
} from "@/lib/club-documents";
import type { Database } from "@/integrations/supabase/types";
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

export const Route = createFileRoute("/admin/minutes")({
  component: AdminMinutes,
});

type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"];

const DRAFT_KEY = "admin-minutes";

type MinutesDraft = {
  title: string;
  meetingDate: string;
  selectedYear: string;
  hadFile: boolean;
};

function AdminMinutes() {
  const { role, session } = useAuth();

  const [years, setYears] = useState<FiscalYear[] | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [minutes, setMinutes] = useState<ClubDocumentWithContext[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Restored synchronously on first render so the draft is never
  // momentarily blank before the effect below runs.
  const initialDraft = loadDraft<MinutesDraft>(DRAFT_KEY);
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [meetingDate, setMeetingDate] = useState(initialDraft?.meetingDate ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // True right after a draft was restored but the file itself — which
  // can't survive a tab discard/reload — hasn't been reattached yet.
  const [restoredFilePending, setRestoredFilePending] = useState(Boolean(initialDraft?.hadFile));

  useUnsavedFormGuard(Boolean(title.trim() || file));

  // Keep the lightweight, serializable parts of the draft saved as the
  // user fills the form in, and clear it once there's nothing to lose.
  useEffect(() => {
    if (!title.trim() && !meetingDate && !file && !restoredFilePending) {
      clearDraft(DRAFT_KEY);
      return;
    }
    saveDraft<MinutesDraft>(DRAFT_KEY, {
      title,
      meetingDate,
      selectedYear,
      hadFile: Boolean(file) || restoredFilePending,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, meetingDate, selectedYear, file, restoredFilePending]);

  useEffect(() => {
    loadYears();
    loadMinutes();
    if (initialDraft?.hadFile) {
      toast.message("Your form was restored, but the file needs reattaching.", {
        description: "The browser reloaded this page in the background — pick the file again before uploading.",
        duration: 10000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadYears() {
    const { data, error } = await supabase.from("fiscal_years").select("*").order("name", { ascending: false });
    if (error) {
      console.error("[admin/minutes] failed to load fiscal years", error);
      return;
    }
    setYears(data);
    if (data.length > 0) {
      const restored = initialDraft?.selectedYear;
      const stillValid = restored && data.some((y) => y.id.toString() === restored);
      setSelectedYear(stillValid ? restored! : data[0]!.id.toString());
    }
  }

  async function loadMinutes() {
    try {
      const data = await fetchClubDocuments({ category: "minutes" });
      setMinutes(data);
    } catch (err) {
      console.error("[admin/minutes] failed to load", err);
      toast.error("Couldn't load meeting minutes.");
      setMinutes([]);
    }
  }

  function handleFileChange(f: File | null) {
    if (f && f.size > 15 * 1024 * 1024) {
      toast.error("File must be under 15MB.");
      return;
    }
    setFile(f);
    // A real file was (re)attached, so the "needs reattaching" notice no
    // longer applies.
    if (f) setRestoredFilePending(false);
  }

  function resetForm() {
    setTitle("");
    setMeetingDate("");
    setFile(null);
    setRestoredFilePending(false);
    clearDraft(DRAFT_KEY);
  }

  async function handleUpload() {
    if (!title.trim()) {
      toast.error('Give the minutes a title (e.g. "Meeting minutes – 12 Aug 2026").');
      return;
    }
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    setUploading(true);
    try {
      const doc = await addClubDocument({
        file,
        title: title.trim(),
        uploadedBy: session?.user.id ?? null,
        category: "minutes",
        fiscalYearId: selectedYear ? parseInt(selectedYear) : null,
        documentDate: meetingDate || null,
      });
      const year = years?.find((y) => y.id.toString() === selectedYear);
      setMinutes((prev) => [
        {
          ...doc,
          position_title: null,
          uploader_position_first_name: null,
          uploader_position_last_name: null,
          fiscal_year_name: year?.name ?? null,
        } as ClubDocumentWithContext,
        ...(prev || []),
      ]);
      resetForm();
      toast.success("Minutes uploaded — now visible in Club Documents on every dashboard.");
    } catch (err) {
      console.error("[admin/minutes] upload error", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload minutes.");
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
      console.error("[admin/minutes] view error", err);
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
      setMinutes((prev) => (prev || []).filter((d) => d.id !== doc.id));
      toast.success("Minutes deleted.");
    } catch (err) {
      console.error("[admin/minutes] delete error", err);
      toast.error("Failed to delete minutes.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "secretary"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to meeting minutes.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Minutes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add meeting minutes here — they appear in Club Documents across every dashboard, viewable by any signed-in
        member.
      </p>

      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-foreground">Add meeting minutes</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="minutesTitle">Title *</Label>
            <Input
              id="minutesTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Meeting minutes – 12 Aug 2026"'
            />
          </div>
          <div>
            <Label htmlFor="minutesDate">Meeting date</Label>
            <Input id="minutesDate" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="minutesYear">Fiscal Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="minutesYear">
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
        </div>
        {file ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-2 text-sm">
            <span className="flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
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
          <div className="space-y-1.5">
            {restoredFilePending && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                Your title and date were restored, but the file wasn't — your browser reloaded this tab in the
                background. Please choose the file again.
              </p>
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors">
              <Upload className="h-4 w-4" />
              Choose a file
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        )}
        <Button onClick={handleUpload} disabled={uploading} size="sm" className="gap-2">
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Add Minutes"}
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Meeting Date</TableHead>
              <TableHead>Fiscal Year</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {minutes === null && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {minutes?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No meeting minutes uploaded yet.
                </TableCell>
              </TableRow>
            )}
            {minutes?.map((doc) => (
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
                <TableCell className="text-sm text-muted-foreground">
                  {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{doc.fiscal_year_name || "—"}</TableCell>
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
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={busyId === doc.id}
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
