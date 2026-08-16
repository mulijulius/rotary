import { createFileRoute } from "@tanstack/react-router";

import { SectionHead } from "@/components/site/PageIntro";
import { news } from "@/lib/club-content";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Club News & Articles | Rotary Club of Athi River" },
      {
        name: "description",
        content:
          "Latest announcements, project handovers and member news from the Rotary Club of Athi River, District 9212.",
      },
      { property: "og:title", content: "Club News & Articles | Rotary Club of Athi River" },
      {
        property: "og:description",
        content: "Announcements and updates from the Rotary Club of Athi River.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead eyebrow="News & Articles" title="Latest from the club" />
        <div className="grid gap-6 sm:grid-cols-2">
          {news.map((n) => (
            <article
              key={n.title}
              className="flex overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <div className={`w-32 flex-none ${n.tone}`} />
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-gold-deep">{n.date}</p>
                <h4 className="mt-2 text-[17px]">{n.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{n.copy}</p>
                <p className="mt-4 text-sm font-semibold text-primary">Read more →</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
