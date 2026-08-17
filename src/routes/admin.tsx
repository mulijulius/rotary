import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";

import { RotaryWheel } from "@/components/site/RotaryWheel";
import { CLUB } from "@/lib/club-content";
import { isOfficerRole, roleLabel, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin | Rotary Club of Athi River" }],
  }),
  component: AdminLayout,
});

// NOTE ON THIS GUARD: Supabase sessions here are stored client-side only
// (see src/integrations/supabase/client.ts — localStorage, no session cookie),
// so there is nothing for a server-side beforeLoad to check on the first
// request. The guard below runs client-side after hydration instead, and
// renders nothing (no protected content, no layout chrome) until the auth
// check resolves — this avoids flashing admin content to a logged-out
// visitor, at the cost of a brief blank screen on first load. Moving this to
// a real beforeLoad-based guard would require server-side session cookies
// (see the auth-server-primitives pattern) rather than localStorage-only auth.
const adminLinks = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/messages", label: "Contact Messages", exact: false },
  { to: "/admin/members", label: "Members", exact: false },
  { to: "/admin/users", label: "Users & Roles", exact: false },
] as const;

function AdminLayout() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (!isOfficerRole(role)) {
      toast.error(
        "Your account doesn't have an assigned role yet. Ask an admin to grant you access.",
      );
      navigate({ to: "/" });
    }
  }, [loading, session, role, navigate]);

  if (loading || !session || !isOfficerRole(role)) {
    // Blank on purpose — see NOTE above. Avoids showing admin chrome/content
    // before we know whether this visitor is actually allowed to see it.
    return <div className="min-h-screen bg-background" />;
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const visibleLinks = adminLinks.filter((l) => l.to !== "/admin/users" || role === "admin");

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 md:flex-row">
      {/* Mobile top bar — the sidebar below is md:flex only, so this is the
          entire nav on small screens (hamburger toggles the panel beneath it). */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-2.5">
          <RotaryWheel size={26} />
          <span className="text-[13px] font-bold text-navy">Back Office</span>
        </div>
        <button
          type="button"
          aria-label="Toggle admin navigation"
          onClick={() => setMobileNavOpen((v) => !v)}
          className="rounded-md p-2 text-navy"
        >
          {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {mobileNavOpen ? (
        <nav className="border-b border-border bg-card px-3 py-2 md:hidden">
          {visibleLinks.map((l) => {
            const active = l.exact ? pathname === l.to : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileNavOpen(false)}
                className={`block rounded-lg px-3.5 py-2.5 text-sm font-semibold ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-border pt-2">
            <p className="px-3.5 pb-2 text-xs text-muted-foreground">
              Signed in as{" "}
              <span className="font-semibold text-foreground">{session.user.email}</span>
              {role ? ` · ${roleLabel(role)}` : ""}
            </p>
            <button
              onClick={handleSignOut}
              className="w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Sign out
            </button>
            <Link
              to="/"
              onClick={() => setMobileNavOpen(false)}
              className="mt-1 block w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              ← Back to site
            </Link>
          </div>
        </nav>
      ) : null}

      <aside className="hidden w-64 flex-none flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <RotaryWheel size={30} />
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-navy">{CLUB.name}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-deep">
              Back Office
            </p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {visibleLinks.map((l) => {
            const active = l.exact ? pathname === l.to : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border p-3">
          <p className="px-3.5 pb-2 text-xs text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{session.user.email}</span>
            {role ? ` · ${roleLabel(role)}` : ""}
          </p>
          <button
            onClick={handleSignOut}
            className="w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Sign out
          </button>
          <Link
            to="/"
            className="mt-1 block w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ← Back to site
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
