---
paths:
  - "src/**"
  - "scripts/**"
  - "supabase/**"
  - "e2e/**"
---

# Testing rules

- Every new function with logic gets unit tests in the same change, next to the code as `*.test.ts`.
- Run the full suite (`npm test`) before calling any task done. CI runs it on every push.
- Never delete, skip or weaken a failing test to make it pass. Fix the code, or ask.
- Bug found? First write a failing test that reproduces it, then fix the code. Keep the test as a permanent regression test.
- Name tests by behavior: "returns no forecast under 4 shifts", not "test1".
- Cover edge cases: no data, one shift, outliers, zero tips, invalid input, state with no rules.
- Validation lives on the server (Zod). Security tests call server actions/routes directly, not just the UI. See `docs/TESTING.md` for the required auth, validation and security suite.
