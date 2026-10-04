/**
 * Shifts logged with no connection wait in local storage and sync when the
 * phone is back online. Every item has a clientId, and the server treats a
 * repeated clientId as already saved, so retrying is always safe.
 *
 * Storage can be missing or throw (private mode, blocked site data), so every
 * access is guarded; the worst case is the queue behaving as empty.
 */

export const QUEUE_KEY = "serveflow:pending-shifts";
export const QUEUE_EVENT = "serveflow:pending-shifts-changed";

export interface QueuedShift {
  clientId: string;
  queuedAt: string;
  payload: Record<string, unknown>;
}

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export type SendResult =
  | { status: "saved" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string>; retryable?: boolean };

export function createQueue(storage: KeyValueStore | null, onChange: () => void = () => {}) {
  function read(): QueuedShift[] {
    try {
      const raw = storage?.getItem(QUEUE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((i) => typeof i?.clientId === "string") : [];
    } catch {
      return [];
    }
  }

  function write(items: QueuedShift[]): boolean {
    try {
      storage?.setItem(QUEUE_KEY, JSON.stringify(items));
      onChange();
      return Boolean(storage);
    } catch {
      return false;
    }
  }

  return {
    list: read,
    /** Returns false if the shift couldn't be stored on this device. */
    add(item: QueuedShift): boolean {
      const items = read().filter((i) => i.clientId !== item.clientId);
      return write([...items, item]);
    },
    remove(clientId: string) {
      write(read().filter((i) => i.clientId !== clientId));
    },
  };
}

export type ShiftQueue = ReturnType<typeof createQueue>;

export interface FlushResult {
  synced: number;
  /** Rejected by server validation; retrying can't help, so they're removed. */
  rejected: number;
  remaining: number;
}

/**
 * Sends queued shifts oldest first. Stops at the first network failure or
 * retryable/auth error and keeps the rest for next time.
 */
export async function flushQueue(queue: ShiftQueue, send: (payload: Record<string, unknown>) => Promise<SendResult>): Promise<FlushResult> {
  let synced = 0;
  let rejected = 0;

  for (const item of queue.list()) {
    let result: SendResult;
    try {
      result = await send({ ...item.payload, clientId: item.clientId });
    } catch {
      break; // still offline
    }
    if (result.status === "saved") {
      queue.remove(item.clientId);
      synced += 1;
    } else if (result.fieldErrors && !result.retryable) {
      queue.remove(item.clientId);
      rejected += 1;
    } else {
      break; // signed out, rate-limited or server hiccup: try again later
    }
  }

  return { synced, rejected, remaining: queue.list().length };
}
