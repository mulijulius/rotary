import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SectionHead } from "@/components/site/PageIntro";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

type NewsArticle = Database["public"]["Tables"]["news_articles"]["Row"];

const FALLBACK_TONE = "gradient-royal";

function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[] | null>(null);
  const [openArticle, setOpenArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    supabase
      .from("news_articles")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("[news] failed to load", error);
          setArticles([]);
          return;
        }
        setArticles(data);
      });
  }, []);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead eyebrow="News & Articles" title="Latest from the club" />

        {articles === null && (
          <p className="text-center text-sm text-muted-foreground">Loading articles…</p>
        )}
        {articles !== null && articles.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No published articles yet — check back soon.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          {articles?.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setOpenArticle(n)}
              className="flex overflow-hidden rounded-xl border border-border bg-card text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <div className={`w-32 flex-none ${n.cover_image_url ? "" : FALLBACK_TONE}`}>
                {n.cover_image_url && (
                  <img
                    src={n.cover_image_url}
                    alt={n.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-gold-deep">
                  {n.published_at
                    ? new Date(n.published_at).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : ""}
                </p>
                <h4 className="mt-2 text-[17px]">{n.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{n.excerpt}</p>
                <p className="mt-4 text-sm font-semibold text-primary">Read more →</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={openArticle !== null} onOpenChange={(v) => !v && setOpenArticle(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openArticle?.title}</DialogTitle>
          </DialogHeader>
          {openArticle && (
            <div className="space-y-4">
              {openArticle.cover_image_url && (
                <img
                  src={openArticle.cover_image_url}
                  alt={openArticle.title}
                  className="h-56 w-full rounded-lg object-cover"
                />
              )}
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {openArticle.body}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
