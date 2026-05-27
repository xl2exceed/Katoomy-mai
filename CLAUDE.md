# Katoomy (clientloop-mai) — Claude Instructions

## Active Repo
All work is in this repo (`clientloop-mai` / `Katoomy-mai` on GitHub). There is an older `clientloop` repo — do NOT commit work there.

## Deployments
- Vercel project: **Katoomy-mai** — auto-deploys on every push to `main`
- **Never run `npx vercel` from the CLI** — it re-links to the wrong project. Deploy via `git push` only.
- Vercel runs `npm run build` on deploy, which runs `prebuild` first (see AI Knowledge Base section below)

## Git Workflow
- After every push: `git tag v<YYYY-MM-DD> && git push origin v<YYYY-MM-DD>`
- If multiple pushes happen on the same day, use `v<YYYY-MM-DD>-2`, `-3`, etc.

## AI Help Assistant — Knowledge Base
- The AI help assistant knowledge base lives in `lib/ai-help-knowledge.ts`
- **This file is auto-generated** by `scripts/generate-ai-knowledge.mjs` and gets overwritten on every Vercel deploy
- **IMPORTANT: Whenever a new page (`page.tsx`) is created**, add a matching entry to `ROUTE_METADATA` in `scripts/generate-ai-knowledge.mjs` — otherwise the AI assistant will give a generic wrong description for that page
- After updating `ROUTE_METADATA`, run `node scripts/generate-ai-knowledge.mjs` to regenerate `lib/ai-help-knowledge.ts`
- The help cache (`ai_help_cache` table in Supabase) stores pre-verified Q&A pairs that bypass the AI entirely — seed files are in `supabase/migrations/`

## Architecture
- **Framework**: Next.js (App Router), Supabase, Stripe Connect
- **Auth**: Supabase email/password for admin + staff; phone OTP for customers
- **Staff portal**: `/staff/login`, `/staff/dashboard` — isolated from admin panel
- **Supabase joins**: `.select('*, relation(field)')` returns arrays — always cast as `Type[]` and access `[0]`

## Cron Jobs
- Domain: `katoomy.com` — auth header: `Authorization: Bearer katoomy-cron-2026-1ZXCVBNM`
- Vercel is on Hobby plan — no cron jobs in `vercel.json`. All crons run via cron-jobs.org
- Inngest functions exist in code but are NOT yet active (needs credentials + dashboard sync)

## SMS
- `TWILIO_MODE=TEST` = simulated (no real SMS sent). Change to `LIVE` when 10DLC is approved.

## Pending Migrations (must be run manually in Supabase SQL Editor)
- `supabase/migrations/20260504_business_network.sql` — Business Network tables
- `supabase/migrations/20260504_customer_devices.sql` — Customer device tracking
- `supabase/migrations/20260514_network_broadcast.sql` — Network broadcast SMS tables
