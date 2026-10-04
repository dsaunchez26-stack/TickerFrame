-- signal_score: the composite technical score (-100..+100) behind the
-- buy/sell/hold label, so a "hold" can show how close it is to either side.
-- asset_class: lets ETFs standing in for bonds, gold, bitcoin and real estate
-- be grouped separately from individual equities.
alter table public.stock_cache add column if not exists signal_score integer;
alter table public.stock_cache add column if not exists asset_class text not null default 'Equity';
