import Link from "next/link";
import { CircleUser } from "lucide-react";
import { BottomNav } from "@/components/nav/bottom-nav";
import { OfflineSync } from "@/components/shifts/offline-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Link href="/report" className="text-sm font-semibold text-primary">
          ServeFlow
        </Link>
        <Link
          href="/account"
          aria-label="Account"
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <CircleUser className="size-6" aria-hidden />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <OfflineSync />
        {children}
      </main>
      <BottomNav />
    </>
  );
}
