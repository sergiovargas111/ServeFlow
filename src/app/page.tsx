import { Suspense } from "react";
import Link from "next/link";
import { ChartColumn, Scale, Wallet } from "lucide-react";
import { DeletedNotice } from "@/components/account/deleted-notice";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: ChartColumn,
    title: "Know your typical night",
    body: "Log tips in a few taps. See the usual range for a Friday dinner, based on your own history.",
  },
  {
    icon: Wallet,
    title: "Plan your money",
    body: "Spot slow weeks early and set aside taxes from every shift.",
  },
  {
    icon: Scale,
    title: "Know your rights",
    body: "A plain-English, sourced checklist of what your employer owes you.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between gap-10 px-4 py-10">
      <div className="space-y-4">
        <Suspense>
          <DeletedNotice />
        </Suspense>
        <p className="text-sm font-semibold text-primary">ServeFlow</p>
        <h1 className="text-4xl font-semibold tracking-tight">Your tips, your money, your rights.</h1>
        <p className="text-muted-foreground">
          A coach and money tool built for restaurant servers. Fast enough to use between tables.
        </p>
      </div>

      <ul className="space-y-5">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}>
          Get started
        </Link>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full text-base")}
        >
          I already have an account
        </Link>
      </div>
    </main>
  );
}
