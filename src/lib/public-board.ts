// Data source for the public /leadership page. Reads straight from
// board_positions (via the v_public_board view — see
// 20260816160725_5d3445ef-f36d-477f-9651-2e40de515d38.sql and
// 20260827_018_public_board_current_year.sql) instead of the old
// hard-coded array in club-content.ts, so any secretary/admin/editor who
// adds, edits or removes a board position in the back office is reflected
// here automatically, photo included.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PublicBoardRow = Database["public"]["Views"]["v_public_board"]["Row"];

export type PublicBoardMember = {
  id: number;
  title: string;
  bio: string | null;
  sortOrder: number;
  fullName: string;
  initials: string;
  photoUrl: string | null;
  /** Deterministic Tailwind background class used when there's no photo. */
  tone: string;
};

// Same palette the old hard-coded board array used, kept here so the
// avatar fallback still matches the site's design tokens.
const AVATAR_TONES = [
  "bg-royal-bright",
  "bg-gold-deep",
  "bg-turquoise",
  "bg-violet",
  "bg-cranberry",
  "bg-orange",
  "bg-royal",
  "bg-gold",
];

// Picks a stable color for a given member so the same person always gets
// the same fallback avatar color across renders/reloads.
function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

// "Alal Julius" -> "AJ". Falls back gracefully for single-word names and
// empty strings (shouldn't happen since both columns are NOT NULL on
// members, but the view can return nulls if a row is somehow orphaned).
export function getInitials(firstName: string | null, longName?: string | null): string {
  const parts = [firstName, longName].filter((p): p is string => !!p && p.trim().length > 0);
  if (parts.length === 0) return "?";
  const initials = parts.map((p) => p.trim()[0]!.toUpperCase()).join("");
  return initials.slice(0, 2);
}

// Of all fiscal years represented in board_positions, picks the one whose
// date range contains today; if none does (e.g. positions were only set
// up for a future or past year), falls back to the most recent by start
// date. Rows are already ordered fiscal_year.start_date DESC by the view.
function pickCurrentFiscalYearId(rows: PublicBoardRow[]): number | null {
  if (rows.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const containingToday = rows.find(
    (r) => r.fiscal_year_start && r.fiscal_year_end && r.fiscal_year_start <= today && today <= r.fiscal_year_end,
  );
  if (containingToday) return containingToday.fiscal_year_id;
  return rows[0]!.fiscal_year_id;
}

export async function fetchPublicBoard(): Promise<PublicBoardMember[]> {
  const { data, error } = await supabase
    .from("v_public_board")
    .select("*")
    .order("fiscal_year_start", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const currentYearId = pickCurrentFiscalYearId(data);
  const currentYear = data.filter((r) => r.fiscal_year_id === currentYearId);

  return currentYear.map((r) => {
    const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ") || "Board Member";
    return {
      id: r.id!,
      title: r.title ?? "",
      bio: r.bio,
      sortOrder: r.sort_order ?? 0,
      fullName,
      initials: getInitials(r.first_name, r.last_name),
      photoUrl: r.photo_url,
      tone: toneFor(`${r.id}-${fullName}`),
    };
  });
}
