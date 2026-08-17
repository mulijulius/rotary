import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SectionHead } from "@/components/site/PageIntro";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Officer Login | Rotary Club of Athi River" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Could not sign in. Check your email and password.");
      return;
    }

    toast.success("Signed in.");
    navigate({ to: "/admin" });
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[440px] px-6">
        <SectionHead eyebrow="Back Office" title="Officer login" copy="For club officers only." />

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)]"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-foreground">Email</span>
            <input
              type="email"
              name="email"
              required
              placeholder="you@rotaryathiriver.org"
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-foreground">Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-deep disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New officer?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}
