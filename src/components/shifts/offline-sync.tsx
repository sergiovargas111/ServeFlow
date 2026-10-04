"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { logShift } from "@/app/(app)/log/actions";
import { getBrowserQueue, pendingCount, subscribeToQueue } from "@/lib/shifts/browser-queue";
import { flushQueue } from "@/lib/shifts/offline-queue";

/** Syncs shifts logged offline whenever the app opens or the phone reconnects. */
export function OfflineSync() {
  const router = useRouter();
  const pending = useSyncExternalStore(subscribeToQueue, pendingCount, () => 0);
  const [rejected, setRejected] = useState(0);

  useEffect(() => {
    let running = false;
    async function sync() {
      if (running || !navigator.onLine) return;
      running = true;
      try {
        const result = await flushQueue(getBrowserQueue(), logShift);
        if (result.rejected) setRejected((r) => r + result.rejected);
        if (result.synced) router.refresh();
      } finally {
        running = false;
      }
    }
    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [router]);

  if (pending === 0 && rejected === 0) return null;

  return (
    <div role="status" className="mb-3 flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
      <WifiOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p>
        {pending > 0
          ? `${pending} shift${pending === 1 ? "" : "s"} saved on this phone. ${pending === 1 ? "It'll" : "They'll"} sync when you're back online.`
          : null}
        {rejected > 0
          ? ` ${rejected} offline shift${rejected === 1 ? "" : "s"} couldn't be saved because the details were invalid. Please log ${rejected === 1 ? "it" : "them"} again.`
          : null}
      </p>
    </div>
  );
}
