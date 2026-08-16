import { Link } from "@tanstack/react-router";

import { RotaryWheel } from "./RotaryWheel";
import { CLUB } from "@/lib/club-content";

export function SiteFooter() {
  return (
    <footer className="bg-navy text-mist">
      <div className="mx-auto max-w-[1180px] px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <RotaryWheel size={34} />
              <span className="font-[family-name:var(--font-display)] text-[15px] font-bold text-background">
                {CLUB.name}
              </span>
            </div>
            <p className="mt-4 text-sm text-mist-strong/70">
              Part of Rotary International, {CLUB.district}. {CLUB.motto}.
            </p>
          </div>

          <div>
            <h5 className="text-sm font-bold uppercase tracking-wider text-gold">Explore</h5>
            <ul className="mt-4 space-y-2 text-sm text-mist-strong/70">
              <li><Link to="/causes" className="hover:text-gold">Our Causes</Link></li>
              <li><Link to="/projects" className="hover:text-gold">Projects</Link></li>
              <li><Link to="/events" className="hover:text-gold">Events</Link></li>
              <li><Link to="/gallery" className="hover:text-gold">Gallery</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-bold uppercase tracking-wider text-gold">Club</h5>
            <ul className="mt-4 space-y-2 text-sm text-mist-strong/70">
              <li><Link to="/leadership" className="hover:text-gold">Leadership</Link></li>
              <li><Link to="/news" className="hover:text-gold">News</Link></li>
              <li><Link to="/contact" className="hover:text-gold">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-bold uppercase tracking-wider text-gold">Rotary International</h5>
            <p className="mt-4 text-sm text-mist-strong/70">
              Learn more about the global organization at rotary.org
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-mist-strong/15 pt-6 text-xs text-mist-strong/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 {CLUB.name}. All rights reserved.</span>
          <span>Content is placeholder pending club approval</span>
        </div>
      </div>
    </footer>
  );
}
