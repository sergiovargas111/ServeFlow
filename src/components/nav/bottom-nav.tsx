"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ChartColumn, GraduationCap, MessageCircle, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { isTabActive, TABS, type TabId } from "./tabs";

const ICONS: Record<TabId, typeof ChartColumn> = {
  report: ChartColumn,
  learn: GraduationCap,
  coach: MessageCircle,
  rights: Scale,
  daily: CalendarCheck,
};

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const Icon = ICONS[tab.id];
          const active = isTabActive(pathname, tab.href);
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
