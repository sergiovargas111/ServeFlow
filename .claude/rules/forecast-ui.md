---
paths:
  - "src/lib/forecast/**"
  - "src/lib/report/**"
  - "src/app/**/report/**"
  - "src/components/report/**"
  - "src/components/shifts/**"
---

# Tip forecast and report UI rules

- Below-forecast messaging is always neutral ("Slower than usual. Tuesdays vary."). Never red, never "failure", "bad", "missed" or similar.
- Above-forecast messaging can celebrate ("+14.6% above your typical Friday dinner").
- Always compare like with like: same day of week + same shift type. Holiday-tagged shifts are only compared with other holiday shifts.
- Show a typical **range** (p25–p75), never a single promised number. Label forecasts "based on your history"; never imply a guarantee.
- No forecast until the group has the minimum sample size; show "Log a few more shifts to unlock your forecast".
- Always show the weekly/monthly trend next to a single-shift comparison.
- Never send raw tip amounts to analytics or logs.
