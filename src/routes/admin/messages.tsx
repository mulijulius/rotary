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

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessages,
});

type ContactMessage = Database["public"]["Tables"]["contact_messages"]["Row"];

function AdminMessages() {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (error) {
      console.error("[admin/messages] failed to load", error);
      toast.error("Couldn't load messages.");
      return;
    }
    setMessages(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleRead(m: ContactMessage) {
    setUpdatingId(m.id);
    const { error } = await supabase
      .from("contact_messages")
      .update({ is_read: !m.is_read })
      .eq("id", m.id);
    setUpdatingId(null);
    if (error) {
      console.error("[admin/messages] failed to update", error);
      toast.error("Couldn't update that message.");
      return;
    }
    setMessages(
      (prev) => prev?.map((x) => (x.id === m.id ? { ...x, is_read: !x.is_read } : x)) ?? prev,
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Contact Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enquiries submitted through the public contact form.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Received</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages === null && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {messages?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No messages yet.
                </TableCell>
              </TableRow>
            )}
            {messages?.map((m) => (
              <TableRow key={m.id} className={m.is_read ? "" : "bg-primary/5"}>
                <TableCell>
                  <Badge variant={m.is_read ? "outline" : "default"}>
                    {m.is_read ? "Read" : "New"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="font-semibold text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                  {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                </TableCell>
                <TableCell className="text-sm">{m.subject || "—"}</TableCell>
                <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                  {m.message}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(m.submitted_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => toggleRead(m)}
                    disabled={updatingId === m.id}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Mark {m.is_read ? "unread" : "read"}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
