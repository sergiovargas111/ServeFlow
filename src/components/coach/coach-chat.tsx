"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Info, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoachReply } from "@/lib/coach/guard";
import { MAX_MESSAGE_CHARS, MAX_TURNS } from "@/lib/coach/schema";
import { cn } from "@/lib/utils";

interface Turn {
  role: "user" | "assistant";
  content: string;
  reply?: CoachReply;
  failed?: boolean;
}

const STARTERS = [
  "How do I handle a rude table?",
  "What should I upsell with a steak?",
  "Am I owed a meal break?",
  "Can my manager take part of my tips?",
];

const verified = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Keeps the request under the server's turn limit, always starting on a user turn. */
function historyForRequest(turns: Turn[]) {
  const sendable = turns.filter((t) => !t.failed).map(({ role, content }) => ({ role, content }));
  let start = Math.max(0, sendable.length - MAX_TURNS);
  if (sendable[start]?.role === "assistant") start += 1;
  return sendable.slice(start);
}

function Sources({ reply }: { reply: CoachReply }) {
  if (reply.kind !== "legal") return null;
  return (
    <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
      {reply.sources.map((s) => (
        <p key={s.id}>
          <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
            Source: {new URL(s.sourceUrl).hostname.replace(/^www\./, "")} <ExternalLink className="size-3" aria-hidden />
          </a>{" "}
          · {s.legalBasis} · Last verified {verified.format(new Date(`${s.lastVerifiedAt}T00:00:00Z`))}
        </p>
      ))}
      {reply.helpLink ? (
        <p>
          <a href={reply.helpLink.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {reply.helpLink.label}
          </a>
        </p>
      ) : null}
      {reply.disclaimer ? <p className="flex items-center gap-1"><Info className="size-3" aria-hidden /> {reply.disclaimer}</p> : null}
    </div>
  );
}

export function CoachChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, pending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    const next: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(next);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: historyForRequest(next) }),
      });
      const data = (await res.json()) as ({ status: "ok" } & CoachReply) | { status: "error"; message: string };
      if (data.status === "ok") {
        setTurns((t) => [...t, { role: "assistant", content: data.reply, reply: data }]);
      } else {
        // The question stays visible but isn't sent again as history.
        setTurns((t) => [...t.slice(0, -1), { role: "user", content: question, failed: true }, { role: "assistant", content: data.message, failed: true }]);
      }
    } catch {
      setTurns((t) => [
        ...t.slice(0, -1),
        { role: "user", content: question, failed: true },
        { role: "assistant", content: "You're offline. Try again when you're back online.", failed: true },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {turns.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ask about serving, upselling, tough tables, or your rights at work. Legal answers come only from verified rules for your
            state, with sources.
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="h-10 rounded-full border px-4 text-sm hover:bg-muted">
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ol className="space-y-3" aria-live="polite">
        {turns.map((t, i) => (
          <li key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] whitespace-pre-wrap",
                t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                t.failed && t.role === "assistant" && "text-muted-foreground",
              )}
            >
              {t.content}
              {t.reply ? <Sources reply={t.reply} /> : null}
            </div>
          </li>
        ))}
        {pending ? (
          <li className="flex justify-start">
            <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>
          </li>
        ) : null}
      </ol>
      <div ref={endRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex gap-2 bg-background py-2"
      >
        <label htmlFor="coach-input" className="sr-only">
          Ask the coach
        </label>
        <input
          id="coach-input"
          value={input}
          maxLength={MAX_MESSAGE_CHARS}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the coach…"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-full border bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon" className="size-12 rounded-full" disabled={pending || !input.trim()} aria-label="Send">
          <SendHorizontal aria-hidden />
        </Button>
      </form>
    </div>
  );
}
