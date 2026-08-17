import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";
import { listAuthUsers } from "@/lib/admin.functions";
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

const ROLE_OPTIONS: (AppRole | "none")[] = [
  "none",
  "admin",
  "treasurer",
  "secretary",
  "editor",
  "member",
];

type AuthUser = { id: string; email: string; createdAt: string };

function AdminUsers() {
  const listAuthUsersFn = useServerFn(listAuthUsers);
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [roles, setRoles] = useState<Record<string, AppRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const [authUsers, { data: roleRows, error: rolesError }] = await Promise.all([
        listAuthUsersFn(),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (rolesError) throw rolesError;
      setUsers(authUsers);
      setRoles(Object.fromEntries((roleRows ?? []).map((r) => [r.user_id, r.role])));
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

  async function changeRole(userId: string, next: AppRole | "none") {
    setSavingId(userId);
    const previous = roles[userId];

    // A user can hold more than one role (unique on user_id+role), but this
    // dropdown models "one role at a time" — so replacing a role means
    // clearing any existing one for this user first, then adding the new one.
    const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    const insertError =
      next === "none"
        ? null
        : (await supabase.from("user_roles").insert({ user_id: userId, role: next })).error;

    setSavingId(null);
    const error = deleteError ?? insertError;

    if (error) {
      console.error("[admin/users] failed to update role", error);
      toast.error("Couldn't update that role.");
      return;
    }

    setRoles((prev) => {
      const copy = { ...prev };
      if (next === "none") delete copy[userId];
      else copy[userId] = next;
      return copy;
    });
    toast.success(previous ? "Role updated." : "Role granted.");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Users &amp; Roles</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Grant back-office access to signed-up accounts. New sign-ups start with no role.
      </p>

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
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users === null && !loadError && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {users?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-semibold text-foreground">{u.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <select
                    value={roles[u.id] ?? "none"}
                    disabled={savingId === u.id}
                    onChange={(e) => changeRole(u.id, e.target.value as AppRole | "none")}
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20 disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r === "none" ? "No role" : r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
