-- MACD histogram (MACD minus its signal line): one of the inputs to the
-- composite signal score, stored so the UI can show the user the same
-- evidence the algorithm used rather than only its final verdict.
alter table public.stock_cache add column if not exists macd_histogram double precision;
