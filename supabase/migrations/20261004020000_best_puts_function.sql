-- One row per ticker: that ticker's highest-scoring put. Value Radar used to
-- download every options_ticker_cache payload (~10 MB compressed, tens of MB
-- as JSON) on every page view just to pick these out client-side, which was a
-- major egress source. Computing it here returns only ~one contract per
-- ticker. Runs as the caller (security invoker), so RLS applies as before.
create or replace function public.get_best_puts()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(b.row)
      from (
        select distinct on (r.value ->> 'ticker') r.value as row
        from options_ticker_cache c
        cross join lateral jsonb_array_elements(coalesce(c.payload -> 'rows', '[]'::jsonb)) r
        where r.value ->> 'cp' = 'P'
        order by r.value ->> 'ticker',
                 case when jsonb_typeof(r.value -> 'score') = 'number' then (r.value ->> 'score')::numeric end desc nulls last
      ) b
    ), '[]'::jsonb),
    'oldestScan', (select min(scanned_at) from options_ticker_cache)
  );
$$;

grant execute on function public.get_best_puts() to anon, authenticated, service_role;
