import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleLabel, type AppRole } from "@/lib/auth";
import { listAuthUsers } from "@/lib/admin.functions";
import { linkMemberAccount, unlinkMemberAccount } from "@/lib/member-requests";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

const ROLE_OPTIONS: AppRole[] = ["admin", "treasurer", "secretary", "editor", "member"];

type AuthUser = { id: string; email: string; createdAt: string };
type RoleRow = {
  id: string;
  role: AppRole;
  status: "pending" | "approved" | "revoked";
  requestedAt: string;
};
type Member = Database["public"]["Tables"]["members"]["Row"];

type NewProfileForm = {
  ri_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  classification: string;
  joined_date: string;
  status: Member["status"];
  photo_url: string;
};

function emptyProfileForm(): NewProfileForm {
  return {
    ri_number: "",
    first_name: "",
    last_name: "",
    phone: "",
    classification: "",
    joined_date: new Date().toISOString().slice(0, 10),
    status: "active",
    photo_url: "",
  };
}

function AdminUsers() {
  const { session, role } = useAuth();
  const listAuthUsersFn = useServerFn(listAuthUsers);
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [roles, setRoles] = useState<Record<string, RoleRow>>({});
  const [members, setMembers] = useState<Member[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Member-profile link dialog state — keyed by the auth user being linked.
  const [linkUser, setLinkUser] = useState<AuthUser | null>(null);
  const [linkTab, setLinkTab] = useState<"existing" | "new">("existing");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [newProfile, setNewProfile] = useState<NewProfileForm>(emptyProfileForm());
  const [linkBusy, setLinkBusy] = useState(false);

  async function load() {
    setLoadError(null);
    try {
      const [
        authUsers,
        { data: roleRows, error: rolesError },
        { data: memberRows, error: membersError },
      ] = await Promise.all([
        listAuthUsersFn(),
        supabase.from("user_roles").select("id, user_id, role, status, requested_at"),
        supabase.from("members").select("*"),
      ]);
      if (rolesError) throw rolesError;
      if (membersError) throw membersError;
      setUsers(authUsers);
      setMembers(memberRows);
      setRoles(
        Object.fromEntries(
          (roleRows ?? [])
            // A user can have historical revoked rows alongside nothing else
            // live; only show their most-recently-requested row.
            .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1))
            .map((r) => [
              r.user_id,
              { id: r.id, role: r.role, status: r.status, requestedAt: r.requested_at },
            ]),
        ),
      );
    } catch (err) {
      console.error("[admin/users] failed to load", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load users.");
    }
  }

  useEffect(() => {
    load();
    // Mount-only load; re-running when `load` changes identity isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(userId: string, roleRowId: string, nextStatus: "approved" | "revoked") {
    setBusyId(userId);
    const { error } = await supabase
      .from("user_roles")
      .update({
        status: nextStatus,
        decided_at: new Date().toISOString(),
        decided_by: session?.user.id ?? null,
      })
      .eq("id", roleRowId);
    setBusyId(null);

    if (error) {
      console.error("[admin/users] failed to decide role", error);
      toast.error("Couldn't update that request.");
      return;
    }
    toast.success(nextStatus === "approved" ? "Role approved." : "Access revoked.");
    load();
  }

  // Directly grant (or change) an approved role — used when there's no
  // pending request to approve, e.g. assigning a role proactively.
  async function grantRole(userId: string, role: AppRole) {
    setBusyId(userId);
    // Only one live (pending/approved) row per user, so clear any existing
    // one first — same pattern the old direct-assign flow used. Past
    // revoked rows are left alone as history.
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("status", ["pending", "approved"]);
    const { error } = await supabase.from("user_roles").insert({
      user_id: userId,
      role,
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: session?.user.id ?? null,
    });
    setBusyId(null);

    if (error) {
      console.error("[admin/users] failed to grant role", error);
      toast.error("Couldn't grant that role.");
      return;
    }
    toast.success(`Granted ${roleLabel(role)}.`);
    load();
  }

  function openLinkDialog(u: AuthUser) {
    setLinkUser(u);
    setLinkTab("existing");
    setSelectedMemberId("");
    setNewProfile(emptyProfileForm());
  }

  function closeLinkDialog() {
    setLinkUser(null);
  }

  async function handleLinkExisting() {
    if (!linkUser || !selectedMemberId) {
      toast.error("Pick a member profile to link.");
      return;
    }
    setLinkBusy(true);
    try {
      await linkMemberAccount(Number(selectedMemberId), linkUser.id);
      toast.success(`Linked to ${linkUser.email}. They can now use the member portal.`);
      closeLinkDialog();
      load();
    } catch (err) {
      console.error("[admin/users] link error", err);
      toast.error(err instanceof Error ? err.message : "Failed to link account.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleCreateAndLink() {
    if (!linkUser) return;
    const { ri_number, first_name, last_name, phone } = newProfile;
    if (!ri_number || !first_name || !last_name || !phone) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setLinkBusy(true);
    try {
      const { error } = await supabase.from("members").insert({
        user_id: linkUser.id,
        ri_number,
        first_name,
        last_name,
        email: linkUser.email,
        phone,
        classification: newProfile.classification || null,
        photo_url: newProfile.photo_url || null,
        joined_date: newProfile.joined_date,
        status: newProfile.status,
      });
      if (error) throw error;

      // Creating a linked profile is itself the approval a pending sign-up
      // was waiting on.
      const roleRow = roles[linkUser.id];
      if (roleRow?.status === "pending") {
        await supabase
          .from("user_roles")
          .update({
            status: "approved",
            decided_at: new Date().toISOString(),
            decided_by: session?.user.id ?? null,
          })
          .eq("id", roleRow.id);
      }

      toast.success(`Member profile created and linked to ${linkUser.email}.`);
      closeLinkDialog();
      load();
    } catch (err) {
      console.error("[admin/users] create+link error", err);
      toast.error(err instanceof Error ? err.message : "Failed to create member profile.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleUnlink(member: Member) {
    setBusyId(member.user_id ?? member.id.toString());
    try {
      await unlinkMemberAccount(member.id);
      toast.success("Account unlinked from that member profile.");
      load();
    } catch (err) {
      console.error("[admin/users] unlink error", err);
      toast.error(err instanceof Error ? err.message : "Failed to unlink.");
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = Object.values(roles).filter((r) => r.status === "pending").length;
  const unlinkedMembers = (members ?? []).filter((m) => !m.user_id);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Users &amp; Roles</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Approve or deny role requests from sign-up, grant/revoke access directly, and link each
        account to its member profile so they can use the member portal (shop, orders, etc.).
      </p>
      {pendingCount > 0 && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold-deep">
          {pendingCount} pending request{pendingCount === 1 ? "" : "s"} awaiting review
        </p>
      )}

      {loadError && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Signed Up</TableHead>
              <TableHead>Requested Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Member Profile</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users === null && !loadError && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {users?.map((u) => {
              const roleRow = roles[u.id];
              const busy = busyId === u.id;
              const linkedMember = members?.find((m) => m.user_id === u.id) ?? null;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-semibold text-foreground">{u.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{roleRow ? roleLabel(roleRow.role) : "—"}</TableCell>
                  <TableCell>
                    {roleRow?.status === "pending" && <Badge variant="secondary">Pending</Badge>}
                    {roleRow?.status === "approved" && <Badge>Approved</Badge>}
                    {(roleRow?.status === "revoked" || !roleRow) && (
                      <Badge variant="outline">No access</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {linkedMember ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="whitespace-nowrap">
                          {linkedMember.first_name} {linkedMember.last_name}
                        </Badge>
                        {role === "admin" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleUnlink(linkedMember)}
                            className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                          >
                            Unlink
                          </button>
                        )}
                      </div>
                    ) : role === "admin" ? (
                      <button
                        type="button"
                        onClick={() => openLinkDialog(u)}
                        className="rounded-full border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                      >
                        Link…
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not linked</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {roleRow?.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide(u.id, roleRow.id, "approved")}
                          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide(u.id, roleRow.id, "revoked")}
                          className="rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                    {roleRow?.status === "approved" && (
                      <div className="flex items-center gap-2">
                        <select
                          disabled={busy}
                          defaultValue={roleRow.role}
                          onChange={(e) => grantRole(u.id, e.target.value as AppRole)}
                          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20 disabled:opacity-50"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide(u.id, roleRow.id, "revoked")}
                          className="rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                    {(roleRow?.status === "revoked" || !roleRow) && (
                      <select
                        disabled={busy}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) grantRole(u.id, e.target.value as AppRole);
                        }}
                        className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20 disabled:opacity-50"
                      >
                        <option value="" disabled>
                          Grant role…
                        </option>
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!linkUser} onOpenChange={(open) => !open && closeLinkDialog()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link member profile — {linkUser?.email}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 border-b border-border pb-3">
            <button
              type="button"
              onClick={() => setLinkTab("existing")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                linkTab === "existing"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Existing profile
            </button>
            <button
              type="button"
              onClick={() => setLinkTab("new")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                linkTab === "new"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              New profile
            </button>
          </div>

          {linkTab === "existing" ? (
            <div className="space-y-4 pt-2">
              {unlinkedMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No unlinked member profiles on file. Use "New profile" instead.
                </p>
              ) : (
                <div>
                  <Label>Member profile</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a member…" />
                    </SelectTrigger>
                    <SelectContent>
                      {unlinkedMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.first_name} {m.last_name} — RI# {m.ri_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleLinkExisting}
                  disabled={linkBusy || !selectedMemberId}
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
          ) : (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="np-first">First Name *</Label>
                  <Input
                    id="np-first"
                    value={newProfile.first_name}
                    onChange={(e) => setNewProfile({ ...newProfile, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="np-last">Last Name *</Label>
                  <Input
                    id="np-last"
                    value={newProfile.last_name}
                    onChange={(e) => setNewProfile({ ...newProfile, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="np-ri">RI Number *</Label>
                <Input
                  id="np-ri"
                  value={newProfile.ri_number}
                  onChange={(e) => setNewProfile({ ...newProfile, ri_number: e.target.value })}
                  placeholder="12345678"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input value={linkUser?.email ?? ""} disabled />
                </div>
                <div>
                  <Label htmlFor="np-phone">Phone *</Label>
                  <Input
                    id="np-phone"
                    value={newProfile.phone}
                    onChange={(e) => setNewProfile({ ...newProfile, phone: e.target.value })}
                    placeholder="+254 712 345678"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="np-classification">Classification</Label>
                  <Input
                    id="np-classification"
                    value={newProfile.classification}
                    onChange={(e) =>
                      setNewProfile({ ...newProfile, classification: e.target.value })
                    }
                    placeholder="Vocational / Professional"
                  />
                </div>
                <div>
                  <Label htmlFor="np-joined">Joined Date</Label>
                  <Input
                    id="np-joined"
                    type="date"
                    value={newProfile.joined_date}
                    onChange={(e) => setNewProfile({ ...newProfile, joined_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="np-status">Status</Label>
                <Select
                  value={newProfile.status}
                  onValueChange={(v) =>
                    setNewProfile({ ...newProfile, status: v as Member["status"] })
                  }
                >
                  <SelectTrigger id="np-status">
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
                <Label htmlFor="np-photo">Photo URL</Label>
                <Input
                  id="np-photo"
                  value={newProfile.photo_url}
                  onChange={(e) => setNewProfile({ ...newProfile, photo_url: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleCreateAndLink} disabled={linkBusy}>
                  {linkBusy ? "Creating…" : "Create & link"}
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
