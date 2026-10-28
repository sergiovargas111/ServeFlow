"use client";

import { useMemo, useOptimistic, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight, Flame } from "lucide-react";
import { setHabit } from "@/app/(app)/daily/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeStreak } from "@/lib/daily/streak";
import { dailyTasks, type DailyTask } from "@/lib/daily/tasks";
import { suggestedDrill, type Attempt } from "@/lib/learn/progress";
import { localTodayIso } from "@/lib/shifts/dates";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

export interface DailyData {
  shiftDates: string[];
  attempts: Attempt[];
  habits: { taskId: string; date: string }[];
}

/** "Today" is the phone's calendar day, so this renders on the client. */
export function DailyView(props: DailyData) {
  const today = useSyncExternalStore(noopSubscribe, () => localTodayIso(), () => null);
  if (!today) return <div className="h-96 animate-pulse rounded-xl bg-muted" aria-hidden />;
  return <DailyViewInner {...props} today={today} />;
}

function Tick({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
        done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
      )}
    >
      {done ? <Check className="size-4" aria-hidden /> : null}
    </span>
  );
}

function TaskRow({ task, onToggle }: { task: DailyTask; onToggle: (done: boolean) => void }) {
  const body = (
    <>
      <Tick done={task.done} />
      <span className="min-w-0 flex-1">
        <span className={cn("block font-medium", task.done && "text-muted-foreground line-through")}>{task.title}</span>
        <span className="block text-xs text-muted-foreground">{task.detail}</span>
      </span>
    </>
  );
  const row = "flex min-h-16 w-full items-center gap-3 py-3 text-left";

  if (task.kind === "habit") {
    return (
      <button type="button" role="checkbox" aria-checked={task.done} onClick={() => onToggle(!task.done)} className={row}>
        {body}
      </button>
    );
  }
  const href = task.kind === "log" ? "/log" : `/learn/drill/${task.drillId}`;
  return (
    <Link href={href} className={row}>
      {body}
      {!task.done ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden /> : null}
    </Link>
  );
}

function DailyViewInner({ shiftDates, attempts, habits, today }: DailyData & { today: string }) {
  const [, startTransition] = useTransition();
  const [optimisticHabits, toggleHabit] = useOptimistic(habits, (current, { taskId, done }: { taskId: string; done: boolean }) =>
    done ? [...current, { taskId, date: today }] : current.filter((h) => !(h.taskId === taskId && h.date === today)),
  );

  const view = useMemo(() => {
    const habitsToday = new Set(optimisticHabits.filter((h) => h.date === today).map((h) => h.taskId));
    const tasks = dailyTasks(today, {
      shiftLogged: shiftDates.includes(today),
      drillDone: attempts.some((a) => a.completedOn === today),
      habitsDone: habitsToday,
      drill: suggestedDrill(attempts, today),
    });
    const streak = computeStreak([...shiftDates, ...attempts.map((a) => a.completedOn), ...optimisticHabits.map((h) => h.date)], today);
    return { tasks, streak };
  }, [shiftDates, attempts, optimisticHabits, today]);

  function onToggle(habitId: string, done: boolean) {
    startTransition(async () => {
      toggleHabit({ taskId: habitId, done });
      await setHabit({ habitId, date: today, done });
    });
  }

  const doneCount = view.tasks.filter((t) => t.done).length;
  const { streak } = view;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardDescription>Streak</CardDescription>
          <CardTitle className="flex items-center gap-2 text-4xl font-semibold tabular-nums">
            <Flame className={cn("size-8", streak.current > 0 ? "text-primary" : "text-muted-foreground")} aria-hidden />
            {streak.current} day{streak.current === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            {streak.current === 0
              ? "Do any task today to start a streak."
              : streak.activeToday
                ? "Today counts. See you tomorrow."
                : "Do any task today to keep it going."}
            {streak.best > streak.current ? ` Best: ${streak.best} days.` : ""}
          </p>
          <p>Logging any shift counts, slow nights included.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>
            {doneCount} of {view.tasks.length} done
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {view.tasks.map((task) => (
              <li key={task.kind}>
                <TaskRow task={task} onToggle={(done) => task.kind === "habit" && onToggle(task.habitId, done)} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
