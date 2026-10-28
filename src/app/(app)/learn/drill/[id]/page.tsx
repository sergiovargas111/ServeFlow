import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DrillPlayer } from "@/components/learn/drill-player";
import { MenuDrill } from "@/components/learn/menu-drill";
import { buttonVariants } from "@/components/ui/button";
import { getDrill } from "@/lib/learn/content";
import { canBuildMenuQuiz, MENU_DRILL_ID, MIN_MENU_ITEMS } from "@/lib/learn/menu-quiz";
import { isDrillUnlocked } from "@/lib/learn/progress";
import { fetchAttempts, fetchMenuItems } from "@/lib/learn/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Drill" };

function Header({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link href="/learn" aria-label="Back to Learn" className="-ml-2 flex size-11 items-center justify-center">
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    </div>
  );
}

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === MENU_DRILL_ID) {
    const items = await fetchMenuItems();
    return (
      <div className="space-y-5">
        <Header title="Menu quiz" />
        {canBuildMenuQuiz(items) ? (
          <MenuDrill items={items} />
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Add at least {MIN_MENU_ITEMS} dishes with a short description to start quizzing yourself on your menu.
            </p>
            <Link href="/learn/menu" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}>
              Add dishes
            </Link>
          </div>
        )}
      </div>
    );
  }

  const drill = getDrill(id);
  if (!drill) notFound();
  const attempts = await fetchAttempts();

  return (
    <div className="space-y-5">
      <Header title={drill.title} />
      {isDrillUnlocked(drill, attempts) ? (
        <DrillPlayer drillId={drill.id} questions={drill.questions} />
      ) : (
        <p className="text-muted-foreground">Pass every drill in Level {drill.level - 1} to unlock this one.</p>
      )}
    </div>
  );
}
