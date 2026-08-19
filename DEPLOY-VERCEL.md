# Deploying to Vercel

This app is a TanStack Start (SSR) app, not a plain static Vite site. It needs a
server runtime on Vercel — if Vercel is left on its "Vite" framework preset it
only publishes the static `dist/client` folder and every page 404s / renders blank.

## 1. Project settings

`vercel.json` in the repo root already pins this:

- Framework Preset: **Other** (`"framework": null`)
- Build Command: `npm run build`
- Output Directory: **leave empty** (the build emits `.vercel/output`, the
  Vercel Build Output API format)

If the Vercel dashboard has overrides saved from an earlier import, clear them
under Settings → Build & Development Settings so `vercel.json` wins.

## 2. Environment variables

Add these in Settings → Environment Variables for **Production, Preview and
Development**. The `VITE_*` ones are inlined at build time (client), the plain
ones are read at request time by server functions.

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://chinhvtebbowirrxokks.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_aelt_MU1H3-G0mvgYcHyaw_bFIXDS2r` |
| `VITE_SUPABASE_PROJECT_ID` | `chinhvtebbowirrxokks` |
| `SUPABASE_URL` | `https://chinhvtebbowirrxokks.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_aelt_MU1H3-G0mvgYcHyaw_bFIXDS2r` |
| `SUPABASE_SERVICE_ROLE_KEY` | your `sb_secret_...` service role key |

Without `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` at runtime, authenticated
server functions throw `Missing Supabase environment variable(s)`.
The service role key is only needed by admin-side server functions.

## 3. Supabase settings

In the Supabase dashboard → Authentication → URL Configuration, add your Vercel
domain (and `https://<project>.vercel.app`) to **Site URL** / **Redirect URLs**,
otherwise sign-in redirects bounce.

## 4. Redeploy

Trigger a fresh deploy after changing env vars — Vercel does not rebuild
automatically when variables change.
