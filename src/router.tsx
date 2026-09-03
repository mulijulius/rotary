import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { hasUnsavedFormInput, onAllFormsClean } from "@/lib/unsaved-form-tracker";

// After a new deployment goes live, any browser tab that was already open
// (or navigated via bfcache) is still running the *previous* build's HTML,
// which references JS chunk files by content hash. Vite/Rollup deletes old
// chunks once a new build replaces them, so a client-side route navigation
// in a stale tab tries to dynamically import a chunk that now 404s - this
// is what was showing up as "/assets/<name>-<hash>.js -> 404" on almost
// every admin page in the Vercel logs, right after a redeploy.
//
// Vite emits a `vite:preloadError` event on window specifically for this
// case in production builds. Recovering from it just means getting the tab
// onto the current build, so we do a hard reload. The sessionStorage guard
// stops a reload loop if the deployment is genuinely broken.
//
// BUT: a hard `window.location.reload()` wipes all in-memory React state,
// including a file someone just picked and a title they just typed into an
// upload form (Minutes / Club Documents / Board Position documents). On
// mobile, opening the native file picker backgrounds the tab - exactly
// when a pending stale-chunk reload is likely to land - so the form was
// getting silently wiped before "Upload" was ever clicked, with no error
// shown and nothing saved. So: if any form currently has unsaved input,
// defer the reload and fire it the moment that form is submitted/cleared,
// instead of blowing it away mid-edit.
//
// One more failure mode this guards against: during active development,
// deployments can land in quick succession (every few minutes). A tab that
// reloads to pick up build N can immediately find itself stale again
// seconds later when build N+1 ships. Clearing the "already reloaded" flag
// the instant `load` fires (the original approach) re-arms the guard
// right away, so a fast string of deploys can turn into a reload every
// time the user so much as taps something that triggers a route preload —
// which is indistinguishable, from the user's seat, from "uploading never
// works." Debouncing the flag-clear gives each reload a real window to
// actually get used before the tab is willing to reload again.
if (typeof window !== "undefined") {
  const key = "rc-athi-river:reloaded-after-stale-chunk";
  const REARM_DELAY_MS = 20_000;

  const doReload = () => {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  };

  window.addEventListener("vite:preloadError", (event) => {
    if (sessionStorage.getItem(key)) {
      // Already reloaded once very recently and it didn't help - reloading
      // again in a tight loop would just thrash the page instead of
      // fixing anything. Surface it instead so the person knows to close
      // and reopen the tab (a fresh tab has no stale HTML to be wrong
      // about) rather than sitting on a page that quietly never works.
      console.error("[router] vite:preloadError fired again shortly after a reload — a fresh tab may be needed.", event);
      return;
    }

    if (hasUnsavedFormInput()) {
      toast.message("An update is available.", {
        description: "This page will refresh automatically as soon as your current form is done.",
        duration: 15000,
      });
      const unsubscribe = onAllFormsClean(() => {
        unsubscribe();
        doReload();
      });
      return;
    }

    doReload();
  });

  // This module itself loaded fine, so the current tab is on a working
  // build - clear the guard once the page has had a real chance to settle
  // so a *later* deploy can still trigger one automatic reload instead of
  // being silently skipped. Delayed rather than immediate (see comment
  // above) so a burst of back-to-back deploys can't turn into a reload
  // loop on this tab.
  window.addEventListener("load", () => {
    window.setTimeout(() => sessionStorage.removeItem(key), REARM_DELAY_MS);
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
