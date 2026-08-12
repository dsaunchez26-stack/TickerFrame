-- Insider buying & large-holder filings pulled from SEC EDGAR (Form 4 open-
-- market purchases, and Schedule 13D/13G 5%+ holder filings) by the
-- insider-scanner edge function. Form 4 rows carry a real price paid;
-- 13D/13G rows generally don't (SEC doesn't require per-share price on the
-- cover page), so price_per_share/total_value stay null for those.
create table if not exists public.insider_activity (
  id text primary key, -- accession number + line index, e.g. "0001140361-26-025622-0"
  ticker text not null,
  form_type text not null, -- '4' | 'SC 13D' | 'SC 13D/A' | 'SC 13G' | 'SC 13G/A'
  filer_name text not null,
  filer_title text, -- e.g. "Chief Executive Officer, Director" (Form 4 only)
  transaction_code text, -- 'P' for open-market purchase (Form 4 only)
  transaction_date date,
  shares numeric,
  price_per_share numeric,
  total_value numeric,
  shares_owned_after numeric,
  filing_date date not null,
  accession_number text not null,
  filing_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists insider_activity_ticker_idx on public.insider_activity (ticker);
create index if not exists insider_activity_filing_date_idx on public.insider_activity (filing_date desc);
create index if not exists insider_activity_total_value_idx on public.insider_activity (total_value desc nulls last);

alter table public.insider_activity enable row level security;

create policy "insider_activity is readable by anyone"
  on public.insider_activity for select
  using (true);
