import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleLabel, type AppRole } from "@/lib/auth";
import { listAuthUsers } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function AdminUsers() {
  const { session } = useAuth();
  const listAuthUsersFn = useServerFn(listAuthUsers);
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [roles, setRoles] = useState<Record<string, RoleRow>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const [authUsers, { data: roleRows, error: rolesError }] = await Promise.all([
        listAuthUsersFn(),
        supabase.from("user_roles").select("id, user_id, role, status, requested_at"),
      ]);
      if (rolesError) throw rolesError;
      setUsers(authUsers);
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
      .update({ status: nextStatus, decided_at: new Date().toISOString(), decided_by: session?.user.id })
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
    await supabase.from("user_roles").delete().eq("user_id", userId).in("status", ["pending", "approved"]);
    const { error } = await supabase.from("user_roles").insert({
      user_id: userId,
      role,
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: session?.user.id,
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

  const pendingCount = Object.values(roles).filter((r) => r.status === "pending").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Users &amp; Roles</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Approve or deny role requests from sign-up, or grant/revoke access directly.
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
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users === null && !loadError && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {users?.map((u) => {
              const roleRow = roles[u.id];
              const busy = busyId === u.id;
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
    </div>
  );
}
