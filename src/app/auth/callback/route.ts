import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/routes";
import { getPublicSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Landing point for Google sign-in and email confirmation links (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!getPublicSupabaseEnv()) return NextResponse.redirect(new URL("/login?error=not-configured", origin));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
