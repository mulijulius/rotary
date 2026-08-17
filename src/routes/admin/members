import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
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

function AdminMembers() {
  const [members, setMembers] = useState<Member[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("last_name", { ascending: true });
      if (error) {
        console.error("[admin/members] failed to load", error);
        toast.error("Couldn't load members. You may not have permission to view the roster.");
        return;
      }
      setMembers(data);
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Club roster. New members are added here once formally inducted with an RI number.
      </p>

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {members === null && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {members?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
