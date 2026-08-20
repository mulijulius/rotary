import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Eye, Trash2, Banknote, Ban } from "lucide-react";
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
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

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
  // Client-side fallback number generator. invoice_no/bill_no/payment_no
  // are all varchar(20) in the DB, so this format is sized to always fit:
  // "BILL-YYMMDDHHMMSS-RR" = 5 + 12 + 1 + 2 = 20 chars exactly (shorter
  // prefixes like "INV-"/"PMT-" leave a little more room). Uniqueness is
  // still enforced by the UNIQUE constraint in the DB; a second-level
  // timestamp plus a random tie-breaker makes same-day collisions
  // effectively impossible even across several documents created in
  // quick succession while testing.
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mo = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const hh = now.getHours().toString().padStart(2, "0");
  const mi = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 90 + 10);
  return `${prefix}-${yy}${mo}${d}${hh}${mi}${ss}-${rand}`;
}

function AdminInvoices() {
  const { role } = useAuth();
  const [invoices, setInvoices] = useState<(Invoice & { total?: number; member_name?: string })[] | null>(null);
  const [paidByInvoice, setPaidByInvoice] = useState<Record<number, number>>({});

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

  const [paymentInvoice, setPaymentInvoice] = useState<(Invoice & { total?: number }) | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    method: "cash" as PaymentMethod,
    deposit_account_id: 0,
    amount: 0,
    reference: "",
  });
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [voidingId, setVoidingId] = useState<number | null>(null);

  const cashAccounts = useMemo(() => accounts.filter((a) => a.type === "asset"), [accounts]);
  const incomeAccounts = useMemo(() => accounts.filter((a) => a.type === "income" || a.type === "asset"), [accounts]);

  useEffect(() => {
    load();
    loadReferenceData();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("invoices")
      .select(`*,member:members(first_name,last_name),invoice_lines(amount)`)
      .order("invoice_date", { ascending: false });
    if (error) {
      console.error("[admin/invoices] failed to load", error);
      toast.error("Couldn't load invoices.");
      return;
    }
    const withTotals = (data as any[]).map((inv) => ({
      ...inv,
      total: (inv.invoice_lines || []).reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0),
      member_name: inv.member ? `${inv.member.first_name} ${inv.member.last_name}` : "Unknown",
    }));
    setInvoices(withTotals);

    const { data: allocations, error: allocError } = await supabase
      .from("payment_allocations")
      .select("invoice_id, amount_applied, payment:payments(voided)")
      .not("invoice_id", "is", null);
    if (allocError) {
      console.error("[admin/invoices] allocations load error", allocError);
    } else {
      const paid: Record<number, number> = {};
      for (const row of (allocations as any[]) || []) {
        if (row.payment?.voided) continue;
        paid[row.invoice_id] = (paid[row.invoice_id] || 0) + Number(row.amount_applied);
      }
      setPaidByInvoice(paid);
    }
  }

  async function loadReferenceData() {
    const [
      { data: m, error: mErr },
      { data: fy, error: fyErr },
      { data: acc, error: accErr },
    ] = await Promise.all([
      supabase.from("members").select("*").order("first_name", { ascending: true }),
      supabase.from("fiscal_years").select("*").order("start_date", { ascending: false }),
      supabase.from("accounts").select("*").eq("is_active", true).order("code", { ascending: true }),
    ]);
    if (mErr) console.error("[admin/invoices] members load error", mErr);
    if (fyErr) console.error("[admin/invoices] fiscal years load error", fyErr);
    if (accErr) console.error("[admin/invoices] accounts load error", accErr);
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
    const validLines = lines.filter((l) => l.description.trim() && l.account_id && l.quantity > 0 && l.unit_price > 0);
    if (validLines.length === 0) {
      toast.error("Add at least one line item with a description, account, quantity, and unit price.");
      return;
    }

    setSaving(true);
    try {
      const invoiceNo = makeDocNo("INV");
      const { data: invoice, error: invoiceError } = await supabase
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
      if (invoiceError) throw invoiceError;

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

      toast.success("Invoice recorded successfully.");
      setOpenDialog(false);
      load();
    } catch (err) {
      console.error("[admin/invoices] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to record invoice.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenPaymentDialog(invoice: Invoice & { total?: number }) {
    const balance = (invoice.total ?? 0) - (paidByInvoice[invoice.id] || 0);
    setPaymentInvoice(invoice);
    setPaymentForm({
      payment_date: new Date().toISOString().slice(0, 10),
      method: "cash",
      deposit_account_id: cashAccounts[0]?.id || 0,
      amount: Math.max(balance, 0),
      reference: "",
    });
  }

  function handleClosePaymentDialog() {
    setPaymentInvoice(null);
  }

  async function handleRecordPayment() {
    if (!paymentInvoice) return;
    if (!paymentForm.deposit_account_id) {
      toast.error("Please select the cash/bank account this was received into.");
      return;
    }
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      toast.error("Please enter a payment amount greater than zero.");
      return;
    }
    setRecordingPayment(true);
    try {
      const paymentNo = makeDocNo("PMT");
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          payment_no: paymentNo,
          payment_type: "receipt",
          member_id: paymentInvoice.member_id,
          payment_date: paymentForm.payment_date,
          method: paymentForm.method,
          reference: paymentForm.reference || null,
          amount: paymentForm.amount,
          deposit_account_id: paymentForm.deposit_account_id,
        })
        .select()
        .single();
      if (paymentError) throw paymentError;

      const { error: allocError } = await supabase.from("payment_allocations").insert({
        payment_id: payment.id,
        invoice_id: paymentInvoice.id,
        amount_applied: paymentForm.amount,
      });
      if (allocError) throw allocError;

      toast.success("Payment recorded. Accounts Receivable and cash have been updated.");
      handleClosePaymentDialog();
      load();
    } catch (err) {
      console.error("[admin/invoices] payment error", err);
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function handleVoidInvoice(invoice: Invoice) {
    if (!confirm(`Void invoice ${invoice.invoice_no}? This reverses its journal entry; it cannot be undone.`)) return;
    setVoidingId(invoice.id);
    try {
      const { error } = await supabase.from("invoices").update({ status: "void" }).eq("id", invoice.id);
      if (error) throw error;
      toast.success("Invoice voided and its journal entry reversed.");
      load();
    } catch (err) {
      console.error("[admin/invoices] void error", err);
      toast.error(err instanceof Error ? err.message : "Failed to void invoice.");
    } finally {
      setVoidingId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to invoices.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices (Accounts Receivable)</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bill members and track what's owed to the club.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Invoice</DialogTitle>
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
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.first_name} {m.last_name}
                        </SelectItem>
                      ))}
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
                      {fiscalYears.map((fy) => (
                        <SelectItem key={fy.id} value={fy.id.toString()}>
                          {fy.name}
                        </SelectItem>
                      ))}
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
                            <SelectValue placeholder="Income account" />
                          </SelectTrigger>
                          <SelectContent>
                            {incomeAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id.toString()}>
                                {a.code} · {a.name}
                              </SelectItem>
                            ))}
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
                  {saving ? "Saving…" : "Save Invoice"}
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
              <TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices === null && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {invoices?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No invoices recorded yet.
                </TableCell>
              </TableRow>
            )}
            {invoices?.map((invoice) => {
              const total = invoice.total ?? 0;
              const paid = paidByInvoice[invoice.id] || 0;
              const balance = total - paid;
              const canPay =
                invoice.journal_entry_id != null && invoice.status !== "void" && invoice.status !== "paid" && balance > 0;
              const canVoid = invoice.status !== "void";
              return (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono font-semibold text-foreground">{invoice.invoice_no}</TableCell>
                  <TableCell className="font-semibold text-foreground">{invoice.member_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[invoice.status]}>{invoice.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canPay && (
                        <button
                          title="Record payment"
                          onClick={() => handleOpenPaymentDialog(invoice)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Banknote className="h-4 w-4" />
                        </button>
                      )}
                      {canVoid && (
                        <button
                          title="Void invoice"
                          onClick={() => handleVoidInvoice(invoice)}
                          disabled={voidingId === invoice.id}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      <button title="View" className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!paymentInvoice} onOpenChange={(open) => !open && handleClosePaymentDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {paymentInvoice && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-semibold text-foreground">{paymentInvoice.invoice_no}</p>
                <p className="text-muted-foreground">
                  Balance due:{" "}
                  {((paymentInvoice.total ?? 0) - (paidByInvoice[paymentInvoice.id] || 0)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Method</Label>
                  <Select
                    value={paymentForm.method}
                    onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v as PaymentMethod })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Deposit To (Cash/Bank Account) *</Label>
                <Select
                  value={paymentForm.deposit_account_id ? paymentForm.deposit_account_id.toString() : ""}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, deposit_account_id: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        {a.code} · {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Reference</Label>
                  <Input
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    placeholder="Cheque #, M-Pesa code..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClosePaymentDialog} className="flex-1" disabled={recordingPayment}>
                  Cancel
                </Button>
                <Button onClick={handleRecordPayment} className="flex-1" disabled={recordingPayment}>
                  {recordingPayment ? "Recording…" : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
