import { Sparkles } from "lucide-react";
import { compareToForecast, type Forecast } from "@/lib/forecast/engine";
import { comparisonMessage, FORECAST_DISCLAIMER, lockedMessage, rangeText, shiftLabel } from "@/lib/forecast/messages";
import { cn } from "@/lib/utils";

/** Shows the typical range for the shift being logged and, once an amount is typed, how it compares. */
export function ForecastPreview({ forecast, takeHomeCents }: { forecast: Forecast; takeHomeCents: number | null }) {
  if (forecast.status === "locked") {
    const m = lockedMessage(forecast);
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm">
        <p className="font-medium">{m.headline}</p>
        <p className="text-muted-foreground">{m.detail}</p>
      </div>
    );
  }

  const m = takeHomeCents === null ? null : comparisonMessage(compareToForecast(takeHomeCents, forecast), forecast);
  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-lg border p-3 text-sm",
        m?.tone === "celebrate" && "border-primary/40 bg-primary/5",
      )}
    >
      {m ? (
        <p className={cn("flex items-center gap-1.5 font-medium", m.tone === "celebrate" && "text-primary")}>
          {m.tone === "celebrate" ? <Sparkles className="size-4" aria-hidden /> : null}
          {m.headline}
        </p>
      ) : (
        <p className="font-medium">
          Typical {shiftLabel(forecast)}: {rangeText(forecast)}
        </p>
      )}
      <p className="text-muted-foreground">
        {m?.detail ? `${m.detail} ` : ""}
        {FORECAST_DISCLAIMER}
      </p>
    </div>
  );
}
