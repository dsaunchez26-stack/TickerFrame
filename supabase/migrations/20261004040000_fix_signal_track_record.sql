-- Fix: the window was partitioned without the horizon, so lead(price, N) walked
-- across the horizon-duplicated rows instead of across days.
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
      (lead(s.price, hz.h) over (partition by hz.h, s.symbol, s.source order by s.trade_date) - s.price) / nullif(s.price, 0) * 100 as ret
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
