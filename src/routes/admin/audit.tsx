import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { fetchRoleAudit } from "@/lib/member-requests";
import { roleLabel } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAudit,
});

type AuditRow = {
  id: number;
  subject_email: string | null;
  role: string;
  action: "requested" | "approved" | "revoked";
  actor_email: string | null;
  decided_at: string;
};

function AdminAudit() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoleAudit()
      .then((data) => setRows(data as AuditRow[]))
      .catch((err) => {
        console.error("[admin/audit] failed to load", err);
        setError(err instanceof Error ? err.message : "Failed to load audit trail.");
      });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Role Audit Trail</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every role request, approval, and revocation — who decided, and when.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Decided By</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && !error && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No role decisions yet.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-semibold text-foreground">{r.subject_email ?? "—"}</TableCell>
                <TableCell>{roleLabel(r.role as never)}</TableCell>
                <TableCell>
                  {r.action === "approved" && <Badge>Approved</Badge>}
                  {r.action === "revoked" && <Badge variant="destructive">Revoked</Badge>}
                  {r.action === "requested" && <Badge variant="secondary">Requested</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.actor_email ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.decided_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
