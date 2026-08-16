import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { RotaryWheel } from "./RotaryWheel";
import { CLUB } from "@/lib/club-content";

const links = [
  { to: "/", label: "Home" },
  { to: "/leadership", label: "Leadership" },
  { to: "/causes", label: "Our Causes" },
  { to: "/projects", label: "Projects" },
  { to: "/events", label: "Events" },
  { to: "/gallery", label: "Gallery" },
  { to: "/news", label: "News" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-3">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <RotaryWheel size={40} />
          <span className="leading-tight">
            <span className="block font-[family-name:var(--font-display)] text-[16px] font-bold text-navy">
              {CLUB.name}
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-gold-deep">
              {CLUB.motto}
            </span>
          </span>
        </Link>

        <nav className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  activeOptions={{ exact: l.to === "/" }}
                  activeProps={{ className: "bg-primary text-primary-foreground" }}
                  inactiveProps={{ className: "text-muted-foreground hover:bg-muted hover:text-primary" }}
                  className="rounded-full px-4 py-2.5 text-[14.5px] font-semibold transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/contact"
            className="hidden rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-royal sm:inline-flex"
          >
            Join Us
          </Link>
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-2 text-navy xl:hidden"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-border bg-background xl:hidden">
          <ul className="mx-auto max-w-[1180px] px-4 py-2">
            {links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  activeOptions={{ exact: l.to === "/" }}
                  activeProps={{ className: "text-primary" }}
                  inactiveProps={{ className: "text-foreground" }}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
