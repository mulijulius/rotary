import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

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
// onto the current build, so we do a one-time hard reload. The sessionStorage
// guard stops a reload loop if the deployment is genuinely broken.
if (typeof window !== "undefined") {
  const key = "rc-athi-river:reloaded-after-stale-chunk";
  window.addEventListener("vite:preloadError", () => {
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      window.location.reload();
    }
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
