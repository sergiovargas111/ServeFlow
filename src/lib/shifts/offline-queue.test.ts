import { describe, expect, it, vi } from "vitest";
import { createQueue, flushQueue, QUEUE_KEY, type QueuedShift, type SendResult } from "./offline-queue";

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
}

function item(id: string): QueuedShift {
  return { clientId: id, queuedAt: "2026-10-04T03:00:00Z", payload: { shiftDate: "2026-10-03", shiftType: "dinner", grossTips: "150" } };
}

describe("createQueue", () => {
  it("adds, lists and removes shifts", () => {
    const q = createQueue(memoryStore());
    q.add(item("a"));
    q.add(item("b"));
    expect(q.list().map((i) => i.clientId)).toEqual(["a", "b"]);
    q.remove("a");
    expect(q.list().map((i) => i.clientId)).toEqual(["b"]);
  });

  it("does not duplicate the same clientId", () => {
    const q = createQueue(memoryStore());
    q.add(item("a"));
    q.add(item("a"));
    expect(q.list()).toHaveLength(1);
  });

  it("notifies on change", () => {
    const onChange = vi.fn();
    createQueue(memoryStore(), onChange).add(item("a"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("treats corrupted storage as empty", () => {
    expect(createQueue(memoryStore({ [QUEUE_KEY]: "{not json" })).list()).toEqual([]);
    expect(createQueue(memoryStore({ [QUEUE_KEY]: '{"a":1}' })).list()).toEqual([]);
    expect(createQueue(memoryStore({ [QUEUE_KEY]: '[{"x":1}]' })).list()).toEqual([]);
  });

  it("survives storage that throws or is missing", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(createQueue(throwing).list()).toEqual([]);
    expect(createQueue(throwing).add(item("a"))).toBe(false);
    expect(createQueue(null).add(item("a"))).toBe(false);
  });
});

describe("flushQueue", () => {
  const ok = async (): Promise<SendResult> => ({ status: "saved" });

  it("syncs everything when online, oldest first, with the clientId attached", async () => {
    const q = createQueue(memoryStore());
    q.add(item("a"));
    q.add(item("b"));
    const send = vi.fn<(payload: Record<string, unknown>) => Promise<SendResult>>(ok);
    expect(await flushQueue(q, send)).toEqual({ synced: 2, rejected: 0, remaining: 0 });
    expect(send.mock.calls.map((c) => c[0].clientId)).toEqual(["a", "b"]);
  });

  it("keeps shifts when the network is still down", async () => {
    const q = createQueue(memoryStore());
    q.add(item("a"));
    q.add(item("b"));
    const result = await flushQueue(q, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(result).toEqual({ synced: 0, rejected: 0, remaining: 2 });
  });

  it("stops on a retryable or auth error and keeps the rest", async () => {
    const q = createQueue(memoryStore());
    q.add(item("a"));
    q.add(item("b"));
    const send = vi.fn(async (): Promise<SendResult> => ({ status: "error", message: "Please sign in again." }));
    expect(await flushQueue(q, send)).toEqual({ synced: 0, rejected: 0, remaining: 2 });
    expect(send).toHaveBeenCalledOnce();
  });

  it("drops shifts the server rejects as invalid and continues", async () => {
    const q = createQueue(memoryStore());
    q.add(item("bad"));
    q.add(item("good"));
    const send = async (p: Record<string, unknown>): Promise<SendResult> =>
      p.clientId === "bad" ? { status: "error", fieldErrors: { shiftDate: "That date is in the future." } } : { status: "saved" };
    expect(await flushQueue(q, send)).toEqual({ synced: 1, rejected: 1, remaining: 0 });
  });

  it("is safe to run twice (server dedupes by clientId)", async () => {
    const q = createQueue(memoryStore());
    q.add(item("a"));
    await flushQueue(q, ok);
    expect(await flushQueue(q, ok)).toEqual({ synced: 0, rejected: 0, remaining: 0 });
  });
});
