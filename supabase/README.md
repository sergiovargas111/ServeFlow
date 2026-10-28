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

## Labor-law data (Know Your Rights)

`seed/labor_rules.json` is the reviewed dataset: one row per jurisdiction + topic, each with a primary source URL, legal basis and "last verified" date. After editing it, run `npm run labor:seed` to regenerate `seed/labor_rules.sql`, then run that SQL in the Supabase SQL editor (it upserts, so it's safe to re-run). `npm test` fails if the SQL is out of date or a published rule is missing a source or date. `npm run labor:report` prints the data-quality numbers.

Rules are read-only for users. To make someone an admin (can re-verify rules and change their status at `/admin/rules`), set their `app_metadata` with the service role, for example in the SQL editor:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'you@example.com';
```

They need to sign out and back in for it to take effect. **Don't launch Know Your Rights publicly until an employment attorney has reviewed the dataset**; then set `reviewed_by` on each reviewed row.
