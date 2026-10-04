"use client";

import { useActionState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/app/(app)/account/actions";
import { DELETE_CONFIRMATION } from "@/lib/account/constants";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";

const initial: DeleteAccountState = { status: "idle" };

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, initial);

  return (
    <form action={action} className="space-y-3">
      <FormField
        name="confirm"
        label={`Type ${DELETE_CONFIRMATION} to permanently delete your account and all your data`}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={state.message}
      />
      <Button type="submit" variant="destructive" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}
