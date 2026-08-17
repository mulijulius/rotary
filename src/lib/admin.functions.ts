// NOT a .server.ts file on purpose: this module is imported from
// src/routes/admin/users.tsx (client-bundled), so it must only export the
// client-safe createServerFn RPC stub. The service-role client is loaded
// dynamically inside the handler below, so it's never pulled into the
// client bundle — see the note in client.server.ts.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCallerIsAdmin(
  userId: string,
  supabaseAdmin: (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"],
) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error("Failed to verify admin access.");
  if (!data) throw new Error("Forbidden: this action requires an approved admin role.");
}

// auth.users isn't exposed through the normal PostgREST API (only tables in
// the `public` schema are), so listing signed-up accounts — needed so an
// admin can grant a role to someone who just signed up — has to go through
// the Auth Admin API with the service-role key, server-side only.
export const listAuthUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCallerIsAdmin(context.userId, supabaseAdmin);

    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw new Error(error.message);

    return data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "(no email)",
        createdAt: u.created_at,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  });
