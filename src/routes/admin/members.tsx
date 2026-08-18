import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Copy, RefreshCw } from "lucide-react";
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

export const Route = createFileRoute("/admin/members")({
  component: AdminMembers,
});

type Member = Database["public"]["Tables"]["members"]["Row"];

const statusVariant: Record<Member["status"], "default" | "secondary" | "outline" | "destructive"> =
  {
    active: "default",
    leave_of_absence: "secondary",
    honorary: "outline",
    alumni: "outline",
    terminated: "destructive",
  };

type MemberFormData = Omit<Member, "id" | "qr_token" | "qr_issued_at" | "created_at" | "updated_at">;

function AdminMembers() {
  const { role } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState<MemberFormData>({
    user_id: null,
    ri_number: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    classification: "",
    photo_url: null,
    joined_date: new Date().toISOString().slice(0, 10),
    status: "active",
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reissueBusyId, setReissueBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("last_name", { ascending: true });
    if (error) {
      console.error("[admin/members] failed to load", error);
      toast.error("Couldn't load members.");
      return;
    }
    setMembers(data);
  }

  function handleOpenDialog(member?: Member) {
    if (member) {
      setEditingMember(member);
      setFormData({
        user_id: member.user_id,
        ri_number: member.ri_number,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone,
        classification: member.classification || "",
        photo_url: member.photo_url,
        joined_date: new Date(member.joined_date).toISOString().slice(0, 10),
        status: member.status,
      });
    } else {
      setEditingMember(null);
      setFormData({
        user_id: null,
        ri_number: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        classification: "",
        photo_url: null,
        joined_date: new Date().toISOString().slice(0, 10),
        status: "active",
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingMember(null);
  }

  async function handleSaveMember() {
    if (!formData.ri_number || !formData.first_name || !formData.last_name || !formData.email || !formData.phone) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
      if (editingMember) {
        const { error } = await supabase
          .from("members")
          .update({
            ri_number: formData.ri_number,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            classification: formData.classification || null,
            photo_url: formData.photo_url,
            joined_date: formData.joined_date,
            status: formData.status,
          })
          .eq("id", editingMember.id);
        if (error) throw error;
        toast.success("Member updated.");
      } else {
        const { error } = await supabase.from("members").insert({
          user_id: formData.user_id,
          ri_number: formData.ri_number,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          classification: formData.classification || null,
          photo_url: formData.photo_url,
          joined_date: formData.joined_date,
          status: formData.status,
        });
        if (error) throw error;
        toast.success("Member added.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/members] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save member.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleChangeStatus(member: Member, newStatus: Member["status"]) {
    setBusyId(member.id.toString());
    try {
      const { error } = await supabase
        .from("members")
        .update({ status: newStatus })
        .eq("id", member.id);
      if (error) throw error;
      toast.success("Member status updated.");
      load();
    } catch (err) {
      console.error("[admin/members] status change error", err);
      toast.error("Failed to update member status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReissueQR(member: Member) {
    setReissueBusyId(member.id.toString());
    try {
      const { data, error } = await supabase.rpc("fn_reissue_qr_token", {
        _member_id: member.id,
      });
      if (error) throw error;
      toast.success(`New QR token issued: ${data}`);
      load();
    } catch (err) {
      console.error("[admin/members] reissue QR error", err);
      toast.error("Failed to reissue QR token.");
    } finally {
      setReissueBusyId(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  }

  if (role && !["admin", "secretary"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to member management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage club roster and member records.</p>
        </div>
        {role === "admin" && (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="riNumber">RI Number *</Label>
                  <Input
                    id="riNumber"
                    value={formData.ri_number}
                    onChange={(e) => setFormData({ ...formData, ri_number: e.target.value })}
                    placeholder="12345678"
                    disabled={!!editingMember}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+254 712 345678"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="classification">Classification</Label>
                    <Input
                      id="classification"
                      value={formData.classification}
                      onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                      placeholder="Vocational / Professional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="joinedDate">Joined Date</Label>
                    <Input
                      id="joinedDate"
                      type="date"
                      value={formData.joined_date}
                      onChange={(e) => setFormData({ ...formData, joined_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as Member["status"] })}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="leave_of_absence">Leave of Absence</SelectItem>
                      <SelectItem value="honorary">Honorary</SelectItem>
                      <SelectItem value="alumni">Alumni</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="photoUrl">Photo URL</Label>
                  <Textarea
                    id="photoUrl"
                    value={formData.photo_url || ""}
                    onChange={(e) => setFormData({ ...formData, photo_url: e.target.value || null })}
                    placeholder="https://example.com/photo.jpg"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveMember} disabled={busyId === "save"} className="flex-1">
                    {editingMember ? "Update" : "Add"} Member
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
              <TableHead>RI Number</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members === null && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {members?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No members on file yet.
                </TableCell>
              </TableRow>
            )}
            {members?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-semibold text-foreground">
                  {m.first_name} {m.last_name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.ri_number}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.phone}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(m.joined_date).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[m.status]}>{m.status.replaceAll("_", " ")}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {role === "admin" && (
                      <>
                        <button
                          onClick={() => handleOpenDialog(m)}
                          title="Edit"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => copyToClipboard(m.qr_token)}
                          title="Copy QR Token"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleReissueQR(m)}
                          disabled={reissueBusyId === m.id.toString()}
                          title="Reissue QR Token"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {role === "admin" && m.status !== "active" && (
                      <button
                        onClick={() => handleChangeStatus(m, "active")}
                        disabled={busyId === m.id.toString()}
                        title="Activate Member"
                        className="px-2 py-1 text-xs rounded border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                      >
                        Activate
                      </button>
                    )}
                    {role === "admin" && m.status === "active" && (
                      <Select value={m.status} onValueChange={(v) => handleChangeStatus(m, v as Member["status"])}>
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="leave_of_absence">Leave</SelectItem>
                          <SelectItem value="honorary">Honorary</SelectItem>
                          <SelectItem value="alumni">Alumni</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
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
