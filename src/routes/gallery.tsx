import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SectionHead } from "@/components/site/PageIntro";
import { supabase } from "@/integrations/supabase/client";
import { fetchGalleryPhotos, type GalleryPhoto } from "@/lib/content-photos";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

type GalleryAlbum = Database["public"]["Tables"]["gallery_albums"]["Row"];

const FALLBACK_TONE = "gradient-aqua";

function GalleryPage() {
  const [albums, setAlbums] = useState<GalleryAlbum[] | null>(null);
  const [openAlbum, setOpenAlbum] = useState<GalleryAlbum | null>(null);
  const [openPhotos, setOpenPhotos] = useState<GalleryPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    supabase
      .from("gallery_albums")
      .select("*")
      .eq("published", true)
      .order("event_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("[gallery] failed to load", error);
          setAlbums([]);
          return;
        }
        setAlbums(data);
      });
  }, []);

  async function handleOpenAlbum(album: GalleryAlbum) {
    setOpenAlbum(album);
    setLoadingPhotos(true);
    try {
      setOpenPhotos(await fetchGalleryPhotos(album.id));
    } catch (err) {
      console.error("[gallery] failed to load photos", err);
      setOpenPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="Gallery"
          title="Moments from our club"
          copy="Photos from meetings, projects and fellowship events. Members can upload directly from the back office."
        />

        {albums === null && (
          <p className="text-center text-sm text-muted-foreground">Loading albums…</p>
        )}
        {albums !== null && albums.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No published albums yet — check back soon.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {albums?.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleOpenAlbum(a)}
              className={`group relative flex aspect-4/3 items-end overflow-hidden rounded-xl ${a.cover_image_url ? "" : FALLBACK_TONE} shadow-[var(--shadow-card)]`}
            >
              {a.cover_image_url && (
                <img
                  src={a.cover_image_url}
                  alt={a.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <figcaption className="relative w-full bg-navy/55 px-4 py-3 backdrop-blur-sm transition-colors group-hover:bg-navy/75">
                <span className="block text-sm font-semibold text-background">{a.title}</span>
                <span className="block text-xs text-mist-strong/80">
                  {a.event_date
                    ? new Date(a.event_date).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })
                    : ""}
                </span>
              </figcaption>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={openAlbum !== null} onOpenChange={(v) => !v && setOpenAlbum(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openAlbum?.title}</DialogTitle>
          </DialogHeader>
          {loadingPhotos && <p className="text-sm text-muted-foreground">Loading photos…</p>}
          {!loadingPhotos && openPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {openPhotos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.image_url}
                  alt={photo.caption || openAlbum?.title || ""}
                  className="aspect-square rounded-md object-cover"
                />
              ))}
            </div>
          )}
          {!loadingPhotos && openPhotos.length === 0 && (
            <p className="text-sm text-muted-foreground">No photos in this album yet.</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
