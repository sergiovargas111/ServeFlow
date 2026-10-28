"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addMenuItem, deleteMenuItem, type MenuFormState } from "@/app/(app)/learn/actions";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { ALLERGEN_LABELS, ALLERGENS, type MenuItem } from "@/lib/learn/menu-quiz";
import { cn } from "@/lib/utils";

const initial: MenuFormState = { status: "idle" };

function AddDishForm() {
  const [state, action, pending] = useActionState(addMenuItem, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [allergens, setAllergens] = useState<string[]>([]);

  useEffect(() => {
    if (state.status !== "saved") return;
    formRef.current?.reset();
    // Clear the chips once the server confirms the save.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllergens([]);
  }, [state]);

  const err = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <FormField name="name" label="Dish" maxLength={80} required error={err.name} />
      <FormField
        name="description"
        label="What's in it"
        maxLength={200}
        hint="Short and specific, like “Fried squid, lemon aioli”."
        error={err.description}
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Contains (per your kitchen)</legend>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => {
            const on = allergens.includes(a);
            return (
              <label
                key={a}
                className={cn("flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
              >
                <input
                  type="checkbox"
                  name="allergens"
                  value={a}
                  checked={on}
                  onChange={() => setAllergens((s) => (on ? s.filter((x) => x !== a) : [...s, a]))}
                  className="sr-only"
                />
                {ALLERGEN_LABELS[a]}
              </label>
            );
          })}
        </div>
        {err.allergens ? <p className="pt-1 text-sm text-destructive">{err.allergens}</p> : null}
      </fieldset>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      {state.status === "saved" ? (
        <p role="status" className="text-sm font-medium text-primary">
          Added.
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Adding…" : "Add dish"}
      </Button>
    </form>
  );
}

function DeleteButton({ item }: { item: MenuItem }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Delete ${item.name}`}
      disabled={pending}
      onClick={() => startTransition(async () => void (await deleteMenuItem(item.id)))}
      className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

export function MenuEditor({ items }: { items: MenuItem[] }) {
  return (
    <div className="space-y-6">
      <AddDishForm />
      <section>
        <h2 className="mb-2 text-lg font-semibold">Your dishes</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Start with your best sellers.</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.name}</span>
                  {item.description ? <span className="block text-sm text-muted-foreground">{item.description}</span> : null}
                  {item.allergens.length ? (
                    <span className="block text-xs text-muted-foreground">
                      Contains {item.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}
                    </span>
                  ) : null}
                </span>
                <DeleteButton item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        For practice only. Allergens here are your own notes; always confirm with the kitchen before telling a guest a dish is safe.
      </p>
    </div>
  );
}
