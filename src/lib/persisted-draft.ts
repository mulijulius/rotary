// Persists in-progress upload-form fields (title, dates, dropdowns — anything
// JSON-serializable) to sessionStorage, and restores them on mount.
//
// Why this exists: opening the native file picker on mobile (tapping
// "Choose a file") backgrounds the browser tab. Under memory pressure,
// Android Chrome (and other mobile browsers) can kill the backgrounded
// tab's renderer process outright. When the user returns and picks a file,
// there's no tab left to receive it — Chrome does a full network reload of
// the page from scratch instead. That's a real HTTP navigation, not a
// client-side route change, so it wipes every bit of in-memory React state
// (title typed, date picked, fiscal year selected) with no error and no
// warning. From the user's point of view, "Choose a file" just does
// nothing: the file dialog opens, they pick a file, and they land back on
// a blank form.
//
// This can't be prevented from JS running in the page — the process is
// gone before any reload/unload handler in that page instance could run.
// The only real fix is to make the small, serializable parts of the form
// (everything except the File object itself, which cannot survive a
// process kill) durable across that reload, and restore them the moment
// the component remounts. The file itself still has to be re-chosen after
// a discard — callers should show a clear inline notice when they detect a
// restored draft, so the user understands why they need to reattach it,
// instead of silently losing their typed title/date on top of the file.
//
// Not for arbitrary large payloads — sessionStorage is small (~5MB) and
// synchronous. Keep drafts to a handful of short fields.

const PREFIX = "rc-athi-river:draft:";

export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[persisted-draft] failed to read draft "${key}"`, err);
    return null;
  }
}

export function saveDraft<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[persisted-draft] failed to save draft "${key}"`, err);
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch (err) {
    console.warn(`[persisted-draft] failed to clear draft "${key}"`, err);
  }
}
