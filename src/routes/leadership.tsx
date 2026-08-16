import { createFileRoute } from "@tanstack/react-router";

import { AdminNote, SectionHead } from "@/components/site/PageIntro";
import { board } from "@/lib/club-content";

export const Route = createFileRoute("/leadership")({
  head: () => ({
    meta: [
      { title: "Club Leadership & Board | Rotary Club of Athi River" },
      {
        name: "description",
        content:
          "Meet the officers and directors elected to lead the Rotary Club of Athi River for the 2026–2027 Rotary year.",
      },
      { property: "og:title", content: "Club Leadership & Board | Rotary Club of Athi River" },
      {
        property: "og:description",
        content: "Officers and directors of the Rotary Club of Athi River, District 9212.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadershipPage,
});

function LeadershipPage() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="2026–2027 Rotary Year"
          title="Club Leadership & Board"
          copy="Meet the officers and directors elected to lead the Rotary Club of Athi River this Rotary year."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {board.map((p) => (
            <article
              key={p.name}
              className="rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <div
                className={`mx-auto flex size-[88px] items-center justify-center rounded-full border-4 border-mist-strong font-[family-name:var(--font-display)] text-[26px] font-bold text-primary-foreground ${p.tone}`}
              >
                {p.initials}
              </div>
              <h4 className="mt-4 text-base">{p.name}</h4>
              <p className="mt-1 text-[12.5px] font-bold uppercase tracking-wide text-gold-deep">{p.role}</p>
              <p className="mt-3 text-[13.5px] text-muted-foreground">{p.bio}</p>
            </article>
          ))}
        </div>
        <AdminNote>
          <strong className="text-foreground">Admin note:</strong> Board photos, bios and terms are managed from the
          back-office Members module and update here automatically each Rotary year (1 July–30 June).
        </AdminNote>
      </div>
    </section>
  );
}
