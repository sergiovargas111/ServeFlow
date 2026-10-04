import type { ShiftType } from "./types";

/** Best guess for the shift being logged: before 3pm it's probably lunch, otherwise dinner. */
export function defaultShiftType(now: Date = new Date()): ShiftType {
  return now.getHours() < 15 ? "lunch" : "dinner";
}
