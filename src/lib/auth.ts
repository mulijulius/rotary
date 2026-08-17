import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type RoleStatus = Database["public"]["Enums"]["role_status"];

// Roles that count as "back office" staff — matches public.is_officer() in the DB.
const OFFICER_ROLES: AppRole[] = ["admin", "treasurer", "secretary", "editor"];

export const ROLE_ORDER: AppRole[] = ["admin", "treasurer", "secretary", "editor", "member"];

export function isOfficerRole(role: AppRole | null): boolean {
  return role !== null && OFFICER_ROLES.includes(role);
}

export function roleLabel(role: AppRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

type AuthState = {
  loading: boolean;
  session: Session | null;
  // The caller's role, but ONLY once an admin has approved it. Null while
  // pending, revoked, or if no request was ever made.
  role: AppRole | null;
  // The status of the caller's most recent live role request (pending or
  // approved) — null if they've never requested a role at all.
  roleStatus: RoleStatus | null;
  // The role tied to `roleStatus`, whatever that status is. Useful for
  // showing "Your request for Treasurer is pending" even before approval.
  requestedRole: AppRole | null;
};

// Tracks the current Supabase session and the caller's own role request (if
// any), re-fetching whenever the session changes (sign-in, sign-out, token
// refresh). A logged-in user with no live user_roles row gets role: null,
// roleStatus: null.
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    role: null,
    roleStatus: null,
    requestedRole: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadRole(session: Session | null) {
      if (!session) {
        if (!cancelled) {
          setState({ loading: false, session: null, role: null, roleStatus: null, requestedRole: null });
        }
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, status")
        .eq("user_id", session.user.id)
        .in("status", ["pending", "approved"])
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[auth] failed to load role", error);
        setState({ loading: false, session, role: null, roleStatus: null, requestedRole: null });
        return;
      }
      setState({
        loading: false,
        session,
        role: data?.status === "approved" ? data.role : null,
        roleStatus: data?.status ?? null,
        requestedRole: data?.role ?? null,
      });
    }

    supabase.auth.getSession().then(({ data }) => loadRole(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({ ...prev, loading: true }));
      loadRole(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
