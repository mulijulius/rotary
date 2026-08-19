// Self-service request helpers for the "Member" role, plus the
// officer-side decide functions for Secretary/Admin. All of these rely on
// RLS + the SECURITY DEFINER decision functions added in
// 20260817120000_role_scoped_admin_workflows.sql — no service-role client
// needed, so these are safe to call directly from client components.
import { supabase } from "@/integrations/supabase/client";

export type ProfileEditableFields = {
  phone?: string;
  email?: string;
  classification?: string;
  photo_url?: string;
};

export async function submitLeaveRequest(params: {
  memberId: number;
  startDate: string; // ISO date
  endDate?: string | null;
  reason: string;
}) {
  const { error } = await supabase.from("leave_requests").insert({
    member_id: params.memberId,
    start_date: params.startDate,
    end_date: params.endDate ?? null,
    reason: params.reason,
  });
  if (error) throw error;
}

export async function submitProfileEditRequest(params: {
  memberId: number;
  changes: ProfileEditableFields;
}) {
  const { error } = await supabase.from("profile_edit_requests").insert({
    member_id: params.memberId,
    requested_changes: params.changes,
  });
  if (error) throw error;
}

// Officer-side (admin/secretary): approve or deny a pending leave request.
// Approving also flips the member's status to leave_of_absence, atomically,
// inside the DB function.
export async function decideLeaveRequest(requestId: number, approve: boolean, note?: string) {
  const { error } = await supabase.rpc("fn_decide_leave_request", {
    _request_id: requestId,
    _approve: approve,
    _note: note ?? "",
  });
  if (error) throw error;
}

// Officer-side (admin/secretary): approve or deny a pending profile-edit
// request. Approving applies only the allow-listed fields in the DB function.
export async function decideProfileEditRequest(requestId: number, approve: boolean, note?: string) {
  const { error } = await supabase.rpc("fn_decide_profile_edit_request", {
    _request_id: requestId,
    _approve: approve,
    _note: note ?? "",
  });
  if (error) throw error;
}

// Admin-only: read the role decision audit trail (who approved/revoked
// whom, and when). RLS on v_role_audit restricts this to admins already;
// non-admin callers just get an empty array back, not an error.
export async function fetchRoleAudit(limit = 200) {
  const { data, error } = await supabase.from("v_role_audit").select("*").limit(limit);
  if (error) throw error;
  return data;
}

// Admin-only: link a member profile to the auth account that will log in
// as them. Also clears any pending role request that account was waiting
// on — see 20260819_006_member_account_linking.sql. This is what makes
// "Your account isn't linked to a member profile yet" on the member
// portal (e.g. Admin -> Shop) go away for that person.
export async function linkMemberAccount(memberId: number, userId: string) {
  const { error } = await supabase.rpc("fn_link_member_account", {
    _member_id: memberId,
    _user_id: userId,
  });
  if (error) throw error;
}

// Admin-only: remove the link between a member profile and an auth
// account (e.g. it was linked to the wrong person).
export async function unlinkMemberAccount(memberId: number) {
  const { error } = await supabase.rpc("fn_unlink_member_account", {
    _member_id: memberId,
  });
  if (error) throw error;
}
