# FlowPoint AI

FlowPoint AI is a relationship and outreach workspace for contacts, inbox conversations, business policies, properties, notifications, and AI-assisted follow-up workflows.

## Run & Operate

- `pnpm --filter @workspace/flowpoint-ai run dev` — run the FlowPoint frontend
- `pnpm --filter @workspace/api-server run dev` — run the shared API health service
- `pnpm --filter @workspace/flowpoint-ai run typecheck` — typecheck the frontend
- `pnpm --filter @workspace/flowpoint-ai run build` — build the frontend for publishing
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

Required frontend secrets/env vars:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- `VITE_WEBHOOK_SEND_EMAIL` — n8n webhook endpoint used for AI-assisted email/task sending
- `VITE_WEBHOOK_AGENT` — n8n webhook endpoint used by the agent workflow
- `VITE_WEBHOOK_POLICIES_CHAT` — n8n webhook endpoint used by the business-policy assistant

The same names are listed in `artifacts/flowpoint-ai/.env.example`. Do not commit real values.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React, Vite, Wouter, Tailwind CSS, Radix UI, Framer Motion
- Data/auth: Supabase client with realtime subscriptions
- API: Express 5 health service under `/api`
- Build: Vite and esbuild

## Where things live

- `artifacts/flowpoint-ai` — main web application served at `/`
- `artifacts/api-server` — small Express service served at `/api`
- `artifacts/mockup-sandbox` — component preview service served at `/__mockup`
- `supabase/properties.sql` — Supabase property-related SQL reference
- `artifacts/flowpoint-ai/src/lib/supabase.ts` — browser Supabase client setup
- `artifacts/flowpoint-ai/src/components/SendMessageModal.tsx` — email/task webhook integration
- `artifacts/flowpoint-ai/src/pages/agent.tsx` — agent webhook integration
- `artifacts/flowpoint-ai/src/pages/business-policies.tsx` — policy assistant webhook integration
- `artifacts/flowpoint-ai/src/pages/units.tsx` — Supabase-backed Units CRUD and detail UI
- `artifacts/flowpoint-ai/src/components/FlowPointSelect.tsx` — shared custom dropdown menu
- `supabase/units.sql` — executable Units table, relationship, indexes, trigger, and RLS policies

## Architecture decisions

- Supabase remains the source of truth for authentication, application data, and realtime updates.
- Supabase and webhook values are client build-time variables, supplied through environment secrets rather than committed files.
- The FlowPoint frontend owns the root preview path; the API and mockup services retain their dedicated paths.
- Units reference `properties.id` through `units.property_id`; property names and addresses are never copied into unit records.

## Product

Users sign in through Supabase, review dashboard activity, manage contacts and properties, work an inbox, maintain business policies, and configure AI follow-up behavior.

## User preferences

- The user will add Supabase credentials and webhook URLs manually as secrets/env vars.

## Gotchas

- The frontend intentionally fails fast with a clear configuration error when its two Supabase variables are absent.
- `VITE_*` values are bundled by Vite, so set them before starting the preview or publishing.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
