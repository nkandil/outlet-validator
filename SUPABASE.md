# Supabase Setup

This project uses Supabase as a hosted PostgreSQL database through the existing Drizzle/Postgres data layer.

Supabase project:

- Name: `outlet-validator`
- Project ref: `kgoexrabyvldygdudnol`
- Region: `eu-central-1`
- Database host: `db.kgoexrabyvldygdudnol.supabase.co`

For local development against Supabase, set `DATABASE_URL` in `.env` to the transaction or session pooler connection string from Supabase Database > Connect > Pooler settings. Copy the exact pooler user and host shown by Supabase.

```env
DATABASE_URL=postgresql://<POOLER_USER>:<DB_PASSWORD>@<POOLER_HOST>:6543/postgres?sslmode=require
DEMO_MODE=false
```

If the database password contains URL-reserved characters, encode them before putting the value in `DATABASE_URL`. For example, `@` must be written as `%40`.

The direct database URL, `db.kgoexrabyvldygdudnol.supabase.co:5432`, is not IPv4 compatible. Use the pooler URL for local development and Netlify unless your environment has IPv6 access to the direct database host.

Then push the app schema and start both local servers:

```powershell
pnpm --filter @workspace/db run push
pnpm run dev:api
pnpm run dev:web
```

Keep `DATABASE_URL`, `JWT_SECRET`, and `ADMIN_PASSWORD` server-side only. Do not add Supabase service keys or database passwords to frontend `VITE_*` variables.
