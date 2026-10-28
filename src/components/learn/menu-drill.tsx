"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { buildMenuQuiz, MENU_DRILL_ID, type MenuItem } from "@/lib/learn/menu-quiz";
import { DrillPlayer } from "./drill-player";

const noopSubscribe = () => () => {};

function MenuDrillInner({ items }: { items: MenuItem[] }) {
  // A fresh shuffle each visit; the server rebuilds the same quiz from this seed to grade it.
  const [seed] = useState(() => crypto.randomUUID().replaceAll("-", "").slice(0, 16));
  const questions = useMemo(() => buildMenuQuiz(items, seed), [items, seed]);
  return <DrillPlayer drillId={MENU_DRILL_ID} questions={questions} seed={seed} />;
}

/** The quiz is shuffled on the phone, so it renders only on the client. */
export function MenuDrill({ items }: { items: MenuItem[] }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <div className="h-80 animate-pulse rounded-xl bg-muted" aria-hidden />;
  return <MenuDrillInner items={items} />;
}
