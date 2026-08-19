import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Check, Trash2 } from "lucide-react";
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
type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"];
type Fund = Database["public"]["Tables"]["funds"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

interface LineDraft {
  account_id: number;
  description: string;
  debit: number;
  credit: number;
}

const emptyLine = (): LineDraft => ({ account_id: 0, description: "", debit: 0, credit: 0 });

function makeEntryNo() {
  // Client-side fallback number generator: prefix + date + short random suffix.
  // Uniqueness is enforced by the entry_no UNIQUE constraint in the DB;
  // if a collision ever occurs the insert will fail and the user can just retry.
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `JE-${y}${m}${d}-${rand}`;
}

function AdminJournalEntries() {
  const { role } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [formData, setFormData] = useState({
    fiscal_year_id: 0,
    fund_id: 0,
    entry_date: new Date().toISOString().slice(0, 10),
    memo: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
    loadReferenceData();
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

  async function loadReferenceData() {
    const [{ data: fy, error: fyErr }, { data: fu, error: fuErr }, { data: acc, error: accErr }] = await Promise.all([
      supabase.from("fiscal_years").select("*").order("start_date", { ascending: false }),
      supabase.from("funds").select("*").order("name", { ascending: true }),
      supabase.from("accounts").select("*").eq("is_active", true).order("code", { ascending: true }),
    ]);
    if (fyErr) console.error("[admin/journal-entries] fiscal years load error", fyErr);
    if (fuErr) console.error("[admin/journal-entries] funds load error", fuErr);
    if (accErr) console.error("[admin/journal-entries] accounts load error", accErr);
    setFiscalYears(fy || []);
    setFunds(fu || []);
    setAccounts(acc || []);
    setFormData((prev) => ({
      ...prev,
      fiscal_year_id: prev.fiscal_year_id || fy?.[0]?.id || 0,
      fund_id: prev.fund_id || fu?.[0]?.id || 0,
    }));
  }

  function handleOpenDialog() {
    setFormData({
      fiscal_year_id: fiscalYears[0]?.id || 0,
      fund_id: funds[0]?.id || 0,
      entry_date: new Date().toISOString().slice(0, 10),
      memo: "",
    });
    setLines([emptyLine(), emptyLine()]);
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  }

  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  async function handleSaveEntry() {
    if (!formData.fiscal_year_id || !formData.fund_id) {
      toast.error("Please select a fiscal year and fund.");
      return;
    }
    const validLines = lines.filter(
      (l) => l.account_id && (l.debit > 0 || l.credit > 0) && !(l.debit > 0 && l.credit > 0)
    );
    if (validLines.length < 2) {
      toast.error("Add at least two lines, each with an account and either a debit or a credit.");
      return;
    }
    if (!isBalanced) {
      toast.error("Debits must equal credits before saving.");
      return;
    }

    setSaving(true);
    try {
      const entryNo = makeEntryNo();
      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert({
          entry_no: entryNo,
          fiscal_year_id: formData.fiscal_year_id,
          fund_id: formData.fund_id,
          entry_date: formData.entry_date,
          memo: formData.memo || null,
          source_type: "manual",
          is_posted: false,
        })
        .select()
        .single();
      if (entryError) throw entryError;

      const { error: linesError } = await supabase.from("journal_lines").insert(
        validLines.map((l, idx) => ({
          journal_entry_id: entry.id,
          line_no: idx + 1,
          account_id: l.account_id,
          debit: l.debit || 0,
          credit: l.credit || 0,
          description: l.description || null,
        }))
      );
      if (linesError) throw linesError;

      toast.success("Journal entry created as a draft. Post it once you're ready.");
      setOpenDialog(false);
      load();
    } catch (err) {
      console.error("[admin/journal-entries] save error", err);
      toast.error("Failed to create journal entry.");
    } finally {
      setSaving(false);
    }
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
      toast.error("Failed to post entry. Make sure debits equal credits.");
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
            <Button onClick={handleOpenDialog} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Journal Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Fiscal Year *</Label>
                  <Select
                    value={formData.fiscal_year_id ? formData.fiscal_year_id.toString() : ""}
                    onValueChange={(v) => setFormData({ ...formData, fiscal_year_id: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fiscal year" />
                    </SelectTrigger>
                    <SelectContent>
                      {fiscalYears.map((fy) => (
                        <SelectItem key={fy.id} value={fy.id.toString()}>
                          {fy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fund *</Label>
                  <Select
                    value={formData.fund_id ? formData.fund_id.toString() : ""}
                    onValueChange={(v) => setFormData({ ...formData, fund_id: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fund" />
                    </SelectTrigger>
                    <SelectContent>
                      {funds.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Entry Date</Label>
                  <Input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Memo</Label>
                <Textarea
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="What is this entry for?"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Lines * (debits must equal credits)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
                    <Plus className="h-3 w-3" />
                    Add line
                  </Button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Select
                          value={line.account_id ? line.account_id.toString() : ""}
                          onValueChange={(v) => updateLine(idx, { account_id: parseInt(v) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id.toString()}>
                                {a.code} · {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Input
                          placeholder="Description"
                          value={line.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Debit"
                          value={line.debit || ""}
                          onChange={(e) =>
                            updateLine(idx, { debit: parseFloat(e.target.value) || 0, credit: 0 })
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Credit"
                          value={line.credit || ""}
                          onChange={(e) =>
                            updateLine(idx, { credit: parseFloat(e.target.value) || 0, debit: 0 })
                          }
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-end gap-6 text-sm font-semibold">
                  <span className="text-foreground">
                    Debits: {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-foreground">
                    Credits: {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className={isBalanced ? "text-green-600" : "text-destructive"}>
                    {isBalanced ? "Balanced" : "Not balanced"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCloseDialog} className="flex-1" disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEntry} className="flex-1" disabled={saving || !isBalanced}>
                  {saving ? "Saving…" : "Save as Draft"}
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
