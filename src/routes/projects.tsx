import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AdminNote, SectionHead } from "@/components/site/PageIntro";
import { projectFilters, projects } from "@/lib/club-content";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Community Projects | Rotary Club of Athi River" },
      {
        name: "description",
        content:
          "Boreholes, scholarships, health camps and tree planting — stories from community projects delivered by the Rotary Club of Athi River.",
      },
      { property: "og:title", content: "Community Projects | Rotary Club of Athi River" },
      {
        property: "og:description",
        content: "Photos and updates from service projects across Athi River and Machakos County.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [filter, setFilter] = useState(projectFilters[0]);
  const visible = filter === projectFilters[0] ? projects : projects.filter((p) => p.area === filter);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="Our Projects"
          title="Stories from the ground"
          copy="Photos and updates from community projects delivered by the Rotary Club of Athi River."
        />

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {projectFilters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <article
              key={p.title}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <div className={`relative h-44 ${p.tone}`}>
                <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-navy">
                  {p.area}
                </span>
              </div>
              <div className="p-6">
                <h4 className="text-[17px]">{p.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{p.copy}</p>
                <div className="mt-4 flex justify-between border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
                  <span>{p.date}</span>
                  <span>{p.photos}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <AdminNote>
          <strong className="text-foreground">Admin note:</strong> Club officers can upload project photos and
          write-ups from the back-office Projects module — each entry supports a photo gallery, story text, budget
          summary and area-of-focus tag, and publishes here automatically.
        </AdminNote>
      </div>
    </section>
  );
}
