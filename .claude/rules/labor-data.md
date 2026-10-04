---
paths:
  - "src/**/rights/**"
  - "src/**/labor*"
  - "src/lib/labor/**"
  - "supabase/**/*labor*"
  - "supabase/seed/**"
---

# Labor-law data rules

- Every rule must have `source_url` and `last_verified_at`. A published rule missing either is a bug.
- Primary sources only: US Department of Labor state tables, the state labor department site, official statutes. No blogs, law-firm summaries or AI-generated text.
- If the answer depends on employer size, industry or facts we don't have, the answer is **"Depends"** with a short explanation. Never guess Yes/No.
- Rules not verified in 90+ days are flagged "needs review" and are hidden or shown with a warning.
- Always render the source link, the "last verified" date and the "General information, not legal advice" disclaimer.
- Editing `labor_rules` is admin-only (RLS + server check). Never write to it from user-facing code paths.
