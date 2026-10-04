import { signInWithGoogle } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function GoogleButton({ next }: { next?: string }) {
  return (
    <form action={signInWithGoogle}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Button type="submit" variant="outline" size="lg" className="h-12 w-full text-base">
        Continue with Google
      </Button>
    </form>
  );
}
