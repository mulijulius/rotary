import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
    { to: "/admin/members", label: "Members" },
    { to: "/admin/messages", label: "Messages" },
    { to: "/admin/users", label: "Users & Roles" },
    { to: "/admin/audit", label: "Role Audit Trail" },
  ],
  treasurer: [
    { to: "/admin", label: "Overview" },
    { to: "/admin/members", label: "Members" },
    { to: "/admin/messages", label: "Messages" },
  ],
  secretary: [
    { to: "/admin", label: "Overview" },
    { to: "/admin/members", label: "Members" },
    { to: "/admin/messages", label: "Messages" },
  ],
  editor: [
    { to: "/admin", label: "Overview" },
    { to: "/admin/messages", label: "Messages" },
  ],
  member: [{ to: "/admin", label: "Overview" }],
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
            : "This account hasn't requested a role yet. Sign up again to request one, or contact a club officer."
        }
        onSignOut={signOut}
        showSignupLink={roleStatus === null}
      />
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
  showSignupLink = false,
}: {
  title: string;
  body: string;
  onSignOut: () => void;
  showSignupLink?: boolean;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <RotaryWheel size={36} className="mx-auto" />
        <h1 className="mt-4 text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {showSignupLink && (
            <Link
              to="/signup"
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy transition-colors hover:bg-gold-deep"
            >
              Request a role
            </Link>
          )}
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
