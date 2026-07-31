-- Stores the actual last-4-quarters EPS actual-vs-estimate history (not just
-- the averaged surprise %) so the Value Radar detail view can show the real
-- beat/miss trend per quarter instead of a single blended number.
alter table public.stock_fundamentals
  add column if not exists eps_surprise_history jsonb;
