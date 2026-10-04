# Supabase

SQL migrations live in `migrations/` and run in filename order.

Apply them to your project with the Supabase CLI (no install needed):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste each file, in order, into the SQL editor in the Supabase dashboard.

`migrations.test.ts` runs in `npm test` and fails if any table is created without Row Level Security.
