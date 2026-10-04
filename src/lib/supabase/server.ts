import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicSupabaseEnv } from "@/lib/env";

/** Supabase client for Server Components, Server Actions and Route Handlers. Acts as the signed-in user (RLS applies). */
export async function createClient() {
  // Read cookies first: it marks the route as dynamic even if env is missing.
  const cookieStore = await cookies();
  const { url, publishableKey } = requirePublicSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/** Verified user id from the session JWT, or null when signed out / expired / invalid. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}
