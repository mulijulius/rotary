import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Slide = Database["public"]["Tables"]["slideshow_slides"]["Row"];

const AUTOPLAY_MS = 6000;

// Auto-rotating image slideshow for the public home page, rendered just
// below the site header. Editors manage the slides (and each slide's
// foreground caption text) from Gallery > Slideshow in the back office.
// Renders nothing while loading and nothing at all if no slides are
// published, so the homepage layout never shows an empty gap.
export function HomeSlideshow() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    supabase
      .from("slideshow_slides")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("[HomeSlideshow] failed to load slides", error);
          setSlides([]);
          return;
        }
        setSlides(data);
      });
  }, []);

  const count = slides?.length ?? 0;

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      setActive(((index % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count]);

  if (!slides || slides.length === 0) return null;

  return (
    <section
      aria-label="Club highlights slideshow"
      className="relative w-full overflow-hidden bg-navy"
    >
      <div className="relative aspect-[16/7] min-h-[260px] w-full sm:aspect-[16/6]">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden={i !== active}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              i === active ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* Blurred, scaled-up backdrop so the fixed-height section never
                shows empty bars, while the real image below stays uncropped. */}
            <img
              src={slide.image_url}
              alt=""
              aria-hidden="true"
              className="h-full w-full scale-110 object-cover opacity-60 blur-2xl"
            />
            <img
              src={slide.image_url}
              alt={slide.caption || ""}
              className="absolute inset-0 h-full w-full object-contain"
              loading={i === 0 ? "eager" : "lazy"}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/10 to-transparent" />
            {slide.caption ? (
              <div className="absolute inset-x-0 bottom-0 px-6 pb-8 sm:px-10 sm:pb-12">
                <p className="mx-auto max-w-[1180px] text-[clamp(18px,3vw,32px)] font-bold text-background drop-shadow-md">
                  {slide.caption}
                </p>
              </div>
            ) : null}
          </div>
        ))}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => goTo(active - 1)}
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/20 text-background backdrop-blur-sm transition-colors hover:bg-background/35 sm:left-5"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => goTo(active + 1)}
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/20 text-background backdrop-blur-sm transition-colors hover:bg-background/35 sm:right-5"
            >
              <ChevronRight className="size-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === active ? "w-6 bg-gold" : "w-1.5 bg-background/50 hover:bg-background/75"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
