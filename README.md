# Ren AI

**Ren Code** — AI-powered software engineering — and the website for **Ren AI**,
the company building it. Ren AI is in active development, fine-tuning a single
research model (**Astra**). The site reflects that reality: no invented model
lineage, no benchmark claims without the harness to back them.

See [`Ren.md`](Ren.md) for what Ren is and [`buildingren.md`](buildingren.md)
for the build plan.

## What's here

| Surface | Route | Description |
| --- | --- | --- |
| Homepage | `/` | Hero, the two Ren Code workflows, GitHub integration, the Astra research model, philosophy |
| Ren Code | `/code` | Flagship product: new-project and existing-repository workflows, GitHub flow |
| Research | `/research` | Astra — the current research model, focus areas, and honest roadmap |
| Philosophy | `/philosophy` | How Ren AI works while building in the open |
| Playground | `/playground` | Chat interface that streams from a real model when configured |
| Login | `/login` | Email, magic link, Google + GitHub OAuth (Supabase) |
| Dashboard | `/dashboard` | Product workspace: projects, repositories, integrations, conversations, pull requests, documentation, settings |

The dashboard is auth-gated by `middleware.ts` when Supabase is configured.
A brand-new account is genuinely empty, so the dashboard is built around
first-class **empty states** rather than invented metrics.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS 4** — design tokens live in `src/app/globals.css`
- **Framer Motion** — restrained entrance motion, reduced-motion aware
- **Supabase** — auth (email, magic link, Google + GitHub OAuth) and
  **PostgreSQL**; schema in `supabase/migrations/`. The app runs with no keys
  (auth off, demo mode) and activates the moment keys are present.
- shadcn-style component primitives (`cva` + `tailwind-merge`) in `src/components/ui`

## Design system

- **Typography** — Newsreader (editorial serif display) paired with Inter
  (text) and JetBrains Mono (data), on a fluid clamp-based scale
  (`display-xl`, `display`, `headline`, `title`, `lede`)
- **Color** — warm paper surfaces, deep charcoal ink, graphite secondaries,
  stone hairlines, a single muted-bronze accent; the internal platform uses a
  warm graphite dark palette with brass signals
- **Motion** — one entrance pattern (short fade-and-rise), no loops, no parallax

## Running with a real model (Astra)

The playground streams from any OpenAI-compatible inference server via
`/api/chat`. With no backend configured it falls back to demo mode.

1. Fine-tune and serve Astra locally — full runbook in [`ml/README.md`](ml/README.md)
   (Qwen3.5-27B + QLoRA via MLX on a 48GB Apple Silicon Mac, `ml/serve.sh`
   serves it on `http://localhost:8080/v1`).
2. Copy `.env.example` to `.env.local`.
3. `npm run dev` → `/playground` shows **Live** and streams from your model.

The same two env vars (`INFERENCE_BASE_URL`, `INFERENCE_MODEL_ID`) point the
deployed site at a Cloudflare tunnel or a cloud vLLM endpoint — no code changes.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint
```

All benchmark figures, publications, and platform telemetry are illustrative
fixtures for a fictional organization.

## Hidden routes (easter eggs)

A few playful pages scattered around the site, each with its own die-cut
sticker illustration. All are `noindex`. Kept here so they don't get lost:

| Route | Sticker | What it is |
|-------|---------|------------|
| `/teapot` | mug | HTTP 418 "I'm a teapot" joke |
| `/42` | robot | The answer to life, the universe, and everything |
| `/secret` | ghost | "You found the secret page" |
| `/are-we-there-yet` | rocket | "No. Not yet. Soon." |
| `/lmfao` | cat | Respect for typing it into the URL bar |
| `/brb` | mug | "Back in a bit" — gone for coffee |
| `/meow` | cat | Meet the official Ren Labs cat |

The 404 page (`not-found.tsx`) also uses the cat sticker and links to
`/teapot`. Stickers live in `src/components/ui/sticker.tsx`
(`cat`, `ghost`, `rocket`, `robot`, `mug`); the shared page layout is
`src/components/site/fun-scene.tsx`.
