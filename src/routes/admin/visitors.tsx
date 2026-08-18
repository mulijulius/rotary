import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Mail, Trash2, Filter } from "lucide-react";
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

export const Route = createFileRoute("/admin/visitors")({
  component: AdminVisitors,
});

type Visitor = Database["public"]["Tables"]["visitors"]["Row"];
type VisitorInterest = Database["public"]["Enums"]["visitor_interest"];

const interestVariant: Record<VisitorInterest, "default" | "secondary" | "outline"> = {
  general: "default",
  membership: "secondary",
  projects: "secondary",
  events: "outline",
  other: "outline",
};

type VisitorFormData = Omit<Visitor, "id" | "visited_at" | "created_at" | "updated_at">;

function AdminVisitors() {
  const { role } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [filteredVisitors, setFilteredVisitors] = useState<Visitor[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterInterest, setFilterInterest] = useState<VisitorInterest | "all">("all");
  const [formData, setFormData] = useState<VisitorFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: null,
    organization: null,
    interest: "general",
    notes: null,
    meeting_id: null,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [visitors, searchTerm, filterInterest]);

  async function load() {
    const { data, error } = await supabase
      .from("visitors")
      .select("*")
      .order("visited_at", { ascending: false });
    if (error) {
      console.error("[admin/visitors] failed to load", error);
      toast.error("Couldn't load visitors.");
      return;
    }
    setVisitors(data);
  }

  function applyFilters() {
    if (!visitors) return;
    let filtered = visitors;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.first_name.toLowerCase().includes(term) ||
          v.last_name.toLowerCase().includes(term) ||
          v.email.toLowerCase().includes(term) ||
          (v.organization && v.organization.toLowerCase().includes(term))
      );
    }

    if (filterInterest !== "all") {
      filtered = filtered.filter((v) => v.interest === filterInterest);
    }

    setFilteredVisitors(filtered);
  }

  function handleOpenDialog(visitor?: Visitor) {
    if (visitor) {
      setEditingVisitor(visitor);
      setFormData({
        first_name: visitor.first_name,
        last_name: visitor.last_name,
        email: visitor.email,
        phone: visitor.phone,
        organization: visitor.organization,
        interest: visitor.interest,
        notes: visitor.notes,
        meeting_id: visitor.meeting_id,
      });
    } else {
      setEditingVisitor(null);
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: null,
        organization: null,
        interest: "general",
        notes: null,
        meeting_id: null,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingVisitor(null);
  }

  async function handleSaveVisitor() {
    if (!formData.first_name || !formData.last_name || !formData.email) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
      if (editingVisitor) {
        const { error } = await supabase
          .from("visitors")
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            organization: formData.organization,
            interest: formData.interest,
            notes: formData.notes,
            meeting_id: formData.meeting_id,
          })
          .eq("id", editingVisitor.id);
        if (error) throw error;
        toast.success("Visitor updated successfully.");
      } else {
        const { error } = await supabase.from("visitors").insert({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          organization: formData.organization,
          interest: formData.interest,
          notes: formData.notes,
          meeting_id: formData.meeting_id,
        });
        if (error) throw error;
        toast.success("Visitor added successfully.");
      }
      handleCloseDialog();
      load();
    } catch (error: any) {
      console.error("[admin/visitors] save error", error);
      toast.error(error.message || "Failed to save visitor.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteVisitor(id: number) {
    if (!confirm("Are you sure you want to delete this visitor?")) return;
    try {
      const { error } = await supabase.from("visitors").delete().eq("id", id);
      if (error) throw error;
      toast.success("Visitor deleted.");
      load();
    } catch (error: any) {
      console.error("[admin/visitors] delete error", error);
      toast.error("Failed to delete visitor.");
    }
  }

  if (role && !["admin", "secretary"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to visitor management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visitors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage visitor information and track attendance at events.
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingVisitor ? "Edit Visitor" : "Add New Visitor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
                    placeholder="+254712345678"
                  />
                </div>
                <div>
                  <Label htmlFor="organization">Organization</Label>
                  <Input
                    id="organization"
                    value={formData.organization || ""}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value || null })}
                    placeholder="Company/Organization"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="interest">Interest</Label>
                <Select value={formData.interest} onValueChange={(value: any) => setFormData({ ...formData, interest: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                    <SelectItem value="events">Events</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                  placeholder="Additional notes about this visitor..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSaveVisitor} disabled={busyId === "save"}>
                  {editingVisitor ? "Update" : "Add"} Visitor
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex gap-4">
          <Input
            placeholder="Search by name, email, or organization..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Select value={filterInterest} onValueChange={(value: any) => setFilterInterest(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Interests</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="membership">Membership</SelectItem>
              <SelectItem value="projects">Projects</SelectItem>
              <SelectItem value="events">Events</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Visited</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisitors && filteredVisitors.length > 0 ? (
                filteredVisitors.map((visitor) => (
                  <TableRow key={visitor.id}>
                    <TableCell className="font-medium">
                      {visitor.first_name} {visitor.last_name}
                    </TableCell>
                    <TableCell>{visitor.email}</TableCell>
                    <TableCell>{visitor.phone || "—"}</TableCell>
                    <TableCell>{visitor.organization || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={interestVariant[visitor.interest]}>
                        {visitor.interest}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(visitor.visited_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenDialog(visitor)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteVisitor(visitor.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No visitors found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
