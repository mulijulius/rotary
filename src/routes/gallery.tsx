import { createFileRoute } from "@tanstack/react-router";

import { SectionHead } from "@/components/site/PageIntro";
import { galleryAlbums } from "@/lib/club-content";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Photo Gallery | Rotary Club of Athi River" },
      {
        name: "description",
        content:
          "Photo albums from meetings, service projects and fellowship events of the Rotary Club of Athi River.",
      },
      { property: "og:title", content: "Photo Gallery | Rotary Club of Athi River" },
      {
        property: "og:description",
        content: "Moments from club meetings, projects and fellowship gatherings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="Gallery"
          title="Moments from our club"
          copy="Photos from meetings, projects and fellowship events. Members can upload directly from the back office."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {galleryAlbums.map((a) => (
            <figure
              key={a.title}
              className={`group relative flex aspect-4/3 items-end overflow-hidden rounded-xl ${a.tone} shadow-[var(--shadow-card)]`}
            >
              <figcaption className="w-full bg-navy/55 px-4 py-3 backdrop-blur-sm transition-colors group-hover:bg-navy/75">
                <span className="block text-sm font-semibold text-background">{a.title}</span>
                <span className="block text-xs text-mist-strong/80">{a.date}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
