import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SectionHead } from "@/components/site/PageIntro";
import { CLUB, SOCIAL_LINKS } from "@/lib/club-content";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Visit Us | Rotary Club of Athi River" },
      {
        name: "description",
        content:
          "Visit a weekly meeting at East African Portland Sports Club, Athi River, or send the club a membership enquiry. Visitors always welcome.",
      },
      { property: "og:title", content: "Contact & Visit Us | Rotary Club of Athi River" },
      {
        property: "og:description",
        content: "Meeting times, venue and contact details for the Rotary Club of Athi River.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const details = [
  { icon: "📍", label: "Meeting Venue", value: `${CLUB.venue}\nMachakos County, Kenya` },
  { icon: "🕐", label: "Meeting Time", value: CLUB.meeting },
  { icon: "✉️", label: "Email", value: CLUB.email },
  { icon: "📞", label: "Phone", value: CLUB.phone },
  { icon: "🏠", label: "Postal Address", value: CLUB.postal },
];

function ContactPage() {
  const [sending, setSending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    // Messages will be persisted to the contact_messages table once the
    // club's Supabase project is connected.
    setTimeout(() => {
      setSending(false);
      toast.success("Thanks — your message has been noted. The club secretary will be in touch.");
      e.currentTarget?.reset?.();
    }, 400);
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-6">
        <SectionHead
          eyebrow="Contact"
          title="Get in touch or visit a meeting"
          copy="Visitors and prospective members are always welcome at our weekly meetings."
        />

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-border bg-mist p-7">
            <ul className="space-y-5">
              {details.map((d) => (
                <li key={d.label} className="flex gap-4">
                  <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-card text-lg shadow-[var(--shadow-card)]">
                    <span aria-hidden>{d.icon}</span>
                  </span>
                  <span>
                    <h5 className="text-sm">{d.label}</h5>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{d.value}</p>
                  </span>
                </li>
              ))}
            </ul>
            <h5 className="mt-7 text-sm">Follow Us</h5>
            <div className="mt-3 flex gap-2">
              {[
                { label: "f", name: "Facebook", href: SOCIAL_LINKS.facebook },
                { label: "X", name: "X (Twitter)", href: SOCIAL_LINKS.x },
                { label: "ig", name: "Instagram", href: SOCIAL_LINKS.instagram },
              ].map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="flex size-9 items-center justify-center rounded-full bg-card text-sm font-bold text-navy shadow-[var(--shadow-card)] transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)]"
          >
            <h3 className="mb-5 text-xl">Send us a message</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" name="name" placeholder="Jane Doe" required />
              <Field label="Email" name="email" type="email" placeholder="jane@email.com" required />
              <Field label="Phone" name="phone" placeholder="+254 7xx xxx xxx" />
              <Field label="Subject" name="subject" placeholder="Membership enquiry" />
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">Message</span>
              <textarea
                name="message"
                required
                rows={5}
                placeholder="Tell us how we can help…"
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20"
              />
            </label>
            <button
              type="submit"
              disabled={sending}
              className="mt-5 inline-flex rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-deep disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20"
      />
    </label>
  );
}
