// NEXT_PUBLIC_* values must be read with literal property access so Next can
// inline them into the browser bundle.

export interface PublicSupabaseEnv {
  url: string;
  publishableKey: string;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function requirePublicSupabaseEnv(): PublicSupabaseEnv {
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (see env.example).",
    );
  }
  return env;
}

/** Server-only. Never import this from a client component. */
export function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return key;
}

/** Public base URL used for auth redirects; falls back to the request origin. */
export function getSiteUrl(requestOrigin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return (configured || requestOrigin || "http://localhost:3000").replace(/\/+$/, "");
}
