import { describe, expect, it } from "vitest";
import { compareToForecast, type Forecast } from "./engine";
import { comparisonMessage, formatPct, lockedMessage, rangeText, shiftLabel } from "./messages";

type Ready = Extract<Forecast, { status: "ready" }>;

const friday: Ready = {
  status: "ready",
  dayOfWeek: 5,
  shiftType: "dinner",
  holiday: false,
  sampleSize: 8,
  p25: 15000,
  median: 18000,
  p75: 21000,
};

const message = (actualCents: number, forecast: Ready = friday) =>
  comparisonMessage(compareToForecast(actualCents, forecast), forecast);

describe("comparisonMessage", () => {
  it("celebrates a night above typical, with the plan's wording", () => {
    expect(message(20628)).toEqual({
      tone: "celebrate",
      headline: "+14.6% above your typical Friday dinner",
      detail: "Your typical Friday dinner is $150–$210.",
    });
  });

  it("uses neutral wording for a slow night", () => {
    expect(message(9000)).toMatchObject({ tone: "neutral", headline: "Slower than usual. Fridays vary." });
  });

  it("says 'right around typical' within ±5%", () => {
    expect(message(18500).headline).toBe("Right around your typical Friday dinner");
    expect(message(17200).headline).toBe("Right around your typical Friday dinner");
  });

  it("treats exactly +5% as notable", () => {
    expect(message(18900).tone).toBe("celebrate");
  });

  it("handles holiday forecasts", () => {
    const holiday = { ...friday, holiday: true };
    expect(message(9000, holiday).headline).toBe("Slower than usual. Holidays vary.");
    expect(message(30000, holiday).headline).toMatch(/above your typical holiday dinner$/);
  });

  it("handles a typical midpoint of $0", () => {
    const zero = { ...friday, p25: 0, median: 0, p75: 0 };
    expect(message(5000, zero)).toMatchObject({ tone: "celebrate", headline: "Above your typical Friday dinner" });
    expect(message(0, zero)).toMatchObject({ tone: "neutral" });
  });

  it("never shames: no negative tone or failure words for any outcome", () => {
    const banned = /fail|bad|poor|worse|worst|miss|disappoint|terrible|loss|lost|down|below|behind|short/i;
    for (let dollars = 0; dollars <= 400; dollars += 5) {
      const m = message(dollars * 100);
      expect(["celebrate", "neutral"]).toContain(m.tone);
      if (m.tone === "neutral") expect(`${m.headline} ${m.detail}`).not.toMatch(banned);
    }
  });
});

describe("lockedMessage", () => {
  it("uses the plan's unlock prompt and shows progress", () => {
    const locked = { status: "locked", dayOfWeek: 2, shiftType: "lunch", holiday: false, sampleSize: 1, needed: 3 } as const;
    expect(lockedMessage(locked)).toEqual({
      tone: "neutral",
      headline: "Log a few more shifts to unlock your forecast",
      detail: "1 of 4 Tuesday lunches logged so far.",
    });
  });
});

describe("formatting helpers", () => {
  it("formats percentages with a sign and one decimal", () => {
    expect(formatPct(14.58)).toBe("+14.6%");
    expect(formatPct(-8)).toBe("-8.0%");
    expect(formatPct(0)).toBe("0.0%");
  });

  it("labels shifts and ranges", () => {
    expect(shiftLabel(friday)).toBe("Friday dinner");
    expect(shiftLabel({ ...friday, holiday: true })).toBe("holiday dinner");
    expect(rangeText(friday)).toBe("$150–$210");
  });
});
