import { createFileRoute, Link } from "@tanstack/react-router";

import { Eyebrow, SectionHead } from "@/components/site/PageIntro";
import { RotaryWheel } from "@/components/site/RotaryWheel";
import { CLUB, focusPreview, heroStats, homeHighlights } from "@/lib/club-content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rotary Club of Athi River | People of Action, District 9212" },
      {
        name: "description",
        content:
          "The Rotary Club of Athi River unites local professionals taking action on water, education, health and economic opportunity in Machakos County, Kenya.",
      },
      { property: "og:title", content: "Rotary Club of Athi River | People of Action" },
      {
        property: "og:description",
        content:
          "Service Above Self — community projects, weekly meetings and membership in Athi River, Rotary District 9212.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <section className="hero-surface relative overflow-hidden py-24 text-background">
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/10 px-3.5 py-1.5 text-[12.5px] font-bold uppercase tracking-[0.09em] text-gold">
              <span className="size-1.5 rounded-full bg-gold" />
              {CLUB.district} · Chartered [Year]
            </span>
            <h1 className="mt-4 text-[clamp(34px,5vw,54px)] text-background">
              People of action, <em className="not-italic text-gold">serving Athi River</em> and beyond.
            </h1>
            <p className="mt-4 max-w-[520px] text-[18px] text-mist-strong/85">
              We are a chapter of Rotary International bringing together local business and professional leaders to
              take practical action on education, health, water, and economic opportunity in our community.
            </p>
            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                to="/projects"
                className="rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-navy transition-colors hover:bg-gold-deep"
              >
                See Our Projects
              </Link>
              <Link
                to="/contact"
                className="rounded-full border-2 border-background/55 px-6 py-3 text-[15px] font-semibold text-background transition-colors hover:bg-background/15"
              >
                Become a Member
              </Link>
            </div>
            <dl className="mt-11 flex flex-wrap gap-9">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <dt className="font-[family-name:var(--font-display)] text-[28px] font-bold text-gold">{s.value}</dt>
                  <dd className="text-[13px] text-mist-strong/75">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex justify-center">
            <RotaryWheel size={300} extraSpokes className="spin-slow" />
          </div>
        </div>
      </section>

      <div className="bg-navy py-4 text-mist-strong">
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-center gap-x-9 gap-y-2 px-6 text-[13.5px] font-semibold uppercase tracking-wide">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-gold" />
            Weekly Meeting: Thursdays, 12:30 PM
          </span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-gold" />
            Venue: {CLUB.venue}
          </span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-gold" />
            Visitors Always Welcome
          </span>
        </div>
      </div>

      <section className="py-22">
        <div className="mx-auto grid max-w-[1180px] items-center gap-14 px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="gradient-royal relative h-[380px] overflow-hidden rounded-3xl shadow-[var(--shadow-card-lg)]">
            <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-[var(--shadow-card)]">
              <strong className="font-[family-name:var(--font-display)] text-xl text-navy">45+</strong>
              <span className="text-xs text-muted-foreground">
                Projects delivered
                <br />
                since chartering
              </span>
            </div>
          </div>
          <div>
            <Eyebrow>Who We Are</Eyebrow>
            <h2 className="mt-4 text-[clamp(24px,3vw,32px)]">A club of professionals, united by service.</h2>
            <p className="mt-4 text-muted-foreground">
              The Rotary Club of Athi River brings together business leaders, professionals, and community champions
              who volunteer their time, skills, and resources to solve real problems in health, education, water and
              sanitation, and economic development.
            </p>
            <p className="mt-3 text-muted-foreground">
              As part of Rotary International, we connect local action to a global network of 1.4 million members
              working toward lasting change — in our community and across the world.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Member of Rotary International, District 9212",
                "Guided by the Four-Way Test in everything we do",
                "Open to new members from all professions and backgrounds",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 font-medium">
                  <span className="flex size-5.5 flex-none items-center justify-center rounded-full bg-mist-strong text-xs font-extrabold text-primary">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-mist py-16">
        <div className="mx-auto max-w-[1180px] px-6">
          <SectionHead
            eyebrow="Our Causes"
            title="Where we focus our energy"
            copy="Rotary's seven areas of focus guide the projects we choose and the impact we aim for."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {focusPreview.map((f) => (
              <article key={f.title} className="rounded-xl border border-border bg-card p-6 text-center">
                <div className={`mx-auto flex size-12 items-center justify-center rounded-xl text-xl ${f.tone}`}>
                  <span aria-hidden>{f.icon}</span>
                </div>
                <h4 className="mt-3.5 text-[15px]">{f.title}</h4>
                <p className="mt-1.5 text-[13px] text-muted-foreground">{f.copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/causes"
              className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-royal"
            >
              View All Areas of Focus
            </Link>
          </div>
        </div>
      </section>

      <section className="py-22">
        <div className="mx-auto max-w-[1180px] px-6">
          <SectionHead eyebrow="Get Involved" title="Upcoming & recent highlights" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {homeHighlights.map((h) => (
              <article
                key={h.title}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
              >
                <div className={`relative h-44 ${h.tone}`}>
                  <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-navy">
                    {h.tag}
                  </span>
                </div>
                <div className="p-6">
                  <h4 className="text-[17px]">{h.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{h.copy}</p>
                  <div className="mt-4 flex justify-between border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
                    <span>{h.metaLeft}</span>
                    <span>{h.metaRight}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
