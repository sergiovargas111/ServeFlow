import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Integration helpers for RLS tests. Point SUPABASE_TEST_* at a local or
// throwaway project, never production: these tests create and delete users.

export const testEnv = {
  url: process.env.SUPABASE_TEST_URL,
  anonKey: process.env.SUPABASE_TEST_ANON_KEY,
  serviceKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
};

export const hasTestDb = Boolean(testEnv.url && testEnv.anonKey && testEnv.serviceKey);

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

export function adminClient(): SupabaseClient {
  return createClient(testEnv.url!, testEnv.serviceKey!, noSession);
}

export function anonClient(): SupabaseClient {
  return createClient(testEnv.url!, testEnv.anonKey!, noSession);
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Creates a confirmed user and returns a client signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const email = `rls-${label}-${suffix}@example.test`;
  const password = `pw-${suffix}-${suffix}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `t_${label}_${suffix}`.slice(0, 20) },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (user) await adminClient().auth.admin.deleteUser(user.id);
}
