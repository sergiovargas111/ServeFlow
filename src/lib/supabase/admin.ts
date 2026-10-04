import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv, requireServiceRoleKey } from "@/lib/env";

/**
 * Service-role client: bypasses RLS. Server-only, and only for actions that
 * have already verified who the user is (e.g. deleting their own account).
 */
export function createAdminClient() {
  const { url } = requirePublicSupabaseEnv();
  return createClient(url, requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
