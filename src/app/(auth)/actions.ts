"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HOME_AFTER_LOGIN, safeNextPath } from "@/lib/auth/routes";
import { getPublicSupabaseEnv, getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, loginSchema, pickFormFields, signupSchema } from "@/lib/validation/auth";

export type AuthFormState = {
  status: "idle" | "error" | "check-email";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const NOT_CONFIGURED: AuthFormState = {
  status: "error",
  message: "Sign-in isn't set up yet. Add the Supabase keys to .env.local.",
};

async function siteUrl() {
  return getSiteUrl((await headers()).get("origin"));
}

export async function login(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = pickFormFields(form, ["email", "password", "next"] as const);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: { email: raw.email ?? "" } };
  }
  if (!getPublicSupabaseEnv()) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message for unknown email and wrong password, so accounts can't be enumerated.
    return { status: "error", message: "Email or password is incorrect.", values: { email: parsed.data.email } };
  }
  redirect(safeNextPath(raw.next));
}

export async function signup(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = pickFormFields(form, ["username", "email", "password"] as const);
  const values = { username: raw.username ?? "", email: raw.email ?? "" };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }
  if (!getPublicSupabaseEnv()) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { username, email, password } = parsed.data;

  const { data: available, error: lookupError } = await supabase.rpc("is_username_available", { name: username });
  if (lookupError) return { status: "error", message: "Something went wrong. Please try again.", values };
  if (!available) return { status: "error", fieldErrors: { username: "That username is taken." }, values };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username }, emailRedirectTo: `${await siteUrl()}/auth/callback` },
  });
  if (error) return { status: "error", message: error.message, values };

  // With email confirmation on, there's no session until the link is clicked.
  if (!data.session) return { status: "check-email", message: `We sent a confirmation link to ${email}.` };
  redirect(HOME_AFTER_LOGIN);
}

export async function signInWithGoogle(form: FormData): Promise<void> {
  if (!getPublicSupabaseEnv()) redirect("/login?error=not-configured");
  const next = safeNextPath(pickFormFields(form, ["next"] as const).next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  if (getPublicSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
