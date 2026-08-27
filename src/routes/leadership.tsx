import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AdminNote, SectionHead } from "@/components/site/PageIntro";
import { fetchPublicBoard, type PublicBoardMember } from "@/lib/public-board";

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
  const [board, setBoard] = useState<PublicBoardMember[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicBoard()
      .then((data) => {
        if (!cancelled) setBoard(data);
      })
      .catch((err) => {
        console.error("[leadership] failed to load board positions", err);
        if (!cancelled) setBoard([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="2026–2027 Rotary Year"
          title="Club Leadership & Board"
          copy="Meet the officers and directors elected to lead the Rotary Club of Athi River this Rotary year."
        />

        {board === null && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]"
              >
                <div className="mx-auto size-[88px] rounded-full bg-muted" />
                <div className="mx-auto mt-4 h-4 w-2/3 rounded bg-muted" />
                <div className="mx-auto mt-2 h-3 w-1/2 rounded bg-muted" />
                <div className="mx-auto mt-3 h-10 w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {board?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-muted px-5 py-8 text-center text-sm text-muted-foreground">
            Board positions for this Rotary year haven't been published yet. Check back soon.
          </p>
        )}

        {board !== null && board.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {board.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
              >
                {p.photoUrl ? (
                  <img
                    src={p.photoUrl}
                    alt={p.fullName}
                    className="mx-auto size-[88px] rounded-full border-4 border-mist-strong object-cover"
                    onError={(e) => {
                      // Uploaded photo URL is broken/deleted — fall back to
                      // the initials avatar instead of a broken image icon.
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={`mx-auto flex size-[88px] items-center justify-center rounded-full border-4 border-mist-strong font-[family-name:var(--font-display)] text-[26px] font-bold text-primary-foreground ${p.tone} ${p.photoUrl ? "hidden" : ""}`}
                >
                  {p.initials}
                </div>
                <h4 className="mt-4 text-base">{p.fullName}</h4>
                <p className="mt-1 text-[12.5px] font-bold uppercase tracking-wide text-gold-deep">{p.title}</p>
                {p.bio ? <p className="mt-3 text-[13.5px] text-muted-foreground">{p.bio}</p> : null}
              </article>
            ))}
          </div>
        )}

        <AdminNote>
          <strong className="text-foreground">Admin note:</strong> Board positions, photos and bios are managed from
          the back-office Members → Board Positions module and update here automatically each Rotary year (1 July–30
          June).
        </AdminNote>
      </div>
    </section>
  );
}
