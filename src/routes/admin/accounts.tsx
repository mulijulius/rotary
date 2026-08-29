import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/accounts")({
  component: AdminAccounts,
});

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type AccountType = Database["public"]["Enums"]["account_type"];
type NormalSide = Database["public"]["Enums"]["normal_side"];
type Fund = Database["public"]["Tables"]["funds"]["Row"];
type GlSettings = Database["public"]["Tables"]["gl_settings"]["Row"];

const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "income", "expense"];
const NORMAL_SIDES: NormalSide[] = ["debit", "credit"];

function AdminAccounts() {
  const { role } = useAuth();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "asset" as AccountType,
    normal_balance: "debit" as NormalSide,
    parent_account_id: null as number | null,
    is_control_account: false,
    is_active: true,
    description: "",
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const [funds, setFunds] = useState<Fund[]>([]);
  const [glSettings, setGlSettings] = useState<GlSettings | null>(null);
  const [glDraft, setGlDraft] = useState({
    ar_account_id: null as number | null,
    ap_account_id: null as number | null,
    cash_account_id: null as number | null,
    default_fund_id: null as number | null,
    product_sales_account_id: null as number | null,
  });
  const [savingGl, setSavingGl] = useState(false);

  useEffect(() => {
    load();
    loadGlSettings();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("code", { ascending: true });
    if (error) {
      console.error("[admin/accounts] failed to load", error);
      toast.error("Couldn't load accounts.");
      return;
    }
    setAccounts(data);
  }

  async function loadGlSettings() {
    const [{ data: settings, error: settingsErr }, { data: fundsData, error: fundsErr }] = await Promise.all([
      supabase.from("gl_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("funds").select("*").order("name", { ascending: true }),
    ]);
    if (settingsErr) console.error("[admin/accounts] gl_settings load error", settingsErr);
    if (fundsErr) console.error("[admin/accounts] funds load error", fundsErr);
    setFunds(fundsData || []);
    if (settings) {
      setGlSettings(settings);
      setGlDraft({
        ar_account_id: settings.ar_account_id,
        ap_account_id: settings.ap_account_id,
        cash_account_id: settings.cash_account_id,
        default_fund_id: settings.default_fund_id,
        product_sales_account_id: settings.product_sales_account_id,
      });
    }
  }

  async function handleSaveGlSettings() {
    if (!glDraft.ar_account_id || !glDraft.ap_account_id || !glDraft.default_fund_id) {
      toast.error("Accounts Receivable, Accounts Payable and a default Fund are required.");
      return;
    }

    setSavingGl(true);
    try {
      // Goes through an RPC (not a raw table update) so a permission problem
      // raises a real, catchable error instead of RLS silently filtering the
      // row out and leaving us unable to tell "saved" from "blocked".
      const { data, error } = await supabase.rpc("fn_save_gl_settings", {
        p_ar_account_id: glDraft.ar_account_id,
        p_ap_account_id: glDraft.ap_account_id,
        p_cash_account_id: glDraft.cash_account_id,
        p_default_fund_id: glDraft.default_fund_id,
        p_product_sales_account_id: glDraft.product_sales_account_id,
      });
      if (error) throw error;
      if (!data) throw new Error("Save did not return a row - settings were not persisted.");

      setGlSettings(data);
      toast.success("GL settings saved. Bills, invoices and payments will now post using these defaults.");
    } catch (err) {
      console.error("[admin/accounts] gl_settings save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save GL settings.");
    } finally {
      setSavingGl(false);
    }
  }

  function handleOpenDialog(account?: Account) {
    if (account) {
      setEditingAccount(account);
      setFormData({
        code: account.code,
        name: account.name,
        type: account.type,
        normal_balance: account.normal_balance,
        parent_account_id: account.parent_account_id,
        is_control_account: account.is_control_account,
        is_active: account.is_active,
        description: account.description || "",
      });
    } else {
      setEditingAccount(null);
      setFormData({
        code: "",
        name: "",
        type: "asset",
        normal_balance: "debit",
        parent_account_id: null,
        is_control_account: false,
        is_active: true,
        description: "",
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingAccount(null);
  }

  async function handleSaveAccount() {
    if (!formData.code || !formData.name || !formData.type || !formData.normal_balance) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
      if (editingAccount) {
        const { error } = await supabase
          .from("accounts")
          .update({
            code: formData.code,
            name: formData.name,
            type: formData.type,
            normal_balance: formData.normal_balance,
            parent_account_id: formData.parent_account_id,
            is_control_account: formData.is_control_account,
            is_active: formData.is_active,
            description: formData.description || null,
          })
          .eq("id", editingAccount.id);
        if (error) throw error;
        toast.success("Account updated.");
      } else {
        const { error } = await supabase.from("accounts").insert({
          code: formData.code,
          name: formData.name,
          type: formData.type,
          normal_balance: formData.normal_balance,
          parent_account_id: formData.parent_account_id,
          is_control_account: formData.is_control_account,
          is_active: formData.is_active,
          description: formData.description || null,
        });
        if (error) throw error;
        toast.success("Account created.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/accounts] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save account.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(account: Account) {
    setBusyId(account.id.toString());
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ is_active: !account.is_active })
        .eq("id", account.id);
      if (error) throw error;
      toast.success(account.is_active ? "Account deactivated." : "Account activated.");
      load();
    } catch (err) {
      console.error("[admin/accounts] toggle error", err);
      toast.error("Failed to update account status.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to account management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage accounting accounts for journal entries and financial tracking.</p>
        </div>
        {role === "admin" && (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-96 overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Edit Account" : "Create New Account"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Account Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="1000"
                      disabled={!!editingAccount}
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Account Type *</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as AccountType })}>
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="name">Account Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Cash in Hand"
                  />
                </div>
                <div>
                  <Label htmlFor="balance">Normal Balance *</Label>
                  <Select value={formData.normal_balance} onValueChange={(v) => setFormData({ ...formData, normal_balance: v as NormalSide })}>
                    <SelectTrigger id="balance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NORMAL_SIDES.map((s) => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Account description..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="control"
                      checked={formData.is_control_account}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_control_account: checked === true })}
                    />
                    <Label htmlFor="control" className="cursor-pointer">Control account (summary account)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
                    />
                    <Label htmlFor="active" className="cursor-pointer">Active</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveAccount} disabled={busyId === "save"} className="flex-1">
                    {editingAccount ? "Update" : "Create"} Account
                  </Button>
                  <Button variant="outline" onClick={handleCloseDialog} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-foreground">GL Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These defaults connect bills, invoices and payments to the ledger automatically: recording a bill
          debits its expense/asset accounts and credits Accounts Payable, issuing an invoice debits Accounts
          Receivable and credits income, and payments move cash and settle the balance.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
            <Label>Accounts Receivable *</Label>
            <Select
              value={glDraft.ar_account_id ? glDraft.ar_account_id.toString() : ""}
              onValueChange={(v) => setGlDraft({ ...glDraft, ar_account_id: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts || []).filter((a) => a.is_active).map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.code} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Accounts Payable *</Label>
            <Select
              value={glDraft.ap_account_id ? glDraft.ap_account_id.toString() : ""}
              onValueChange={(v) => setGlDraft({ ...glDraft, ap_account_id: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts || []).filter((a) => a.is_active).map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.code} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Default Cash/Bank Account</Label>
            <Select
              value={glDraft.cash_account_id ? glDraft.cash_account_id.toString() : ""}
              onValueChange={(v) => setGlDraft({ ...glDraft, cash_account_id: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts || []).filter((a) => a.is_active).map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.code} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Default Fund *</Label>
            <Select
              value={glDraft.default_fund_id ? glDraft.default_fund_id.toString() : ""}
              onValueChange={(v) => setGlDraft({ ...glDraft, default_fund_id: parseInt(v) })}
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
            <Label>Product Sales Revenue</Label>
            <Select
              value={glDraft.product_sales_account_id ? glDraft.product_sales_account_id.toString() : ""}
              onValueChange={(v) => setGlDraft({ ...glDraft, product_sales_account_id: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts || []).filter((a) => a.is_active).map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.code} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSaveGlSettings} disabled={savingGl} size="sm">
            {savingGl ? "Saving…" : "Save GL Settings"}
          </Button>
          {(!glSettings?.ar_account_id || !glSettings?.ap_account_id || !glSettings?.default_fund_id) && (
            <span className="text-xs text-destructive">
              Accounts Receivable, Accounts Payable and a default Fund must be set before bills, invoices or
              payments can post to the ledger.
            </span>
          )}
          {glSettings?.ar_account_id && glSettings?.ap_account_id && glSettings?.default_fund_id &&
            !glSettings?.product_sales_account_id && (
              <span className="text-xs text-destructive">
                Set a Product Sales Revenue account before you can invoice product orders from the Product
                Orders page.
              </span>
            )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Normal Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts === null && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {accounts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No accounts yet.
                </TableCell>
              </TableRow>
            )}
            {accounts?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono font-semibold text-foreground">{a.code}</TableCell>
                <TableCell className="font-semibold text-foreground">{a.name}</TableCell>
                <TableCell className="text-sm">{a.type}</TableCell>
                <TableCell className="text-sm">{a.normal_balance}</TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? "default" : "secondary"}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {role === "admin" && (
                      <>
                        <button
                          onClick={() => handleOpenDialog(a)}
                          title="Edit"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(a)}
                          disabled={busyId === a.id.toString()}
                          className="px-2 py-1 text-xs rounded border transition-colors disabled:opacity-50"
                        >
                          {a.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </>
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
