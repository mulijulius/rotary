import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { toast } from "sonner";

import { RotaryWheel } from "@/components/site/RotaryWheel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleLabel, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

type NavItem = { to: string; label: string };

// What each role sees in the Back Office side nav. Everyone gets Overview;
// beyond that, nav mirrors what the row-level security policies already
// grant that role, so nothing here is a false promise.
const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  admin: [
    { to: "/admin", label: "Overview" },
    { to: "/admin/profile", label: "My Profile" },
    { to: "/admin/scan", label: "Scan Attendance" },
    // Membership Module
    { to: "/admin/members", label: "Members" },
    { to: "/admin/visitors", label: "Visitors" },
    { to: "/admin/meetings", label: "Meetings" },
    { to: "/admin/board-positions", label: "Board Positions" },
    // Accounting Module
    { to: "/admin/fiscal-years", label: "Fiscal Years" },
    { to: "/admin/funds", label: "Funds" },
    { to: "/admin/accounts", label: "Chart of Accounts" },
    { to: "/admin/journal-entries", label: "Journal Entries" },
    { to: "/admin/invoices", label: "Invoices" },
    { to: "/admin/bills", label: "Bills" },
    { to: "/admin/reports", label: "Financial Reports" },
    // Inventory Module
    { to: "/admin/inventory", label: "Inventory" },
    { to: "/admin/product-orders", label: "Product Orders" },
    // Communications
    { to: "/admin/email-campaigns", label: "Email Campaigns" },
    { to: "/admin/messages", label: "Messages" },
    // Administration
    { to: "/admin/users", label: "Users & Roles" },
    { to: "/admin/audit", label: "Role Audit Trail" },
  ],
  treasurer: [
    { to: "/admin", label: "Overview" },
    { to: "/admin/profile", label: "My Profile" },
    { to: "/admin/scan", label: "Scan Attendance" },
    { to: "/admin/fiscal-years", label: "Fiscal Years" },
    { to: "/admin/funds", label: "Funds" },
    { to: "/admin/accounts", label: "Chart of Accounts" },
    { to: "/admin/journal-entries", label: "Journal Entries" },
    { to: "/admin/invoices", label: "Invoices" },
    { to: "/admin/bills", label: "Bills" },
    { to: "/admin/reports", label: "Financial Reports" },
    { to: "/admin/inventory", label: "Inventory" },
    { to: "/admin/product-orders", label: "Product Orders" },
    { to: "/admin/members", label: "Members" },
    { to: "/admin/messages", label: "Messages" },
  ],
  secretary: [
    { to: "/admin", label: "Overview" },
    { to: "/admin/profile", label: "My Profile" },
    { to: "/admin/scan", label: "Scan Attendance" },
    { to: "/admin/members", label: "Members" },
    { to: "/admin/visitors", label: "Visitors" },
    { to: "/admin/meetings", label: "Meetings" },
    { to: "/admin/board-positions", label: "Board Positions" },
    { to: "/admin/email-campaigns", label: "Email Campaigns" },
    { to: "/admin/messages", label: "Messages" },
  ],
  editor: [
    { to: "/admin", label: "Overview" },
    { to: "/admin/profile", label: "My Profile" },
    { to: "/admin/scan", label: "Scan Attendance" },
    { to: "/admin/projects", label: "Projects" },
    { to: "/admin/news", label: "News Articles" },
    { to: "/admin/gallery", label: "Gallery" },
    { to: "/admin/messages", label: "Messages" },
  ],
  member: [
    { to: "/admin", label: "Overview" },
    { to: "/admin/profile", label: "My Profile" },
    { to: "/admin/scan", label: "Scan Attendance" },
    { to: "/admin/shop", label: "Shop" },
  ],
};

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { loading, session, role, roleStatus, requestedRole } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out.");
    navigate({ to: "/login" });
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (roleStatus === "pending") {
    return (
      <StatusScreen
        title="Request pending"
        body={`Your request for the ${requestedRole ? roleLabel(requestedRole) : ""} role is waiting on an admin to approve it. Check back soon, or reach out to a club officer.`}
        onSignOut={signOut}
      />
    );
  }

  if (roleStatus === "revoked" || roleStatus === null || !role) {
    return (
      <StatusScreen
        title={roleStatus === "revoked" ? "Access revoked" : "No role on file"}
        body={
          roleStatus === "revoked"
            ? "An admin has revoked your back-office access. Contact a club officer if you believe this is a mistake."
            : "This account hasn't requested a role yet. Pick one below to file a request, or contact a club officer."
        }
        onSignOut={signOut}
      >
        {roleStatus === null && <RequestRoleForm userId={session.user.id} />}
      </StatusScreen>
    );
  }

  const navItems = NAV_BY_ROLE[role];

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <RotaryWheel size={32} />
            <div>
              <p className="text-[15px] font-bold text-navy">Back Office</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold-deep">
                {roleLabel(role)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={signOut}
              className="hidden items-center gap-1.5 rounded-full border border-input px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted sm:inline-flex"
            >
              <LogOut size={14} /> Sign out
            </button>
            <button
              type="button"
              aria-label="Toggle back office navigation"
              onClick={() => setNavOpen((v) => !v)}
              className="rounded-md p-2 text-navy lg:hidden"
            >
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1180px] gap-8 px-6 py-8">
        <nav className={`${navOpen ? "block" : "hidden"} w-full shrink-0 lg:block lg:w-56`}>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.to || pathname === `${item.to}/`;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setNavOpen(false)}
                    className={`block rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="pt-2 sm:hidden">
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                <LogOut size={14} /> Sign out
              </button>
            </li>
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function StatusScreen({
  title,
  body,
  onSignOut,
  children,
}: {
  title: string;
  body: string;
  onSignOut: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <RotaryWheel size={36} className="mx-auto" />
        <h1 className="mt-4 text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {children}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-full border border-input px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

const REQUESTABLE_ROLES: AppRole[] = ["member", "editor", "secretary", "treasurer", "admin"];

// Lets an already-authenticated user with no live user_roles row (most
// commonly a first-time Google sign-in, which never gets to fill in the
// requested_role passed via the password sign-up form) file a pending role
// request directly, instead of being sent back through /signup — which
// would try to create a second, conflicting account for the same email.
function RequestRoleForm({ userId }: { userId: string }) {
  const [role, setRole] = useState<AppRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role, status: "pending" });
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Could not file that request.");
      return;
    }

    toast.success(`Request for ${roleLabel(role)} filed — an admin needs to approve it.`);
    setSubmitted(true);
    // Reload so useAuth() picks up the new pending row and the layout
    // switches to the "Request pending" screen.
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 text-left">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-foreground">Role you're requesting</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
          className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20"
        >
          {REQUESTABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={submitting || submitted}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy transition-colors hover:bg-gold-deep disabled:opacity-60"
      >
        {submitting ? "Filing request…" : "Request this role"}
      </button>
    </form>
  );
}
