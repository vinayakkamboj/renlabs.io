# Supabase — what's here & how to run it

Supabase doesn't track which of our SQL files have been applied. This folder
keeps them in order and gives you a one-paste way to check what's live.

## Folders

- **`migrations/`** — the database schema, one file per change. Run them **in
  filename order** (oldest first). Every file is idempotent (safe to re-run).
- **`seed/`** — optional one-off helper scripts (not schema). Run only when you
  need them.

## 1. Check what's already applied

Open the **Supabase SQL editor**, paste **`seed/check_migrations.sql`**, run it.
You get a table like:

| migration | status |
|---|---|
| 20260613_credits.sql | ✅ applied |
| 20260619_admin.sql | ❌ MISSING — run this file |

## 2. Apply anything missing

For each ❌ row, open that file in `migrations/`, paste it into the SQL editor,
run it. Then re-run the check until every row is ✅.

Current order:

1. `0001_init.sql` — profiles, conversations, messages
2. `0002_product.sql` — projects, repositories, docs
3. `20260613_credits.sql` — credits + transactions ledger + deduct RPC
4. `20260616_collaboration.sql` — project files & collaborators
5. `20260617_api_keys.sql` — API keys
6. `20260618_free_generation.sql` — 1 free build for new users
7. `20260619_admin.sql` — **admin credit grants + audit log** ← needed for the
   admin panel's "Grant credits" button
8. `20260620_chat.sql` — chat usage

## 3. Give yourself credits to test

Two ways, both audited (every grant is recorded in `admin_audit_log`):

- **Admin panel (preferred):** Admin → **Users** → pick the user →
  **Grant credits**.
- **SQL one-off:** edit the email/amount at the top of
  **`seed/grant_credits.sql`** and run it.

> Safety: there is **no** "unlimited" path. Every build deducts credits
> server-side via the `deduct_build_credits` RPC, even for admins. Admins can
> only *add* credits through the audited grant RPC — never bypass the meter.
