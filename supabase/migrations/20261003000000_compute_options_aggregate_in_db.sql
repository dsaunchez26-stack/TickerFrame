-- Builds the client-facing options aggregate inside Postgres instead of in
-- the edge function. The edge-function version pulled every options_ticker_cache
-- payload (~10 MB compressed, several times that as JSON text) over the API on
-- every 5-minute scan batch -- ~288x/day -- which exhausted the project's
-- egress quota and got the whole project restricted (HTTP 402). Aggregating
-- in-database moves zero bytes over the wire; only the finished ~70 KB payload
-- is stored.
create or replace function public.compute_options_aggregate(
  p_regime jsonb,
  p_scanned integer,
  p_source text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_leaps jsonb;
  v_spreads jsonb;
  v_diag jsonb;
  v_flow jsonb;
  v_call numeric;
  v_put numeric;
  v_cands bigint;
  v_oldest timestamptz;
  v_n integer;
  v_ratio numeric;
  v_put_call jsonb;
  v_payload jsonb;
begin
  select count(*), coalesce(sum(candidates), 0), min(scanned_at)
    into v_n, v_cands, v_oldest
    from options_ticker_cache;

  with exp as materialized (
    select r.value as row
    from options_ticker_cache c
    cross join lateral jsonb_array_elements(coalesce(c.payload -> 'rows', '[]'::jsonb)) r
  ),
  nums as (
    select
      row,
      row ->> 'ticker' as ticker,
      row ->> 'cp' as cp,
      case when jsonb_typeof(row -> 'dollarFlow') = 'number' then (row ->> 'dollarFlow')::numeric else 0 end as flow,
      case when jsonb_typeof(row -> 'volume') = 'number' then (row ->> 'volume')::numeric else 0 end as volume,
      case when jsonb_typeof(row -> 'score') = 'number' then (row ->> 'score')::numeric else null end as score,
      coalesce(row ->> 'type', '') = 'LEAPS' as is_leaps
    from exp
  )
  select
    (select coalesce(jsonb_agg(x.row), '[]'::jsonb)
       from (select row from nums where not is_leaps order by score desc nulls last limit 80) x),
    (select coalesce(jsonb_agg(x.row), '[]'::jsonb)
       from (select row from nums where is_leaps order by score desc nulls last limit 150) x),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'ticker', g.ticker, 'callDollarFlow', g.call_flow, 'putDollarFlow', g.put_flow)), '[]'::jsonb)
       from (select ticker,
                    sum(case when cp = 'C' then flow else 0 end) as call_flow,
                    sum(case when cp = 'C' then 0 else flow end) as put_flow
               from nums group by ticker
              having sum(flow) > 0) g),
    coalesce(sum(case when cp = 'C' then volume else 0 end), 0),
    coalesce(sum(case when cp = 'C' then 0 else volume end), 0)
  into v_rows, v_leaps, v_flow, v_call, v_put
  from nums;

  select coalesce(jsonb_agg(x.s), '[]'::jsonb) into v_spreads
    from (
      select s
        from options_ticker_cache c
        cross join lateral jsonb_array_elements(coalesce(c.payload -> 'creditSpreads', '[]'::jsonb)) s
       order by case when jsonb_typeof(s -> 'returnOnRisk') = 'number' then (s ->> 'returnOnRisk')::numeric end desc nulls last
       limit 200
    ) x;

  select coalesce(jsonb_agg(x.d), '[]'::jsonb) into v_diag
    from (
      select d
        from options_ticker_cache c
        cross join lateral jsonb_array_elements(coalesce(c.payload -> 'diagonals', '[]'::jsonb)) d
       order by case when jsonb_typeof(d -> 'maxGainApprox') = 'number' then (d ->> 'maxGainApprox')::numeric end desc nulls last
       limit 100
    ) x;

  if v_call > 0 then
    v_ratio := round(v_put / v_call, 2);
    v_put_call := jsonb_build_object(
      'ratio', v_ratio,
      'sentiment', case when v_ratio < 0.7 then 'bullish' when v_ratio > 1.0 then 'bearish' else 'neutral' end,
      'totalCallVolume', v_call,
      'totalPutVolume', v_put
    );
  else
    v_put_call := 'null'::jsonb;
  end if;

  v_payload := jsonb_build_object(
    'rows', v_rows,
    'leapsRows', v_leaps,
    'creditSpreads', v_spreads,
    'diagonals', v_diag,
    'flowAggs', v_flow,
    'regime', coalesce(p_regime, 'null'::jsonb),
    'putCallRatio', v_put_call,
    'source', p_source,
    'scanned', p_scanned,
    'candidates', v_cands,
    'count', jsonb_array_length(v_rows),
    'errors', '[]'::jsonb,
    'cached', true,
    'cachedAt', to_char(coalesce(v_oldest, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'tickersCached', v_n
  );

  insert into options_aggregate_cache (id, payload, updated_at)
  values (true, v_payload, now())
  on conflict (id) do update set payload = excluded.payload, updated_at = excluded.updated_at;

  return jsonb_build_object('tickersCached', v_n, 'rows', jsonb_array_length(v_rows));
end;
$$;

-- Heavy compute that writes the shared cache: only the edge function's
-- service role should ever be able to call it, never anon/authenticated.
revoke all on function public.compute_options_aggregate(jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.compute_options_aggregate(jsonb, integer, text) to service_role;
