import { createQueue, QUEUE_EVENT, QUEUE_KEY } from "./offline-queue";

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The device's pending-shift queue; announces changes so UI can re-read it. */
export function getBrowserQueue() {
  return createQueue(safeLocalStorage(), () => window.dispatchEvent(new Event(QUEUE_EVENT)));
}

/** For useSyncExternalStore: re-render when this tab or another tab changes the queue. */
export function subscribeToQueue(callback: () => void) {
  const onStorage = (e: StorageEvent) => e.key === QUEUE_KEY && callback();
  window.addEventListener(QUEUE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(QUEUE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function pendingCount(): number {
  return getBrowserQueue().list().length;
}
