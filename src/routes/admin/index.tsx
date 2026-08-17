import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleLabel, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

type Card = { label: string; value: number | string | null; to?: string };

function AdminOverview() {
  const { role } = useAuth();
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;

    async function load() {
      const next = await loadCardsForRole(role);
      if (!cancelled) setCards(next);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {role ? `${roleLabel(role)} Overview` : "Overview"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Quick snapshot of what needs attention.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(cards ?? []).map((c) => {
          const content = (
            <>
              <p className="text-3xl font-bold text-foreground">{c.value ?? "—"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
            </>
          );
          return c.to ? (
            <Link
              key={c.label}
              to={c.to}
              className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-colors hover:border-primary"
            >
              {content}
            </Link>
          ) : (
            <div
              key={c.label}
              className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              {content}
            </div>
          );
        })}
        {cards === null && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  );
}

async function loadCardsForRole(role: AppRole): Promise<Card[]> {
  switch (role) {
    case "admin": {
      const [pending, unread, active] = await Promise.all([
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return [
        { label: "Pending Role Requests", value: pending.count ?? 0, to: "/admin/users" },
        { label: "Unread Contact Messages", value: unread.count ?? 0, to: "/admin/messages" },
        { label: "Active Members", value: active.count ?? 0, to: "/admin/members" },
      ];
    }

    case "treasurer": {
      const [openInvoices, openBills] = await Promise.all([
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .in("status", ["issued", "partially_paid"]),
        supabase
          .from("bills")
          .select("id", { count: "exact", head: true })
          .in("status", ["received", "partially_paid"]),
      ]);
      return [
        { label: "Open Invoices", value: openInvoices.count ?? 0 },
        { label: "Unpaid Bills", value: openBills.count ?? 0 },
      ];
    }

    case "secretary": {
      const today = new Date().toISOString().slice(0, 10);
      const [upcoming, unread] = await Promise.all([
        supabase
          .from("meetings")
          .select("id", { count: "exact", head: true })
          .gte("meeting_date", today),
        supabase
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false),
      ]);
      return [
        { label: "Upcoming Meetings", value: upcoming.count ?? 0 },
        { label: "Unread Contact Messages", value: unread.count ?? 0, to: "/admin/messages" },
      ];
    }

    case "editor": {
      const [draftNews, draftProjects, unread] = await Promise.all([
        supabase.from("news_articles").select("id", { count: "exact", head: true }).eq("published", false),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("published", false),
        supabase
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false),
      ]);
      return [
        { label: "Draft News Articles", value: draftNews.count ?? 0 },
        { label: "Unpublished Projects", value: draftProjects.count ?? 0 },
        { label: "Unread Contact Messages", value: unread.count ?? 0, to: "/admin/messages" },
      ];
    }

    case "member": {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      const { data: memberRow } = userId
        ? await supabase.from("members").select("id, first_name").eq("user_id", userId).maybeSingle()
        : { data: null };

      if (!memberRow) {
        return [{ label: "Member Profile", value: "Not linked yet" }];
      }

      const [balance, attendance] = await Promise.all([
        supabase.from("v_member_balances").select("balance_due").eq("member_id", memberRow.id).maybeSingle(),
        supabase
          .from("v_attendance_summary")
          .select("attendance_pct")
          .eq("member_id", memberRow.id)
          .maybeSingle(),
      ]);

      return [
        {
          label: "Balance Due (KES)",
          value: balance.data?.balance_due != null ? Number(balance.data.balance_due).toLocaleString() : 0,
        },
        {
          label: "Attendance",
          value: attendance.data?.attendance_pct != null ? `${attendance.data.attendance_pct}%` : "—",
        },
      ];
    }

    default:
      return [];
  }
}
