import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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

export const Route = createFileRoute("/admin/funds")({
  component: AdminFunds,
});

type Fund = Database["public"]["Tables"]["funds"]["Row"];

function AdminFunds() {
  const { role } = useAuth();
  const [funds, setFunds] = useState<Fund[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "" });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("funds")
      .select("*")
      .order("code", { ascending: true });
    if (error) {
      console.error("[admin/funds] failed to load", error);
      toast.error("Couldn't load funds.");
      return;
    }
    setFunds(data);
  }

  function handleOpenDialog(fund?: Fund) {
    if (fund) {
      setEditingFund(fund);
      setFormData({ code: fund.code, name: fund.name });
    } else {
      setEditingFund(null);
      setFormData({ code: "", name: "" });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingFund(null);
  }

  async function handleSaveFund() {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Please fill in both a code and a name.");
      return;
    }

    setBusyId("save");
    try {
      if (editingFund) {
        const { error } = await supabase
          .from("funds")
          .update({ code: formData.code.trim(), name: formData.name.trim() })
          .eq("id", editingFund.id);
        if (error) throw error;
        toast.success("Fund updated.");
      } else {
        const { error } = await supabase.from("funds").insert({
          code: formData.code.trim(),
          name: formData.name.trim(),
        });
        if (error) throw error;
        toast.success("Fund created. It's now available in Chart of Accounts > GL Settings.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/funds] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save fund.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteFund(fund: Fund) {
    if (!confirm(`Delete fund "${fund.name}"? This can't be undone.`)) return;
    setBusyId(fund.id.toString());
    try {
      const { error } = await supabase.from("funds").delete().eq("id", fund.id);
      if (error) throw error;
      toast.success("Fund deleted.");
      load();
    } catch (err) {
      console.error("[admin/funds] delete error", err);
      toast.error(
        "Couldn't delete this fund - it's already used by journal entries or set as the GL default. Remove those references first."
      );
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to fund management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Funds</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Funds group your journal entries (e.g. General Fund, Foundation Fund). Create at least one -
            it's required by Chart of Accounts &gt; GL Settings before bills, invoices, or payments can post.
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Fund
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFund ? "Edit Fund" : "Create New Fund"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="GEN"
                  maxLength={10}
                />
              </div>
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="General Fund"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveFund} disabled={busyId === "save"} className="flex-1">
                  {editingFund ? "Update" : "Create"} Fund
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
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funds === null && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {funds?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  No funds yet. Create one (e.g. "General Fund") to get started.
                </TableCell>
              </TableRow>
            )}
            {funds?.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono font-semibold text-foreground">{f.code}</TableCell>
                <TableCell className="text-foreground">{f.name}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleOpenDialog(f)}
                      title="Edit"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFund(f)}
                      disabled={busyId === f.id.toString()}
                      title="Delete"
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
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
