import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Check, FileText } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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

export const Route = createFileRoute("/admin/journal-entries")({
  component: AdminJournalEntries,
});

type JournalEntry = Database["public"]["Tables"]["journal_entries"]["Row"];
type JESource = Database["public"]["Enums"]["je_source"];

const JE_SOURCES: JESource[] = ["manual", "invoice", "payment", "bill", "payroll", "adjustment", "opening_balance"];

function AdminJournalEntries() {
  const { role } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [formData, setFormData] = useState({
    entry_no: "",
    fiscal_year_id: 0,
    fund_id: 0,
    entry_date: new Date().toISOString().split("T")[0],
    memo: "",
    source_type: "manual" as JESource,
    is_posted: false,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false });
    if (error) {
      console.error("[admin/journal-entries] failed to load", error);
      toast.error("Couldn't load journal entries.");
      return;
    }
    setEntries(data);
  }

  function handleOpenDialog(entry?: JournalEntry) {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        entry_no: entry.entry_no,
        fiscal_year_id: entry.fiscal_year_id,
        fund_id: entry.fund_id,
        entry_date: entry.entry_date,
        memo: entry.memo || "",
        source_type: entry.source_type,
        is_posted: entry.is_posted,
      });
    } else {
      setEditingEntry(null);
      setFormData({
        entry_no: "",
        fiscal_year_id: 0,
        fund_id: 0,
        entry_date: new Date().toISOString().split("T")[0],
        memo: "",
        source_type: "manual",
        is_posted: false,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingEntry(null);
  }

  async function handleSaveEntry() {
    toast.info("Journal entries are typically created through invoice/payment workflows. Manual entries are advanced.");
  }

  async function handlePostEntry(entry: JournalEntry) {
    if (entry.is_posted) return;
    setBusyId(entry.id.toString());
    try {
      const { error } = await supabase
        .from("journal_entries")
        .update({ is_posted: true, posted_at: new Date().toISOString() })
        .eq("id", entry.id);
      if (error) throw error;
      toast.success("Journal entry posted.");
      load();
    } catch (err) {
      console.error("[admin/journal-entries] post error", err);
      toast.error("Failed to post entry.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to journal entries.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
          <p className="mt-1 text-sm text-muted-foreground">Record financial transactions and adjustments.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Journal Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                For now, create entries through invoice/payment workflows. Advanced manual entries coming soon.
              </p>
              <Button variant="outline" onClick={handleCloseDialog} className="w-full">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries === null && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {entries?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No journal entries yet.
                </TableCell>
              </TableRow>
            )}
            {entries?.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono font-semibold text-foreground">{e.entry_no}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.entry_date}</TableCell>
                <TableCell className="text-sm">{e.source_type}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{e.memo || "—"}</TableCell>
                <TableCell>
                  <Badge variant={e.is_posted ? "default" : "secondary"}>
                    {e.is_posted ? "Posted" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {!e.is_posted && (
                    <button
                      onClick={() => handlePostEntry(e)}
                      disabled={busyId === e.id.toString()}
                      title="Post entry"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
