// The 50 largest S&P 500 companies by market value, as of October 2026 --
// the household names most investors recognize and follow. Cross-checked
// across two S&P 500 market-cap rankings (they agree on 49 of the 50; the
// last slots near the cutoff trade places day to day). Excludes companies
// that are large but not S&P 500 members (e.g. TSMC, Toyota, ASML, SpaceX)
// and counts Alphabet once (GOOGL). Order within this list is only a
// fallback: the page ranks by each company's live market cap.
export const SP500_TOP50: string[] = [
  'NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'AVGO', 'TSLA', 'MU', 'LLY',
  'BRK.B', 'AMD', 'JPM', 'WMT', 'XOM', 'V', 'JNJ', 'INTC', 'MA', 'ABBV',
  'PLTR', 'CSCO', 'LRCX', 'ORCL', 'AMAT', 'CVX', 'COST', 'CAT', 'BAC', 'KO',
  'DELL', 'MRK', 'PG', 'UNH', 'PANW', 'GE', 'MS', 'PM', 'HD', 'NFLX',
  'GEV', 'GS', 'TXN', 'RTX', 'WFC', 'TMO', 'LIN', 'C', 'IBM', 'AXP',
];
