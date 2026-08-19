// Self-service "My Profile" helpers — the direct-write counterpart to the
// officer-approved requests in member-requests.ts. These call the
// `members` table straight, relying on the "Members update own profile"
// RLS policy and the field allow-list enforced in
// fn_restrict_member_updates (see 20260819_007_member_self_profile.sql).
// Only first_name, last_name, phone, and photo_url are writable this way;
// email/classification/status/QR/RI-number still require an officer.
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MemberProfile = Database["public"]["Tables"]["members"]["Row"];

export type SelfEditableFields = {
  first_name: string;
  last_name: string;
  phone: string;
  photo_url?: string | null;
};

// Fetches the members row linked to the signed-in user (auth.uid() ==
// members.user_id). Returns null if this account hasn't been linked to a
// member profile yet — the profile page shows a "contact an admin" state
// in that case rather than erroring.
export async function fetchOwnProfile(userId: string): Promise<MemberProfile | null> {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Direct write — lands immediately, no officer approval needed. RLS +
// the trigger allow-list are the actual enforcement; this is just the
// client-side shape.
export async function updateOwnProfile(memberId: number, changes: SelfEditableFields) {
  const { data, error } = await supabase
    .from("members")
    .update({
      first_name: changes.first_name,
      last_name: changes.last_name,
      phone: changes.phone,
      ...(changes.photo_url !== undefined ? { photo_url: changes.photo_url } : {}),
    })
    .eq("id", memberId)
    .select("*")
    .single();
  if (error) throw error;
  return data as MemberProfile;
}

// Uploads a new avatar into the caller's own folder in the public
// `member-avatars` bucket (`${userId}/<timestamp>.<ext>`) and returns its
// public URL. Does not touch the `members` row — call updateOwnProfile
// (or let the caller include photo_url in the same save) to persist it.
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5MB.");
  }
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("member-avatars")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("member-avatars").getPublicUrl(path);
  return data.publicUrl;
}

// Subscribes to live changes on this one member row (e.g. an officer
// edits the profile elsewhere while the member has the page open) and
// invokes `onChange` with the fresh row on every UPDATE. Returns an
// unsubscribe function; call it from a useEffect cleanup.
export function subscribeToOwnProfile(
  memberId: number,
  onChange: (row: MemberProfile) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`member-profile-${memberId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "members", filter: `id=eq.${memberId}` },
      (payload) => onChange(payload.new as MemberProfile),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
