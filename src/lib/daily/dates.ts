import { addDays, daysBetween } from "@/lib/shifts/dates";

/** 0-based day of the year for a YYYY-MM-DD date (Jan 1 = 0). */
export function dayOfYear(iso: string): number {
  return daysBetween(`${iso.slice(0, 4)}-01-01`, iso);
}

/**
 * Activity dates come from the phone's calendar day, which can be a day
 * behind or ahead of the server's UTC day. Accept only that window.
 */
export function isNearToday(date: string, serverToday: string): boolean {
  return date >= addDays(serverToday, -1) && date <= addDays(serverToday, 1);
}
