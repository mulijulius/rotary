import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/fiscal-years")({
  component: AdminFiscalYears,
});

type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"];

function AdminFiscalYears() {
  const { role } = useAuth();
  const [years, setYears] = useState<FiscalYear[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingYear, setEditingYear] = useState<FiscalYear | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_closed: false,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("fiscal_years")
      .select("*")
      .order("name", { ascending: false });
    if (error) {
      console.error("[admin/fiscal-years] failed to load", error);
      toast.error("Couldn't load fiscal years.");
      return;
    }
    setYears(data);
  }

  function handleOpenDialog(year?: FiscalYear) {
    if (year) {
      setEditingYear(year);
      setFormData({
        name: year.name,
        start_date: year.start_date,
        end_date: year.end_date,
        is_closed: year.is_closed,
      });
    } else {
      setEditingYear(null);
      const now = new Date();
      const year = now.getFullYear();
      setFormData({
        name: `FY ${year}`,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        is_closed: false,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingYear(null);
  }

  async function handleSaveYear() {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast.error("End date must be after start date.");
      return;
    }

    setBusyId("save");
    try {
      if (editingYear) {
        const { error } = await supabase
          .from("fiscal_years")
          .update({
            name: formData.name,
            start_date: formData.start_date,
            end_date: formData.end_date,
            is_closed: formData.is_closed,
          })
          .eq("id", editingYear.id);
        if (error) throw error;
        toast.success("Fiscal year updated.");
      } else {
        const { error } = await supabase.from("fiscal_years").insert({
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          is_closed: formData.is_closed,
        });
        if (error) throw error;
        toast.success("Fiscal year created.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/fiscal-years] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save fiscal year.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleClose(year: FiscalYear) {
    setBusyId(year.id.toString());
    try {
      const { error } = await supabase
        .from("fiscal_years")
        .update({ is_closed: !year.is_closed })
        .eq("id", year.id);
      if (error) throw error;
      toast.success(year.is_closed ? "Fiscal year reopened." : "Fiscal year closed.");
      load();
    } catch (err) {
      console.error("[admin/fiscal-years] toggle close error", err);
      toast.error("Failed to update fiscal year status.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to fiscal year management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fiscal Years</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage financial periods and open/close for accounting.</p>
        </div>
        {role === "admin" && (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Fiscal Year
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingYear ? "Edit Fiscal Year" : "Create New Fiscal Year"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="FY 2024"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="closed"
                    checked={formData.is_closed}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_closed: checked === true })}
                  />
                  <Label htmlFor="closed" className="cursor-pointer">Closed (no more entries can be added)</Label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveYear} disabled={busyId === "save"} className="flex-1">
                    {editingYear ? "Update" : "Create"} Fiscal Year
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

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {years === null && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {years?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No fiscal years yet.
                </TableCell>
              </TableRow>
            )}
            {years?.map((y) => (
              <TableRow key={y.id}>
                <TableCell className="font-semibold text-foreground">{y.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(y.start_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(y.end_date).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant={y.is_closed ? "destructive" : "default"}>
                    {y.is_closed ? "Closed" : "Open"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {role === "admin" && (
                      <>
                        <button
                          onClick={() => handleOpenDialog(y)}
                          title="Edit"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleClose(y)}
                          disabled={busyId === y.id.toString()}
                          className="px-2 py-1 text-xs rounded border transition-colors disabled:opacity-50"
                          title={y.is_closed ? "Reopen" : "Close"}
                        >
                          {y.is_closed ? "Reopen" : "Close"}
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
