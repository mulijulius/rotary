import { createFileRoute } from "@tanstack/react-router";

import { SectionHead } from "@/components/site/PageIntro";
import { CLUB, events } from "@/lib/club-content";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Club Calendar & Events | Rotary Club of Athi River" },
      {
        name: "description",
        content:
          "Weekly meetings, board meetings, fundraisers and service projects on the Rotary Club of Athi River calendar.",
      },
      { property: "og:title", content: "Club Calendar & Events | Rotary Club of Athi River" },
      {
        property: "og:description",
        content: "Upcoming meetings and events for the Rotary Club of Athi River, District 9212.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

const AUGUST_2026_OFFSET = 5; // 1 Aug 2026 falls on a Saturday
const MEETING_DAYS = [6, 13, 20, 27];

function EventsPage() {
  const cells = [
    ...Array.from({ length: AUGUST_2026_OFFSET }, () => null),
    ...Array.from({ length: 31 }, (_, i) => i + 1),
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="Events"
          title="Club Calendar"
          copy="Weekly meetings, fundraisers and service projects — kept up to date by the club secretary."
        />

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl">August 2026</h3>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Meetings highlighted
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={`${d}-${i}`} className="py-2 text-xs font-bold text-muted-foreground">
                  {d}
                </span>
              ))}
              {cells.map((day, i) => (
                <span
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-lg text-sm ${
                    day === null
                      ? ""
                      : MEETING_DAYS.includes(day)
                        ? "bg-primary font-bold text-primary-foreground"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {day ?? ""}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Weekly meeting: Thursdays, 12:30 PM · {CLUB.venue}
            </p>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            {events.map((e) => (
              <li key={`${e.day}-${e.title}`} className="flex items-center gap-4 p-5">
                <span className="flex size-14 flex-none flex-col items-center justify-center rounded-xl bg-mist-strong">
                  <span className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">{e.day}</span>
                  <span className="text-[11px] font-semibold uppercase text-gold-deep">{e.month}</span>
                </span>
                <span>
                  <h4 className="text-[15.5px]">{e.title}</h4>
                  <p className="text-sm text-muted-foreground">{e.detail}</p>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
