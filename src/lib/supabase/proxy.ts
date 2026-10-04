import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideRoute } from "@/lib/auth/routes";
import { getPublicSupabaseEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on every request and applies the
 * route rules (protected pages need a valid session). An expired or tampered
 * token fails getClaims() and is treated as signed out.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let signedIn = false;

  const env = getPublicSupabaseEnv();
  if (env) {
    const supabase = createServerClient(env.url, env.publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    });

    // Must run right after creating the client: it is what refreshes the session.
    const { data, error } = await supabase.auth.getClaims();
    signedIn = !error && Boolean(data?.claims?.sub);
  }

  const decision = decideRoute(request.nextUrl.pathname, request.nextUrl.search, signedIn);
  if (decision.type === "redirect") {
    const redirect = NextResponse.redirect(new URL(decision.to, request.url));
    // Carry refreshed/cleared auth cookies over to the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
