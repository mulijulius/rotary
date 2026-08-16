import { createFileRoute } from "@tanstack/react-router";

import { SectionHead } from "@/components/site/PageIntro";
import { areasOfFocus, fourWayTest, objectOfRotary } from "@/lib/club-content";

export const Route = createFileRoute("/causes")({
  head: () => ({
    meta: [
      { title: "Our Causes | Rotary Club of Athi River" },
      {
        name: "description",
        content:
          "Rotary's seven areas of focus and the guiding principles — the Four-Way Test, the Object of Rotary and the Rotary Grace.",
      },
      { property: "og:title", content: "Our Causes | Rotary Club of Athi River" },
      {
        property: "og:description",
        content: "The seven areas of focus guiding every project the Rotary Club of Athi River runs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CausesPage,
});

function CausesPage() {
  return (
    <>
      <section className="bg-mist py-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <SectionHead
            eyebrow="Our Causes"
            title="Rotary's Seven Areas of Focus"
            copy="Every project we run ties back to one of these globally recognized causes."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {areasOfFocus.map((a) => (
              <article
                key={a.title}
                className="rounded-xl border border-border bg-card p-7 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
              >
                <div className={`flex size-13 items-center justify-center rounded-xl text-xl ${a.tone}`}>
                  <span aria-hidden>{a.icon}</span>
                </div>
                <h4 className="mt-4 text-[17px]">{a.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{a.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <SectionHead
            eyebrow="What Guides Us"
            title="Our Guiding Principles"
            copy="Three texts every Rotarian carries — recited at meetings and applied in daily life."
          />
          <div className="grid gap-7 lg:grid-cols-3">
            <div className="rounded-2xl bg-linear-155 from-royal to-navy p-8 text-background shadow-[var(--shadow-card-lg)]">
              <h3 className="text-lg text-background">⚖️ The Four-Way Test</h3>
              <p className="mt-3 text-sm opacity-85">Of the things we think, say or do:</p>
              <ol className="mt-4 space-y-3">
                {fourWayTest.map((t, i) => (
                  <li key={t} className="flex gap-3 text-[14.5px] font-semibold">
                    <span className="flex size-5.5 flex-none items-center justify-center rounded-full bg-background/20 text-xs">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl bg-linear-155 from-gold to-gold-deep p-8 text-navy shadow-[var(--shadow-card-lg)]">
              <h3 className="text-lg text-navy">🌐 The Object of Rotary</h3>
              <p className="mt-3 text-sm opacity-90">
                To encourage and foster the ideal of service as a basis of worthy enterprise, and in particular to
                encourage and foster:
              </p>
              <ol className="mt-4 space-y-3 text-[14.5px]">
                {objectOfRotary.map((o) => (
                  <li key={o.ordinal}>
                    <b>{o.ordinal}</b> {o.text}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl bg-linear-155 from-azure to-royal p-8 text-background shadow-[var(--shadow-card-lg)]">
              <h3 className="text-lg text-background">🙏 The Rotary Grace</h3>
              <p className="mt-4 text-[15px] leading-8">
                Oh Lord and Giver of all Good,
                <br />
                We thank Thee for our daily food.
                <br />
                May Rotary friends and Rotary ways
                <br />
                Help us to serve Thee all our days.
              </p>
              <p className="mt-5 text-[13px] opacity-85">
                Traditionally recited before meals at Rotary meetings and gatherings.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
