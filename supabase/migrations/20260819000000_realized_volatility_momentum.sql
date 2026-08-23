-- realized-volatility-scanner already pulls each tracked ticker's recent
-- price history into memory every run -- reusing that same fetch to also
-- store a simple price-change-over-the-window figure (not just volatility)
-- avoids a second data pull for the sector rotation screen, which needs
-- "is this stock's price trending down" per ticker to roll up into
-- "is this whole sector out of favor."
alter table public.realized_volatility
  add column if not exists price_change_pct numeric;
