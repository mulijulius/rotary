import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Eye, Send, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/admin/invoices")({
  component: AdminInvoices,
});

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
type Member = Database["public"]["Tables"]["members"]["Row"];
type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  issued: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
};

interface LineDraft {
  description: string;
  account_id: number;
  quantity: number;
  unit_price: number;
}

const emptyLine = (): LineDraft => ({ description: "", account_id: 0, quantity: 1, unit_price: 0 });

function makeDocNo(prefix: string) {
  // Client-side fallback number generator: prefix + date + short random suffix.
  // Uniqueness is enforced by the invoice_no/bill_no UNIQUE constraint in the DB;
  // if a collision ever occurs the insert will fail and the user can just retry.
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

function AdminInvoices() {
  const { role } = useAuth();
  const [invoices, setInvoices] = useState<(Invoice & { total?: number })[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    member_id: 0,
    fiscal_year_id: 0,
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    memo: "",
    status: "draft" as InvoiceStatus,
  });
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  useEffect(() => {
    load();
    loadReferenceData();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("invoices")
      .select(`*,member:members(first_name,last_name),invoice_lines(quantity,unit_price)`)
      .order("invoice_date", { ascending: false });
    if (error) {
      console.error("[admin/invoices] failed to load", error);
      toast.error("Couldn't load invoices.");
      return;
    }
    const withTotals = (data as any[]).map((inv) => ({
      ...inv,
      total: (inv.invoice_lines || []).reduce(
        (sum: number, l: any) => sum + Number(l.quantity) * Number(l.unit_price),
        0
      ),
    }));
    setInvoices(withTotals);
  }

  async function loadReferenceData() {
    const [{ data: m, error: mErr }, { data: fy, error: fyErr }, { data: acc, error: accErr }] = await Promise.all([
      supabase.from("members").select("*").order("first_name", { ascending: true }),
      supabase.from("fiscal_years").select("*").order("start_date", { ascending: false }),
      supabase.from("accounts").select("*").eq("is_active", true).order("code", { ascending: true }),
    ]);
    if (mErr) {
      console.error("[admin/invoices] members load error", mErr);
      toast.error(`Couldn't load members: ${mErr.message}`);
    } else if (!m || m.length === 0) {
      toast.info("No members found yet. Add members under Admin → Members first.");
    }
    if (fyErr) {
      console.error("[admin/invoices] fiscal years load error", fyErr);
      toast.error(`Couldn't load fiscal years: ${fyErr.message}`);
    } else if (!fy || fy.length === 0) {
      toast.info("No fiscal years found yet. Add one under Admin → Fiscal Years first.");
    }
    if (accErr) {
      console.error("[admin/invoices] accounts load error", accErr);
      toast.error(`Couldn't load accounts: ${accErr.message}`);
    } else if (!acc || acc.length === 0) {
      toast.info("No active accounts found yet.");
    }
    setMembers(m || []);
    setFiscalYears(fy || []);
    setAccounts(acc || []);
    if (fy && fy.length > 0) {
      setFormData((prev) => (prev.fiscal_year_id ? prev : { ...prev, fiscal_year_id: fy[0].id }));
    }
  }

  function handleOpenDialog() {
    setFormData({
      member_id: 0,
      fiscal_year_id: fiscalYears[0]?.id || 0,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
      memo: "",
      status: "draft",
    });
    setLines([emptyLine()]);
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
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const lineTotal = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);

  async function handleSaveInvoice() {
    if (!formData.member_id) {
      toast.error("Please select a member.");
      return;
    }
    if (!formData.fiscal_year_id) {
      toast.error("Please select a fiscal year.");
      return;
    }
    if (!formData.due_date) {
      toast.error("Please set a due date.");
      return;
    }
    const validLines = lines.filter((l) => l.description.trim() && l.account_id && l.unit_price > 0);
    if (validLines.length === 0) {
      toast.error("Add at least one line item with a description, account, and price.");
      return;
    }

    setSaving(true);
    try {
      const invoiceNo = makeDocNo("INV");
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          invoice_no: invoiceNo,
          member_id: formData.member_id,
          fiscal_year_id: formData.fiscal_year_id,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          memo: formData.memo || null,
          status: formData.status,
        })
        .select()
        .single();
      if (invError) throw invError;

      const { error: linesError } = await supabase.from("invoice_lines").insert(
        validLines.map((l) => ({
          invoice_id: invoice.id,
          description: l.description,
          account_id: l.account_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        }))
      );
      if (linesError) throw linesError;

      toast.success("Invoice created successfully.");
      setOpenDialog(false);
      load();
    } catch (err) {
      console.error("[admin/invoices] save error", err);
      toast.error("Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(invoice: Invoice, status: InvoiceStatus) {
    setBusyId(invoice.id.toString());
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", invoice.id);
      if (error) throw error;
      toast.success(`Invoice marked as ${status}.`);
      load();
    } catch (err) {
      console.error("[admin/invoices] update error", err);
      toast.error("Failed to update invoice.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to invoices.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage member invoices for dues and fundraisers.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Member *</Label>
                  <Select
                    value={formData.member_id ? formData.member_id.toString() : ""}
                    onValueChange={(v) => setFormData({ ...formData, member_id: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No members yet — add one under Admin → Members.
                        </div>
                      ) : (
                        members.map((m) => (
                          <SelectItem key={m.id} value={m.id.toString()}>
                            {m.first_name} {m.last_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
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
                      {fiscalYears.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No fiscal years yet — add one under Admin → Fiscal Years.
                        </div>
                      ) : (
                        fiscalYears.map((fy) => (
                          <SelectItem key={fy.id} value={fy.id.toString()}>
                            {fy.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Due Date *</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as InvoiceStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="issued">Issued</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Memo</Label>
                <Textarea
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="Optional note about this invoice"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Line Items *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
                    <Plus className="h-3 w-3" />
                    Add line
                  </Button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Input
                          placeholder="Description"
                          value={line.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                        />
                      </div>
                      <div className="col-span-3">
                        <Select
                          value={line.account_id ? line.account_id.toString() : ""}
                          onValueChange={(v) => updateLine(idx, { account_id: parseInt(v) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No accounts found.
                              </div>
                            ) : (
                              accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id.toString()}>
                                  {a.code} · {a.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Unit price"
                          value={line.unit_price}
                          onChange={(e) => updateLine(idx, { unit_price: parseFloat(e.target.value) || 0 })}
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
                <div className="mt-2 text-right text-sm font-semibold text-foreground">
                  Total: {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCloseDialog} className="flex-1" disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSaveInvoice} className="flex-1" disabled={saving}>
                  {saving ? "Saving…" : "Create Invoice"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Invoice No</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices === null && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {invoices?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
            {invoices?.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono font-semibold text-foreground">{inv.invoice_no}</TableCell>
                <TableCell className="font-semibold text-foreground">
                  {(inv as any).member?.first_name} {(inv as any).member?.last_name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(inv.invoice_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(inv.due_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-semibold">
                  {(inv.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[inv.status]}>
                    {inv.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      title="View"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {inv.status === "draft" && (
                      <button
                        title="Issue"
                        disabled={busyId === inv.id.toString()}
                        onClick={() => handleUpdateStatus(inv, "issued")}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
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
