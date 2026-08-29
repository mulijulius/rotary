import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Video as VideoIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { SectionHead } from "@/components/site/PageIntro";
import { extractYouTubeId } from "@/lib/slideshow-videos";

type Video = Database["public"]["Tables"]["gallery_videos"]["Row"];

// Horizontally-scrolling video library, placed just after "Get Involved" on
// the home page. Editors add videos (uploads or YouTube links) from
// Gallery > Videos in the admin portal; anything published shows up here,
// first-added on the left through most-recent on the right, in a
// scroll-snapped row users can drag/scroll or step through with the arrows.
// Renders nothing if there are no published videos.
export function HomeVideos() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("gallery_videos")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("[HomeVideos] failed to load videos", error);
          setVideos([]);
          return;
        }
        setVideos(data);
      });
  }, []);

  function scrollByCard(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-video-card]");
    const step = card ? card.offsetWidth + 24 /* gap-6 */ : track.clientWidth * 0.9;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  if (!videos || videos.length === 0) return null;

  return (
    <section className="bg-mist py-22">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="Videos" title="See it in action" />
          {videos.length > 1 && (
            <div className="-mt-12 mb-12 flex gap-2 sm:mt-0 sm:mb-0">
              <button
                type="button"
                aria-label="Scroll to previous video"
                onClick={() => scrollByCard(-1)}
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Scroll to next video"
                onClick={() => scrollByCard(1)}
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {videos.map((video) => (
            <div
              key={video.id}
              data-video-card
              className="w-[min(85vw,420px)] flex-none snap-start overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]"
            >
              <VideoPlayer video={video} />
              <div className="p-5">
                <h4 className="text-[16px]">{video.title}</h4>
                {video.description ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">{video.description}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoPlayer({ video }: { video: Video }) {
  if (video.source === "youtube") {
    const id = extractYouTubeId(video.video_url);
    if (!id) {
      return (
        <div className="flex aspect-video items-center justify-center bg-navy text-background/70">
          <VideoIcon className="size-8" />
        </div>
      );
    }
    return (
      <div className="aspect-video bg-navy">
        <iframe
          src={`https://www.youtube.com/embed/${id}?rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <video
      src={video.video_url}
      poster={video.thumbnail_url || undefined}
      controls
      preload="metadata"
      className="aspect-video w-full bg-black"
    >
      Your browser doesn&apos;t support embedded video.
    </video>
  );
}
