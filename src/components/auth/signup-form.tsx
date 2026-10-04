"use client";

import { useActionState } from "react";
import { signup, type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "./form-field";

const initial: AuthFormState = { status: "idle" };

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, initial);

  if (state.status === "check-email") {
    return (
      <div role="status" className="space-y-2 rounded-lg border p-4">
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">{state.message} Open it on this phone to finish signing up.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormField
        name="username"
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        required
        hint="3–20 letters, numbers or underscores."
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
      />
      <FormField
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      />
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
