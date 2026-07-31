# Migrating Tickerframe off Lovable — status & next steps

This doc is the honest state of the migration: what's been fully ported and
verified against what you shared in chat, what's Lovable-specific and has
already been swapped out, and what still needs to come from you (or a Claude
Code session with real filesystem + network access) before `npm run dev`
works end to end.

## What Claude actually did in this session

This chat environment is a sandboxed container with **no network access and
no exposed ports** — `npm install` and a live dev server aren't possible
here. What I *could* do: reconstruct every file from what you pasted into
the conversation, fix the two Lovable-specific integration points, and
package a project tree that's ready to open in Claude Code (which does have
real network + filesystem + a browser).

### Lovable removed / replaced

| What | Status |
|---|---|
| `lovable-tagger` (`vite.config.ts` dev plugin) | Removed from `vite.config.ts` and `package.json` |
| `@lovable.dev/cloud-auth-js` (`src/integrations/lovable/`) | Deleted. `Auth.tsx` now calls `supabase.auth.signInWithOAuth({ provider: 'google' })` directly — Supabase's native OAuth, not a Lovable wrapper |
| `index.md` "Project Memory" file | Not carried over as-is (it was Lovable-specific project context). Fold anything still relevant into a `CLAUDE.md` at the repo root — Claude Code reads that convention automatically. |

**Action required on your end:** in the Supabase dashboard →
Authentication → Providers → Google, make sure the Client ID/Secret are
configured there directly (not routed through Lovable), and that this app's
deployed origin(s) are in the provider's authorized redirect URIs.

### Also fixed while porting

`useLiveOptionQuotes.ts` had a stale-closure bug: `ws.onclose` checked the
`mode` state variable (captured at effect-setup time) instead of the live
value, which could let a WebSocket close trigger a duplicate polling loop
after a fallback had already happened. Fixed with a `modeRef` ref so the
close handler always reads the current mode.

## Fully ported and in the repo now

**Config:** `package.json`, `vite.config.ts`, `vitest.config.ts`,
`tsconfig*.json`, `tailwind.config.ts`, `postcss.config.js`,
`eslint.config.js`, `components.json`, `index.html`, `.gitignore`,
`.env.example`

**Pages:** Dashboard, Auth (OAuth swapped), ResetPassword, Stocks, Options,
Calls, Puts, PortfolioPage, News, Methodology, Legal, Health, NotFound

**Hooks:** useStockData, usePortfolio, useLiveOptionQuotes (bug fixed),
useAuth, use-toast, use-mobile

**Lib:** utils, mockData, marketHours, optionsMockData, optionPicks

**Components:** AppLayout, AppSidebar, Disclaimer, ErrorBoundary, NavLink,
AlertsPanel, GovTradesPanel, InstitutionalPanel, EntryExit, MarketChat,
MarketOverview, Indicators, MiddayBriefing, OnboardingTour, PatternBadge,
Watchlist, TopMovers

**Context:** StockDetailContext

**Supabase client:** `src/integrations/supabase/client.ts` (unchanged —
purely reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`)

## Not yet ported — needs one more pass in Claude Code

These weren't finished in this session, either because you hadn't uploaded
them yet or purely to keep this response finite. None of them need any
Lovable-specific rework — they're straight copies once you (or Claude Code
reading back through this chat transcript, if you export it) paste the
content into the right path.

**Components still to copy in verbatim** (I have the content from earlier in
this conversation, just ran out of room to keep transcribing):
`PennyWatchlist.tsx`, `Portfolio.tsx`, `StockChart.tsx`,
`PredictionTracker.tsx`, `StockDetailModal.tsx` → all go in `src/components/`

**`src/components/options/`** — I have content for: `TickerBanner.tsx`,
`SentimentSummary.tsx`, `ScoreExplainer.tsx`, `ScannerTable.tsx`,
`TrackedPicks.tsx`, `WeekendGapsList.tsx`. Still genuinely missing (never
uploaded to this chat): `BestTradeCards.tsx`, `AdvancedFilters.tsx`,
`OptionsFlowList.tsx`, `FlowTiltPanel.tsx`, `MarketRegimeBar.tsx`,
`IndexEarlyWarning.tsx`, `RegulatoryFilings.tsx`, `EarningsCalendar.tsx`,
`NewsFeed.tsx`, `OptionChainLookup.tsx`, `OptionPickTracker.tsx`,
`CashSecuredPuts.tsx`, `OptionsSidePage.tsx` — `Options.tsx`, `Calls.tsx`,
and `Puts.tsx` all import these, so the app won't compile until they exist.

**`src/components/auth/`** — `ProtectedRoute.tsx` and `UserMenu.tsx` are
imported by `App.tsx` / `AppLayout.tsx` but were never uploaded to this
chat. Needed for the app to build.

**Pages never uploaded:** `Patterns.tsx`, `Performance.tsx` — both are
routed in `App.tsx` (`/patterns`, `/performance`) but no content was ever
shared in this conversation.

**Lib files never uploaded:** `src/lib/patterns.ts` (exports
`getPatternMeta`, used by `PatternBadge.tsx`), `src/lib/types.ts`.

**Supabase generated types:** `src/integrations/supabase/types.ts` is
auto-generated and wasn't uploaded (and shouldn't be hand-written). Once you
have a Supabase project connected, generate it with:
```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

**shadcn/ui primitives (`src/components/ui/*`):** ~40 files, all unmodified
stock shadcn components (button, card, dialog, table, tabs, toast, sidebar,
etc.) — you pasted them all into this chat and none had any custom logic or
Lovable-specific code. Rather than hand-copy 40 files, the correct move in
Claude Code is to regenerate them from the shadcn registry so they stay
updatable:
```bash
npx shadcn@latest init   # components.json is already in this repo, so it'll detect config
npx shadcn@latest add button card dialog alert-dialog accordion avatar \
  aspect-ratio badge breadcrumb calendar carousel chart checkbox \
  collapsible command context-menu drawer dropdown-menu form hover-card \
  input input-otp label menubar navigation-menu pagination popover \
  progress radio-group resizable scroll-area select separator sheet \
  sidebar skeleton slider sonner switch table tabs textarea toast \
  toggle toggle-group tooltip
```
If any generated file drifts from what you had (shadcn updates its
templates periodically), diff against what you pasted earlier in this
conversation and reapply anything custom — from what was shared, none of
these had been hand-modified from stock.

**Public assets:** `public/placeholder.svg` and `public/favicon.ico` are
binary/image files that can't be reconstructed from a text transcript — just
copy them from your existing Lovable project export.

## Backend — the bigger remaining piece

None of this session touched the Supabase backend, because it wasn't shared
in chat. `Options.tsx`, `Portfolio.tsx`/`PortfolioPage.tsx`, `Health.tsx`,
`AlertsPanel.tsx`, and most other pages call `supabase.functions.invoke(...)`
against edge functions and query tables that need to exist for the app to
do anything beyond render empty states. To finish the migration:

1. **Decide**: keep Supabase (just move off Lovable Cloud to a Supabase
   project you own) or migrate the backend elsewhere. Given how deeply this
   app is wired to Supabase (auth, Postgres, edge functions, RLS), staying
   on Supabase is almost certainly the path of least resistance.
2. **Export the schema** from your current (Lovable Cloud) Supabase project:
   ```bash
   npx supabase db dump --db-url "postgresql://...' -f schema.sql
   ```
   or, from the Supabase dashboard, Database → Backups, or just
   `pg_dump` the connection string directly.
3. **Export the edge functions** — everything under `supabase/functions/`:
   `analyze-stock`, `options-scanner`, `market-chat`,
   `generate-midday-briefing`, `track-government-trades`,
   `track-institutional`, `option-quotes`, `fetch-portfolio-quotes`,
   `tradier-stream-session`, and whatever else the cron jobs referenced in
   `Health.tsx`'s `TRACKED_JOBS` list point to (`snapshot-signals`,
   `track-signal-marks`, `resolve-signal-outcomes`,
   `calibrate-factor-weights`, `snapshot-iv-history`, `fetch-stock-data`,
   `finnhub-news`, `refresh-macro`). None of these were shared in this
   chat, so I couldn't port them — but this is exactly the kind of thing
   Claude Code can pull directly if you run `supabase functions list` /
   `supabase functions download <name>` against your existing project.
4. **Re-point** `.env` (from `.env.example`) at the new/kept Supabase
   project's URL and anon key.
5. **Re-create cron schedules** (pg_cron or Supabase's Cron feature) for the
   jobs listed above.

## Recommended order of operations in Claude Code

1. Open this folder in Claude Code.
2. `npm install` and confirm `npm run dev` at least boots (it won't fully
   compile yet — missing imports listed above will error).
3. Ask Claude Code to fill in the "not yet ported" components above by
   pointing it at this conversation transcript, or re-paste those files.
4. Run the `shadcn add` command above.
5. `supabase link` to your project, pull schema + functions, generate
   `types.ts`.
6. Fix remaining TypeScript errors from `npm run build` one by one — with a
   real filesystem and compiler feedback loop, this goes fast.
7. Confirm Google OAuth against the new Supabase project's provider config.
8. `npm run dev`, sign in, click around.
