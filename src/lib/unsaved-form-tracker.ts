
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

import { useEffect, useRef } from "react";

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
//
// Registers synchronously during render (not in a useEffect) so there's
// no gap between paint and commit where a reload could sneak past a form
// that visibly has unsaved input on screen — e.g. a title restored from
// a persisted draft is dirty from the very first render, before any
// effect has had a chance to run.
export function useUnsavedFormGuard(isDirty: boolean): void {
  const wasDirtyRef = useRef(false);

  if (isDirty && !wasDirtyRef.current) {
    wasDirtyRef.current = true;
    markFormDirty();
  } else if (!isDirty && wasDirtyRef.current) {
    wasDirtyRef.current = false;
    clearFormDirty();
  }

  // Cleanup still needs an effect — this only runs on unmount, mirroring
  // the previous effect-cleanup behavior, so a form removed from the page
  // (e.g. navigating away) while still dirty doesn't leak a permanently
  // stuck dirtyCount.
  useEffect(() => {
    return () => {
      if (wasDirtyRef.current) {
        wasDirtyRef.current = false;
        clearFormDirty();
      }
    };
  }, []);
}
