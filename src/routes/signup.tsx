import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SectionHead, AdminNote } from "@/components/site/PageIntro";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Create Account | Rotary Club of Athi River" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Could not create account.");
      return;
    }

    // A new account has no role in user_roles yet — an existing admin has to
    // grant one (see AdminNote below) before this account can access /admin.
    if (signUpData.session) {
      toast.success("Account created. An admin still needs to grant you a role.");
      navigate({ to: "/admin" });
    } else {
      toast.success("Account created — check your email to confirm it, then sign in.");
      navigate({ to: "/login" });
    }
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[440px] px-6">
        <SectionHead
          eyebrow="Back Office"
          title="Create an officer account"
          copy="Signing up does not grant access by itself — an admin must assign you a role."
        />

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
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-foreground">
              Confirm password
            </span>
            <input
              type="password"
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Repeat password"
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-hidden focus:border-primary focus:ring-3 focus:ring-ring/20"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-deep disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create Account"}
          </button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>

        <AdminNote>
          New accounts start with no permissions. An existing admin must open{" "}
          <Link to="/admin/users" className="font-semibold underline">
            Admin → Users
          </Link>{" "}
          and assign a role before this account can access the back office.
        </AdminNote>
      </div>
    </section>
  );
}
