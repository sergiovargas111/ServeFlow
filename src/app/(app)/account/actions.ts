"use server";

import { redirect } from "next/navigation";
import { DELETE_CONFIRMATION } from "@/lib/account/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export type DeleteAccountState = { status: "idle" | "error"; message?: string };

/**
 * Deletes the signed-in user's auth account. Every user table references
 * auth.users with ON DELETE CASCADE, so their profile, shifts and logs go too.
 * The user id comes only from the verified session, never from the form.
 */
export async function deleteAccount(_prev: DeleteAccountState, form: FormData): Promise<DeleteAccountState> {
  const userId = await getUserId();
  if (!userId) return { status: "error", message: "Please sign in again." };

  if (form.get("confirm") !== DELETE_CONFIRMATION) {
    return { status: "error", message: `Type ${DELETE_CONFIRMATION} to confirm.` };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { status: "error", message: "We couldn't delete your account. Please try again." };

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
