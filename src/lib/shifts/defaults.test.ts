import { describe, expect, it } from "vitest";
import { defaultShiftType } from "./defaults";

describe("defaultShiftType", () => {
  it("guesses lunch before 3pm local time", () => {
    expect(defaultShiftType(new Date(2026, 9, 2, 14, 59))).toBe("lunch");
  });

  it("guesses dinner from 3pm, including after midnight closes", () => {
    expect(defaultShiftType(new Date(2026, 9, 2, 15, 0))).toBe("dinner");
    expect(defaultShiftType(new Date(2026, 9, 2, 23, 30))).toBe("dinner");
  });
});
