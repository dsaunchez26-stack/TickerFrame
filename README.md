# Tickerframe

Real-time stock & options research dashboard — live signals, factor-weighted
scores, and transparent performance tracking. Research and education only;
not investment advice.

## Stack

React + TypeScript + Vite, Tailwind CSS, shadcn/ui, TanStack Query, Supabase
(Postgres + Auth + Edge Functions).

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

Open http://localhost:8080.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build (source maps, unminified) |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | ESLint |
| `npm run test` | Run tests once (Vitest) |
| `npm run test:watch` | Vitest watch mode |

## Project structure

```
src/
  pages/         Route-level components
  components/    Shared UI components
  components/ui/ shadcn/ui primitives
  components/options/  Options Radar subcomponents
  hooks/         React Query hooks + auth context
  lib/           Pure utilities, mock data generators, market-hours logic
  integrations/supabase/  Supabase client + generated DB types
  context/       React context providers
```

## Migrated from Lovable

This project was originally scaffolded and developed in Lovable. It has been
migrated to a standalone Vite project for local development / Claude Code.
See [`MIGRATION.md`](./MIGRATION.md) for exactly what changed, what's fully
ported, and what still needs finishing (some components, the Supabase
schema, and edge functions weren't part of the migration source material and
need to be pulled from your existing Supabase project).

## Environment variables

See `.env.example`. Both are read from `import.meta.env` at build time
(standard Vite behavior) — no server-side secrets belong here.

## Backend

The app expects a Supabase project with the appropriate tables, RLS
policies, and edge functions already deployed. See `MIGRATION.md` for the
list of edge functions the frontend calls.
