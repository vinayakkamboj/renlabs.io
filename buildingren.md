# Building Ren — the integration plan

How the pieces become one system: website → auth → our own model → cloud.
[`Ren.md`](Ren.md) says what Ren is; this file says how we build it.

## Architecture (target state)

```
                       ┌─────────────────────────────┐
                       │   Next.js app (Vercel)      │
   Visitors ──────────▶│   marketing site + /play-   │
                       │   ground + /dashboard       │
                       └──────┬──────────────┬───────┘
                              │              │
                   /api/chat  │              │  @supabase/ssr
                              ▼              ▼
              ┌────────────────────┐   ┌──────────────────────┐
              │ Inference backend  │   │ Supabase             │
              │ (OpenAI-compatible)│   │ · Auth (email, magic │
              │                    │   │   link, OAuth later) │
              │ now: mlx_lm.server │   │ · Postgres + RLS     │
              │  on the Mac (:8080)│   │ · profiles, convos,  │
              │ later: vLLM on     │   │   usage logging      │
              │  serverless GPU    │   └──────────────────────┘
              └────────────────────┘
                        ▲
                        │ QLoRA fine-tune (ml/ kit)
              ┌────────────────────┐
              │ Ren-1 = Qwen3.5-27B│
              │ + our adapter      │
              └────────────────────┘
```

Two env-var groups control everything — no code changes between local and cloud:

| Variable | Purpose |
| --- | --- |
| `INFERENCE_BASE_URL` | OpenAI-compatible endpoint (`http://localhost:8080/v1` → tunnel → vLLM) |
| `INFERENCE_MODEL_ID` | Served model id (`ren-1`) |
| `INFERENCE_API_KEY` | Bearer token for hosted endpoints (optional) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin key (never exposed; optional, for jobs) |

Everything degrades gracefully: **no Supabase keys → auth off, dashboard open
(demo); no inference URL → playground demo mode.** The site always works.

## Phase 0 — Foundation ✅ (done)

- Public site, research portal, products, playground, internal dashboard.
- `/api/chat` streaming route (OpenAI-compatible, tested end-to-end).
- `ml/` fine-tuning kit: Qwen3.5-27B QLoRA on the 48GB Mac, starter identity
  dataset, train/serve/eval scripts.

## Phase 1 — Supabase backend 🔄 (this phase; scaffolding shipped, needs keys)

What ships in the repo now:

- `@supabase/ssr` clients (browser + server) in `src/lib/supabase/`.
- `middleware.ts`: session refresh + **`/dashboard` requires login** once keys
  are present.
- `/login`: email + password and magic-link sign-in, in the Ren design system.
- `/auth/callback` (code exchange) and `/auth/signout` routes.
- SQL migration `supabase/migrations/0001_init.sql`: `profiles` (auto-created
  on signup via trigger), `conversations` + `messages` (playground
  persistence), `api_usage` (request logging) — all with row-level security.

What we need from you (the keys you mentioned):

1. Create a project at supabase.com (free tier is fine).
2. Send: **Project URL** and **anon key** (Settings → API). Service-role key
   only if we want server-side jobs later.
3. Run the migration: paste `supabase/migrations/0001_init.sql` into the SQL
   editor, or `npx supabase db push` with the CLI linked to the project.
4. We put the two values in `.env.local` (and later in Vercel env settings).

Next steps inside this phase once keys land: persist playground conversations
per user, log `api_usage` from `/api/chat`, show real usage in the dashboard.

## Phase 2 — Ren-1 exists (the model)

1. `hf download mlx-community/Qwen3.5-27B-MLX-4bit` on the Mac.
2. Grow `ml/data/` beyond the starter set (identity is covered; capability
   needs your real coding/math examples — highest-leverage work in the plan).
3. `ml/train.sh` → `ml/eval.sh` (base vs. tuned, fixed prompts never trained
   on) → `ml/serve.sh`.
4. `.env.local` → playground shows **Live · ren-1**.

Exit criteria: model self-identifies as Ren-1, eval suite shows no regression
vs. base on held-out coding/math prompts.

## Phase 3 — World-facing deployment

1. **Site:** Vercel (free) — env vars set in the dashboard, `main` auto-deploys.
2. **Model, free path:** `cloudflared tunnel --url http://localhost:8080` on
   the Mac → set `INFERENCE_BASE_URL` on Vercel to the tunnel URL. Honest
   limits: up when the Mac is up, one user at a time comfortably.
3. **Model, paid path (when traffic justifies):** push fused `ren-1` weights
   to a private HF repo → vLLM on Modal/RunPod serverless (scale-to-zero) →
   swap `INFERENCE_BASE_URL`. Zero code changes.
4. Add per-user rate limiting in `/api/chat` (Supabase `api_usage` makes this
   trivial: count rows per user per hour).

## Phase 4 — Compounding (the institution)

- **Data program:** every accepted playground conversation becomes candidate
  training data (with consent flag in `conversations`).
- **Free training scale-up:** Kaggle (30 GPU-h/week) for bigger QLoRA runs on
  the same JSONL format; adapters come back to the Mac.
- **Real Ledger:** eval results written to Postgres; the dashboard's
  benchmark center reads live data instead of fixtures.
- **Ren API as a product:** Supabase-issued API keys, usage-metered, the
  `/platform` page stops being aspirational.

## Sequencing rule

One phase's exit criteria before the next phase's spend. Specifically: no
paid GPU hosting (Phase 3.3) until Phase 2's eval gate passes, and no API
product (Phase 4) until rate limiting (Phase 3.4) exists.
