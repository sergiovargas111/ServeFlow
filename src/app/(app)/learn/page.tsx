import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, ChevronRight, Lock, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { drillsForLevel } from "@/lib/learn/content";
import { canBuildMenuQuiz, MIN_MENU_ITEMS } from "@/lib/learn/menu-quiz";
import { levelProgress, passedDrillIds } from "@/lib/learn/progress";
import { fetchAttempts, fetchMenuItems } from "@/lib/learn/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage() {
  const [attempts, menu] = await Promise.all([fetchAttempts(), fetchMenuItems()]);
  const levels = levelProgress(attempts);
  const passed = passedDrillIds(attempts);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="size-4 text-primary" aria-hidden /> Your menu
          </CardTitle>
          <CardDescription>
            {menu.length} dish{menu.length === 1 ? "" : "es"} saved.{" "}
            {canBuildMenuQuiz(menu) ? "Quiz yourself on ingredients and allergens." : `Add ${MIN_MENU_ITEMS}+ with descriptions to unlock the quiz.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Link href="/learn/menu" className="flex h-12 items-center justify-center rounded-lg border text-sm font-medium hover:bg-muted">
            Edit menu
          </Link>
          <Link
            href="/learn/drill/menu"
            aria-disabled={!canBuildMenuQuiz(menu)}
            className={cn(
              "flex h-12 items-center justify-center rounded-lg text-sm font-medium",
              canBuildMenuQuiz(menu) ? "bg-primary text-primary-foreground" : "pointer-events-none bg-muted text-muted-foreground",
            )}
          >
            Menu quiz
          </Link>
        </CardContent>
      </Card>

      {levels.map((level) => (
        <Card key={level.id} className={cn(!level.unlocked && "opacity-70")}>
          <CardHeader>
            <CardDescription>Level {level.id}</CardDescription>
            <CardTitle className="flex items-center gap-2">
              {level.title}
              {level.complete ? <CircleCheck className="size-4 text-primary" aria-label="Complete" /> : null}
              {!level.unlocked ? <Lock className="size-4 text-muted-foreground" aria-label="Locked" /> : null}
            </CardTitle>
            <CardDescription>
              {!level.playable
                ? level.summary
                : level.unlocked
                  ? `${level.passed} of ${level.total} drills passed. ${level.summary}`
                  : `Pass every Level ${level.id - 1} drill to unlock.`}
            </CardDescription>
          </CardHeader>
          {level.playable && level.unlocked ? (
            <CardContent>
              <ul className="divide-y">
                {drillsForLevel(level.id).map((d) => (
                  <li key={d.id}>
                    <Link href={`/learn/drill/${d.id}`} className="flex min-h-12 items-center gap-3 py-2">
                      <span className="flex-1">
                        <span className="block font-medium">{d.title}</span>
                        <span className="block text-xs text-muted-foreground">{d.summary}</span>
                      </span>
                      {passed.has(d.id) ? <CircleCheck className="size-5 text-primary" aria-label="Passed" /> : null}
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
