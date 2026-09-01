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
if (typeof window !== "undefined") {
  const key = "rc-athi-river:reloaded-after-stale-chunk";

  const doReload = () => {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  };

  window.addEventListener("vite:preloadError", () => {
    if (sessionStorage.getItem(key)) return;

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
  // build - clear the guard once the page settles so a *later* deploy can
  // still trigger one automatic reload instead of being silently skipped.
  window.addEventListener("load", () => sessionStorage.removeItem(key));
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
