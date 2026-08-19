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

export const Route = createFileRoute("/admin/bills")({
  component: AdminBills,
});

type Bill = Database["public"]["Tables"]["bills"]["Row"];
type BillStatus = Database["public"]["Enums"]["bill_status"];
type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

const STATUS_COLORS: Record<BillStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  received: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
};

interface LineDraft {
  description: string;
  account_id: number;
  amount: number;
}

const emptyLine = (): LineDraft => ({ description: "", account_id: 0, amount: 0 });

function makeDocNo(prefix: string) {
  // Client-side fallback number generator: prefix + date + short random suffix.
  // Uniqueness is enforced by the bill_no UNIQUE constraint in the DB;
  // if a collision ever occurs the insert will fail and the user can just retry.
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

function AdminBills() {
  const { role } = useAuth();
  const [bills, setBills] = useState<(Bill & { total?: number })[] | null>(null);
  const [paidByBill, setPaidByBill] = useState<Record<number, number>>({});

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newVendorMode, setNewVendorMode] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [formData, setFormData] = useState({
    vendor_id: 0,
    fiscal_year_id: 0,
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    memo: "",
    status: "draft" as BillStatus,
  });
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const [paymentBill, setPaymentBill] = useState<(Bill & { total?: number }) | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    method: "bank_transfer" as PaymentMethod,
    deposit_account_id: 0,
    amount: 0,
    reference: "",
  });
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [voidingId, setVoidingId] = useState<number | null>(null);

  const cashAccounts = useMemo(() => accounts.filter((a) => a.type === "asset"), [accounts]);

  useEffect(() => {
    load();
    loadReferenceData();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("bills")
      .select(`*,vendor:vendors(name),bill_lines(amount)`)
      .order("bill_date", { ascending: false });
    if (error) {
      console.error("[admin/bills] failed to load", error);
      toast.error("Couldn't load bills.");
      return;
    }
    const withTotals = (data as any[]).map((bill) => ({
      ...bill,
      total: (bill.bill_lines || []).reduce((sum: number, l: any) => sum + Number(l.amount), 0),
    }));
    setBills(withTotals);

    const { data: allocations, error: allocError } = await supabase
      .from("payment_allocations")
      .select("bill_id, amount_applied, payment:payments(voided)")
      .not("bill_id", "is", null);
    if (allocError) {
      console.error("[admin/bills] allocations load error", allocError);
    } else {
      const paid: Record<number, number> = {};
      for (const row of (allocations as any[]) || []) {
        if (row.payment?.voided) continue;
        paid[row.bill_id] = (paid[row.bill_id] || 0) + Number(row.amount_applied);
      }
      setPaidByBill(paid);
    }
  }

  async function loadReferenceData() {
    const [{ data: v, error: vErr }, { data: fy, error: fyErr }, { data: acc, error: accErr }] = await Promise.all([
      supabase.from("vendors").select("*").order("name", { ascending: true }),
      supabase.from("fiscal_years").select("*").order("start_date", { ascending: false }),
      supabase.from("accounts").select("*").eq("is_active", true).order("code", { ascending: true }),
    ]);
    if (vErr) console.error("[admin/bills] vendors load error", vErr);
    if (fyErr) console.error("[admin/bills] fiscal years load error", fyErr);
    if (accErr) console.error("[admin/bills] accounts load error", accErr);
    setVendors(v || []);
    setFiscalYears(fy || []);
    setAccounts(acc || []);
    if (fy && fy.length > 0) {
      setFormData((prev) => (prev.fiscal_year_id ? prev : { ...prev, fiscal_year_id: fy[0].id }));
    }
  }

  function handleOpenDialog() {
    setFormData({
      vendor_id: 0,
      fiscal_year_id: fiscalYears[0]?.id || 0,
      bill_date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
      memo: "",
      status: "draft",
    });
    setLines([emptyLine()]);
    setNewVendorMode(false);
    setNewVendorName("");
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

  const lineTotal = lines.reduce((sum, l) => sum + Number(l.amount || 0), 0);

  async function handleSaveBill() {
    if (!newVendorMode && !formData.vendor_id) {
      toast.error("Please select a vendor.");
      return;
    }
    if (newVendorMode && !newVendorName.trim()) {
      toast.error("Please enter a vendor name.");
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
    const validLines = lines.filter((l) => l.description.trim() && l.account_id && l.amount > 0);
    if (validLines.length === 0) {
      toast.error("Add at least one line item with a description, account, and amount.");
      return;
    }

    setSaving(true);
    try {
      let vendorId = formData.vendor_id;
      if (newVendorMode) {
        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .insert({ name: newVendorName.trim() })
          .select()
          .single();
        if (vendorError) throw vendorError;
        vendorId = vendor.id;
      }

      const billNo = makeDocNo("BILL");
      const { data: bill, error: billError } = await supabase
        .from("bills")
        .insert({
          bill_no: billNo,
          vendor_id: vendorId,
          fiscal_year_id: formData.fiscal_year_id,
          bill_date: formData.bill_date,
          due_date: formData.due_date,
          memo: formData.memo || null,
          status: formData.status,
        })
        .select()
        .single();
      if (billError) throw billError;

      const { error: linesError } = await supabase.from("bill_lines").insert(
        validLines.map((l) => ({
          bill_id: bill.id,
          description: l.description,
          account_id: l.account_id,
          amount: l.amount,
        }))
      );
      if (linesError) throw linesError;

      toast.success("Bill recorded successfully.");
      setOpenDialog(false);
      load();
      loadReferenceData();
    } catch (err) {
      console.error("[admin/bills] save error", err);
      toast.error("Failed to record bill.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenPaymentDialog(bill: Bill & { total?: number }) {
    const balance = (bill.total ?? 0) - (paidByBill[bill.id] || 0);
    setPaymentBill(bill);
    setPaymentForm({
      payment_date: new Date().toISOString().slice(0, 10),
      method: "bank_transfer",
      deposit_account_id: cashAccounts[0]?.id || 0,
      amount: Math.max(balance, 0),
      reference: "",
    });
  }

  function handleClosePaymentDialog() {
    setPaymentBill(null);
  }

  async function handleRecordPayment() {
    if (!paymentBill) return;
    if (!paymentForm.deposit_account_id) {
      toast.error("Please select the cash/bank account this was paid from.");
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
          payment_type: "disbursement",
          vendor_id: paymentBill.vendor_id,
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
        bill_id: paymentBill.id,
        amount_applied: paymentForm.amount,
      });
      if (allocError) throw allocError;

      toast.success("Payment recorded. Accounts Payable and cash have been updated.");
      handleClosePaymentDialog();
      load();
    } catch (err) {
      console.error("[admin/bills] payment error", err);
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function handleVoidBill(bill: Bill) {
    if (!confirm(`Void bill ${bill.bill_no}? This reverses its journal entry; it cannot be undone.`)) return;
    setVoidingId(bill.id);
    try {
      const { error } = await supabase.from("bills").update({ status: "void" }).eq("id", bill.id);
      if (error) throw error;
      toast.success("Bill voided and its journal entry reversed.");
      load();
    } catch (err) {
      console.error("[admin/bills] void error", err);
      toast.error(err instanceof Error ? err.message : "Failed to void bill.");
    } finally {
      setVoidingId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to bills.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bills (Accounts Payable)</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track vendor invoices and payments.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Record Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Bill</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Vendor *</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setNewVendorMode((v) => !v)}
                    >
                      {newVendorMode ? "Choose existing" : "Add new vendor"}
                    </button>
                  </div>
                  {newVendorMode ? (
                    <Input
                      placeholder="Vendor name"
                      value={newVendorName}
                      onChange={(e) => setNewVendorName(e.target.value)}
                    />
                  ) : (
                    <Select
                      value={formData.vendor_id ? formData.vendor_id.toString() : ""}
                      onValueChange={(v) => setFormData({ ...formData, vendor_id: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id.toString()}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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
                  <Label>Bill Date</Label>
                  <Input
                    type="date"
                    value={formData.bill_date}
                    onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
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
                    onValueChange={(v) => setFormData({ ...formData, status: v as BillStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Memo</Label>
                <Textarea
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="Optional note about this bill"
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
                      <div className="col-span-5">
                        <Input
                          placeholder="Description"
                          value={line.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                        />
                      </div>
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
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Amount"
                          value={line.amount}
                          onChange={(e) => updateLine(idx, { amount: parseFloat(e.target.value) || 0 })}
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
                <Button onClick={handleSaveBill} className="flex-1" disabled={saving}>
                  {saving ? "Saving…" : "Record Bill"}
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
              <TableHead className="whitespace-nowrap">Bill No</TableHead>
              <TableHead>Vendor</TableHead>
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
            {bills === null && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {bills?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No bills recorded yet.
                </TableCell>
              </TableRow>
            )}
            {bills?.map((bill) => {
              const total = bill.total ?? 0;
              const paid = paidByBill[bill.id] || 0;
              const balance = total - paid;
              const canPay = bill.journal_entry_id != null && bill.status !== "void" && bill.status !== "paid" && balance > 0;
              const canVoid = bill.status !== "void";
              return (
                <TableRow key={bill.id}>
                  <TableCell className="font-mono font-semibold text-foreground">{bill.bill_no}</TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {(bill as any).vendor?.name || "Unknown"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(bill.bill_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(bill.due_date).toLocaleDateString()}
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
                    <Badge className={STATUS_COLORS[bill.status]}>
                      {bill.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canPay && (
                        <button
                          title="Record payment"
                          onClick={() => handleOpenPaymentDialog(bill)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Banknote className="h-4 w-4" />
                        </button>
                      )}
                      {canVoid && (
                        <button
                          title="Void bill"
                          onClick={() => handleVoidBill(bill)}
                          disabled={voidingId === bill.id}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        title="View"
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
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

      <Dialog open={!!paymentBill} onOpenChange={(open) => !open && handleClosePaymentDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {paymentBill && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-semibold text-foreground">{paymentBill.bill_no}</p>
                <p className="text-muted-foreground">
                  Balance due: {((paymentBill.total ?? 0) - (paidByBill[paymentBill.id] || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                <Label>Paid From (Cash/Bank Account) *</Label>
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
