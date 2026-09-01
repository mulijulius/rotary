// Tracks whether any form on the page currently holds input the user
// hasn't saved yet (a chosen file, a typed title, etc).
//
// Why this exists: src/router.tsx does a hard `window.location.reload()`
// when it detects a stale JS chunk after a redeploy (see the
// `vite:preloadError` handler there). That's the right recovery for a
// stale tab in general, but a hard reload wipes all in-memory React
// state instantly — including a file someone just picked and a title
// they just typed into the Minutes / Club Documents / Board Position
// document upload forms. On mobile, opening the native file picker
// backgrounds the tab, which is exactly when a pending stale-chunk
// reload is likely to fire — so the form can get nuked before "Upload"
// is ever clicked, with no error and nothing saved.
//
// Any form that holds not-yet-submitted input should call
// `useUnsavedFormGuard(isDirty)` for the lifetime of that "dirty" state.
// The router consults `hasUnsavedFormInput()` before reloading, and
// `onAllFormsClean()` to reload as soon as the user finishes (submits,
// clears the file, or navigates away).

import { useEffect } from "react";

let dirtyCount = 0;
const listeners = new Set<() => void>();

function markFormDirty(): void {
  dirtyCount++;
}

function clearFormDirty(): void {
  dirtyCount = Math.max(0, dirtyCount - 1);
  if (dirtyCount === 0) {
    listeners.forEach((listener) => listener());
  }
}

export function hasUnsavedFormInput(): boolean {
  return dirtyCount > 0;
}

// Registers a callback fired the moment no form has unsaved input left
// (called immediately if that's already true). Returns an unsubscribe
// function — always call it once you've acted on the callback so it
// doesn't fire again for a later, unrelated dirty/clean cycle.
export function onAllFormsClean(callback: () => void): () => void {
  if (dirtyCount === 0) {
    callback();
    return () => {};
  }
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Call with `true` for as long as a form has unsaved input (e.g. a
// non-empty title or a chosen-but-not-yet-uploaded file), `false`
// otherwise. Safe to call every render — only transitions matter.
export function useUnsavedFormGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    markFormDirty();
    return () => clearFormDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);
}
