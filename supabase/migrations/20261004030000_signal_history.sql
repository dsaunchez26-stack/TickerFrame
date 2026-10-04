-- One row per symbol per trading day: the buy/sell/hold call and the price it
-- was made at. Comparing each call with the price N trading days later is the
-- only honest way to find out whether the signal is worth anything, so this
-- starts accumulating real history from now on. 'replay' rows are the same
-- rule re-run over the last week of already-collected price samples, kept
-- separate from 'live' rows so the two are never mixed up.
create table if not exists public.signal_history (
  symbol text not null,
  trade_date date not null,
  signal text not null check (signal in ('buy', 'sell', 'hold')),
  signal_score integer,
  price numeric not null,
  source text not null default 'live' check (source in ('live', 'replay')),
  primary key (symbol, trade_date, source)
);

create index if not exists signal_history_date_idx on public.signal_history (trade_date);

alter table public.signal_history enable row level security;

create policy "signal_history is readable by anyone"
  on public.signal_history for select
  using (true);

-- Average forward return and hit rate per signal, at 1/3/5 trading-day
-- horizons, computed in-database so the page downloads a tiny result instead
-- of the whole history. "Forward return" = price N trading days after the
-- call, relative to the price at the call (only rows that have such a later
-- row are counted). A buy "hits" when the price rose, a sell when it fell.
create or replace function public.signal_track_record()
returns jsonb
language sql
stable
set search_path = public
as $$
  with horizons(h) as (values (1), (3), (5)),
  fwd as (
    select
      hz.h,
      s.source,
      s.signal,
      (lead(s.price, hz.h) over (partition by s.symbol, s.source order by s.trade_date) - s.price) / nullif(s.price, 0) * 100 as ret
    from signal_history s
    cross join horizons hz
  ),
  per_signal as (
    select h, source, signal, count(*) as n, avg(ret) as avg_ret,
           avg((case when signal = 'buy' then ret > 0 when signal = 'sell' then ret < 0 else null end)::int) * 100 as hit_rate
    from fwd where ret is not null
    group by h, source, signal
  ),
  overall as (
    select h, source, 'all'::text as signal, count(*) as n, avg(ret) as avg_ret, null::numeric as hit_rate
    from fwd where ret is not null
    group by h, source
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'horizon', h, 'source', source, 'signal', signal, 'n', n,
        'avgReturnPct', round(avg_ret::numeric, 3), 'hitRatePct', round(hit_rate::numeric, 1)))
      from (select * from per_signal union all select * from overall) u), '[]'::jsonb),
    'liveDays', (select count(distinct trade_date) from signal_history where source = 'live'),
    'liveFirstDate', (select min(trade_date) from signal_history where source = 'live'),
    'replayDays', (select count(distinct trade_date) from signal_history where source = 'replay'),
    'replayFirstDate', (select min(trade_date) from signal_history where source = 'replay'),
    'replayLastDate', (select max(trade_date) from signal_history where source = 'replay')
  );
$$;

grant execute on function public.signal_track_record() to anon, authenticated, service_role;
