import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Edit2, Copy, RefreshCw, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listAuthUsers } from "@/lib/admin.functions";
import { linkMemberAccount, unlinkMemberAccount } from "@/lib/member-requests";
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
type AuthUser = { id: string; email: string; createdAt: string };
type RoleInfo = {
  role: Database["public"]["Enums"]["app_role"];
  status: "pending" | "approved" | "revoked";
};

const statusVariant: Record<Member["status"], "default" | "secondary" | "outline" | "destructive"> =
  {
    active: "default",
    leave_of_absence: "secondary",
    honorary: "outline",
    alumni: "outline",
    terminated: "destructive",
  };

type MemberFormData = Omit<
  Member,
  "id" | "qr_token" | "qr_issued_at" | "created_at" | "updated_at"
>;

function AdminMembers() {
  const { role, session } = useAuth();
  const listAuthUsersFn = useServerFn(listAuthUsers);
  const [members, setMembers] = useState<Member[] | null>(null);
  // Only fetched for admins (listAuthUsers is admin-only server-side); used
  // to show which account, if any, each member profile is linked to, and
  // to offer unlinked accounts when linking one.
  const [authUsers, setAuthUsers] = useState<AuthUser[] | null>(null);
  // Most-recent live (pending/approved) role request per account, keyed by
  // user id — shown next to each account in the "link to signed-up
  // account" dropdown so an admin can tell a fresh sign-up apart from an
  // account with no request at all.
  const [roles, setRoles] = useState<Record<string, RoleInfo>>({});
  const [openDialog, setOpenDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  // Which unlinked account (if any) the "Add New Member" form will link to
  // on save — only used when creating a brand-new profile, not editing.
  const [linkToUserId, setLinkToUserId] = useState<string>("");
  const [linkMember, setLinkMember] = useState<Member | null>(null);
  const [linkUserId, setLinkUserId] = useState<string>("");
  const [linkBusy, setLinkBusy] = useState(false);
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
    // Mount-only; role doesn't change identity mid-session here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

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

    if (role === "admin") {
      try {
        setAuthUsers(await listAuthUsersFn());
      } catch (err) {
        console.error("[admin/members] failed to load accounts", err);
      }
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, status, requested_at")
        .in("status", ["pending", "approved"]);
      if (rolesError) {
        console.error("[admin/members] failed to load roles", rolesError);
      } else {
        setRoles(
          Object.fromEntries(
            (roleRows ?? [])
              .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1))
              .map((r) => [r.user_id, { role: r.role, status: r.status }]),
          ),
        );
      }
    }
  }

  function openLinkDialog(member: Member) {
    setLinkMember(member);
    setLinkUserId("");
  }

  function closeLinkDialog() {
    setLinkMember(null);
  }

  async function handleLinkAccount() {
    if (!linkMember || !linkUserId) {
      toast.error("Pick an account to link.");
      return;
    }
    setLinkBusy(true);
    try {
      await linkMemberAccount(linkMember.id, linkUserId);
      toast.success("Account linked. They can now use the member portal.");
      closeLinkDialog();
      load();
    } catch (err) {
      console.error("[admin/members] link error", err);
      toast.error(err instanceof Error ? err.message : "Failed to link account.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleUnlinkAccount(member: Member) {
    setBusyId(`unlink-${member.id}`);
    try {
      await unlinkMemberAccount(member.id);
      toast.success("Account unlinked from this member.");
      load();
    } catch (err) {
      console.error("[admin/members] unlink error", err);
      toast.error(err instanceof Error ? err.message : "Failed to unlink.");
    } finally {
      setBusyId(null);
    }
  }

  function handleOpenDialog(member?: Member) {
    setLinkToUserId("");
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
    if (
      !formData.ri_number ||
      !formData.first_name ||
      !formData.last_name ||
      !formData.email ||
      !formData.phone
    ) {
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
          user_id: linkToUserId || null,
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

        // Picking an account from the dropdown and completing this form is
        // itself the confirmation a pending sign-up is waiting on.
        const roleRow = linkToUserId ? roles[linkToUserId] : null;
        if (linkToUserId && roleRow?.status === "pending") {
          await supabase
            .from("user_roles")
            .update({
              status: "approved",
              decided_at: new Date().toISOString(),
              decided_by: session?.user.id ?? null,
            })
            .eq("user_id", linkToUserId)
            .eq("status", "pending");
        }
        toast.success(
          linkToUserId ? "Member added and confirmed — portal access granted." : "Member added.",
        );
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

  const linkedUserIds = new Set((members ?? []).map((m) => m.user_id).filter(Boolean) as string[]);
  const unlinkedUsers = (authUsers ?? []).filter((u) => !linkedUserIds.has(u.id));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage club roster and member records.
          </p>
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
                {!editingMember && (
                  <div>
                    <Label htmlFor="linkAccount">Link to Signed-Up Account</Label>
                    <Select
                      value={linkToUserId || "none"}
                      onValueChange={(v) => {
                        const nextId = v === "none" ? "" : v;
                        setLinkToUserId(nextId);
                        const picked = unlinkedUsers.find((u) => u.id === nextId);
                        if (picked) setFormData({ ...formData, email: picked.email });
                      }}
                    >
                      <SelectTrigger id="linkAccount">
                        <SelectValue placeholder="Not linked yet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Not linked yet —</SelectItem>
                        {unlinkedUsers.map((u) => {
                          const r = roles[u.id];
                          const tag = r
                            ? `${r.status === "pending" ? "Pending" : "Approved"} — ${r.role}`
                            : "No role request";
                          return (
                            <SelectItem key={u.id} value={u.id}>
                              {u.email} ({tag})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Pick the account this profile belongs to and fill in the details below to
                      officially confirm them — this also approves their pending access request, if
                      any.
                    </p>
                  </div>
                )}
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
                      value={formData.classification ?? ""}
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
                  <Select
                    value={formData.status}
                    onValueChange={(v) =>
                      setFormData({ ...formData, status: v as Member["status"] })
                    }
                  >
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
                    onChange={(e) =>
                      setFormData({ ...formData, photo_url: e.target.value || null })
                    }
                    placeholder="https://example.com/photo.jpg"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveMember}
                    disabled={busyId === "save"}
                    className="flex-1"
                  >
                    {editingMember
                      ? "Update Member"
                      : linkToUserId
                        ? "Confirm & Add Member"
                        : "Add Member"}
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
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members === null && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {members?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
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
                <TableCell>
                  {m.user_id ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="whitespace-nowrap">
                        {authUsers?.find((u) => u.id === m.user_id)?.email ?? "Linked"}
                      </Badge>
                      {role === "admin" && (
                        <button
                          onClick={() => handleUnlinkAccount(m)}
                          disabled={busyId === `unlink-${m.id}`}
                          title="Unlink Account"
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          <Unlink className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : role === "admin" ? (
                    <button
                      onClick={() => openLinkDialog(m)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Link account
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not linked</span>
                  )}
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
                      <Select
                        value={m.status}
                        onValueChange={(v) => handleChangeStatus(m, v as Member["status"])}
                      >
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

      <Dialog open={!!linkMember} onOpenChange={(open) => !open && closeLinkDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Link account — {linkMember?.first_name} {linkMember?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {unlinkedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No unlinked accounts. They need to sign up first (Signup page), or check{" "}
                <span className="font-semibold">Admin → Users &amp; Roles</span> for pending
                requests.
              </p>
            ) : (
              <div>
                <Label>Account</Label>
                <Select value={linkUserId} onValueChange={setLinkUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleLinkAccount}
                disabled={linkBusy || !linkUserId}
              >
                {linkBusy ? "Linking…" : "Link account"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={closeLinkDialog}
                disabled={linkBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
