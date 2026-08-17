import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

type Counts = {
  unreadMessages: number | null;
  activeMembers: number | null;
};

function AdminOverview() {
  const [counts, setCounts] = useState<Counts>({ unreadMessages: null, activeMembers: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [messagesRes, membersRes] = await Promise.all([
        supabase
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false),
        supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
      ]);
      if (cancelled) return;
      setCounts({
        unreadMessages: messagesRes.count ?? 0,
        activeMembers: membersRes.count ?? 0,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      label: "Unread Contact Messages",
      value: counts.unreadMessages,
      to: "/admin/messages",
    },
    {
      label: "Active Members",
      value: counts.activeMembers,
      to: "/admin/members",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Quick snapshot of what needs attention.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-colors hover:border-primary"
          >
            <p className="text-3xl font-bold text-foreground">{c.value ?? "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
