import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

// Roles that count as "back office" staff — matches public.is_officer() in the DB.
const OFFICER_ROLES: AppRole[] = ["admin", "treasurer", "secretary", "editor"];

export function isOfficerRole(role: AppRole | null): boolean {
  return role !== null && OFFICER_ROLES.includes(role);
}

export function roleLabel(role: AppRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

type AuthState = {
  loading: boolean;
  session: Session | null;
  role: AppRole | null;
};

// Tracks the current Supabase session and the caller's own role (if any),
// re-fetching the role whenever the session changes (sign-in, sign-out,
// token refresh). A logged-in user with no user_roles row gets role: null.
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, session: null, role: null });

  useEffect(() => {
    let cancelled = false;

    async function loadRole(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ loading: false, session: null, role: null });
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[auth] failed to load role", error);
        setState({ loading: false, session, role: null });
        return;
      }
      setState({ loading: false, session, role: data?.role ?? null });
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
