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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/board-positions")({
  component: AdminBoardPositions,
});

type BoardPosition = Database["public"]["Tables"]["board_positions"]["Row"];
type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"];
type Member = Database["public"]["Tables"]["members"]["Row"];

function AdminBoardPositions() {
  const { role } = useAuth();
  const [positions, setPositions] = useState<(BoardPosition & { fiscal_year_name: string; member_name: string })[] | null>(null);
  const [years, setYears] = useState<FiscalYear[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPosition, setEditingPosition] = useState<BoardPosition | null>(null);
  const [formData, setFormData] = useState({
    fiscal_year_id: 0,
    member_id: 0,
    title: "",
    bio: "",
    sort_order: 0,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadPositions(parseInt(selectedYear));
    }
  }, [selectedYear]);

  async function loadYears() {
    const { data, error } = await supabase
      .from("fiscal_years")
      .select("*")
      .order("name", { ascending: false });
    if (error) {
      console.error("[admin/board-positions] failed to load years", error);
      return;
    }
    setYears(data);
    if (data.length > 0) {
      setSelectedYear(data[0]!.id.toString());
    }
  }

  async function loadPositions(yearId: number) {
    const { data, error } = await supabase
      .from("board_positions")
      .select(`*,fiscal_year:fiscal_years(name),member:members(first_name,last_name)`)
      .eq("fiscal_year_id", yearId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[admin/board-positions] failed to load", error);
      toast.error("Couldn't load board positions.");
      return;
    }
    setPositions(
      data.map((p: any) => ({
        ...p,
        fiscal_year_name: p.fiscal_year.name,
        member_name: `${p.member.first_name} ${p.member.last_name}`,
      }))
    );
  }

  async function loadMembers() {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("status", "active")
      .order("last_name", { ascending: true });
    if (error) {
      console.error("[admin/board-positions] failed to load members", error);
      return;
    }
    setMembers(data);
  }

  function handleOpenDialog(position?: BoardPosition) {
    loadMembers();
    if (position) {
      setEditingPosition(position);
      setFormData({
        fiscal_year_id: position.fiscal_year_id,
        member_id: position.member_id,
        title: position.title,
        bio: position.bio || "",
        sort_order: position.sort_order,
      });
    } else {
      setEditingPosition(null);
      setFormData({
        fiscal_year_id: parseInt(selectedYear),
        member_id: 0,
        title: "",
        bio: "",
        sort_order: 0,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingPosition(null);
  }

  async function handleSavePosition() {
    if (!formData.fiscal_year_id || !formData.member_id || !formData.title) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
      if (editingPosition) {
        const { error } = await supabase
          .from("board_positions")
          .update({
            fiscal_year_id: formData.fiscal_year_id,
            member_id: formData.member_id,
            title: formData.title,
            bio: formData.bio || null,
            sort_order: formData.sort_order,
          })
          .eq("id", editingPosition.id);
        if (error) throw error;
        toast.success("Board position updated.");
      } else {
        const { error } = await supabase.from("board_positions").insert({
          fiscal_year_id: formData.fiscal_year_id,
          member_id: formData.member_id,
          title: formData.title,
          bio: formData.bio || null,
          sort_order: formData.sort_order,
        });
        if (error) throw error;
        toast.success("Board position created.");
      }
      handleCloseDialog();
      loadPositions(formData.fiscal_year_id);
    } catch (err) {
      console.error("[admin/board-positions] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save board position.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(position: BoardPosition) {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setBusyId(position.id.toString());
    try {
      const { error } = await supabase
        .from("board_positions")
        .delete()
        .eq("id", position.id);
      if (error) throw error;
      toast.success("Board position deleted.");
      loadPositions(position.fiscal_year_id);
    } catch (err) {
      console.error("[admin/board-positions] delete error", err);
      toast.error("Failed to delete board position.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "secretary"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to board position management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Board Positions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage leadership positions and member bios.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Position
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-96 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPosition ? "Edit Board Position" : "Add Board Position"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="yearSelect">Fiscal Year *</Label>
                <Select
                  value={formData.fiscal_year_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, fiscal_year_id: parseInt(v) })}
                >
                  <SelectTrigger id="yearSelect">
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
              <div>
                <Label htmlFor="memberSelect">Member *</Label>
                <Select
                  value={formData.member_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, member_id: parseInt(v) })}
                >
                  <SelectTrigger id="memberSelect">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members?.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.first_name} {m.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="President"
                />
              </div>
              <div>
                <Label htmlFor="bio">Biography</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Brief biography for the public board page..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSavePosition} disabled={busyId === "save"} className="flex-1">
                  {editingPosition ? "Update" : "Add"} Position
                </Button>
                <Button variant="outline" onClick={handleCloseDialog} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        <Label>Filter by Fiscal Year</Label>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-40">
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

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions === null && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {positions?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No board positions for this fiscal year.
                </TableCell>
              </TableRow>
            )}
            {positions?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold text-foreground">{p.member_name}</TableCell>
                <TableCell className="text-sm font-medium">{p.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{p.bio}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.sort_order}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleOpenDialog(p)}
                      title="Edit"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={busyId === p.id.toString()}
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
