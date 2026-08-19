import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Images } from "lucide-react";

import { AdminNote, SectionHead } from "@/components/site/PageIntro";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjectPhotos, type ProjectPhoto } from "@/lib/content-photos";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

type Project = Database["public"]["Tables"]["projects"]["Row"];

const FALLBACK_TONE = "bg-royal-bright";

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [areas, setAreas] = useState<string[]>(["All Projects"]);
  const [filter, setFilter] = useState("All Projects");
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [openPhotos, setOpenPhotos] = useState<ProjectPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    supabase
      .from("projects")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("[projects] failed to load", error);
          setProjects([]);
          return;
        }
        setProjects(data);
        const uniqueAreas = Array.from(new Set(data.map((p) => p.area_of_focus)));
        setAreas(["All Projects", ...uniqueAreas]);
      });
  }, []);

  async function handleOpenProject(project: Project) {
    setOpenProject(project);
    setLoadingPhotos(true);
    try {
      setOpenPhotos(await fetchProjectPhotos(project.id));
    } catch (err) {
      console.error("[projects] failed to load photos", err);
      setOpenPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }

  const visible =
    filter === "All Projects"
      ? (projects ?? [])
      : (projects ?? []).filter((p) => p.area_of_focus === filter);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="Our Projects"
          title="Stories from the ground"
          copy="Photos and updates from community projects delivered by the Rotary Club of Athi River."
        />

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {areas.map((f) => (
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

        {projects === null && (
          <p className="text-center text-sm text-muted-foreground">Loading projects…</p>
        )}

        {projects !== null && visible.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No published projects yet — check back soon.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleOpenProject(p)}
              className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <div className={`relative h-44 ${p.cover_image_url ? "" : FALLBACK_TONE}`}>
                {p.cover_image_url ? (
                  <img
                    src={p.cover_image_url}
                    alt={p.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-navy">
                  {p.area_of_focus}
                </span>
              </div>
              <div className="p-6">
                <h4 className="text-[17px]">{p.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{p.summary}</p>
                <div className="mt-4 flex justify-between border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
                  <span>
                    {p.start_date
                      ? new Date(p.start_date).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })
                      : p.status}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Images className="h-3.5 w-3.5" /> View photos
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <AdminNote>
          <strong className="text-foreground">Admin note:</strong> Club officers can upload project
          photos and write-ups from the back-office Projects module — each entry supports a photo
          gallery, story text, budget summary and area-of-focus tag, and publishes here
          automatically.
        </AdminNote>
      </div>

      <Dialog open={openProject !== null} onOpenChange={(v) => !v && setOpenProject(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openProject?.title}</DialogTitle>
          </DialogHeader>
          {openProject && (
            <div className="space-y-4">
              {openProject.cover_image_url && (
                <img
                  src={openProject.cover_image_url}
                  alt={openProject.title}
                  className="h-56 w-full rounded-lg object-cover"
                />
              )}
              {openProject.story && (
                <p className="text-sm text-muted-foreground">{openProject.story}</p>
              )}

              {loadingPhotos && <p className="text-sm text-muted-foreground">Loading photos…</p>}
              {!loadingPhotos && openPhotos.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">Photo Gallery</p>
                  <div className="grid grid-cols-3 gap-2">
                    {openPhotos.map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.image_url}
                        alt={photo.caption || openProject.title}
                        className="aspect-square rounded-md object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
              {!loadingPhotos && openPhotos.length === 0 && (
                <p className="text-sm text-muted-foreground">No additional photos yet.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
