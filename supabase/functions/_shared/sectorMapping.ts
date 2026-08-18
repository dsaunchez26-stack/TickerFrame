// Deno-side port of src/lib/sectorMapping.ts (kept in sync manually -- no
// shared build step between the Vite app and edge functions). Finnhub's
// finnhubIndustry field (stored as-is in stock_fundamentals.sector) is
// granular; this maps it down to standard broad sector buckets with real
// peer counts for sector-relative scoring.
const INDUSTRY_TO_SECTOR: Record<string, string> = {
  'Technology': 'Technology',
  'Semiconductors': 'Technology',
  'Media': 'Communication Services',
  'Communications': 'Communication Services',
  'Financial Services': 'Financials',
  'Banking': 'Financials',
  'Health Care': 'Health Care',
  'Pharmaceuticals': 'Health Care',
  'Biotechnology': 'Health Care',
  'Real Estate': 'Real Estate',
  'Utilities': 'Utilities',
  'Energy': 'Energy',
  'Hotels, Restaurants & Leisure': 'Consumer Discretionary',
  'Automobiles': 'Consumer Discretionary',
  'Textiles, Apparel & Luxury Goods': 'Consumer Discretionary',
  'Retail': 'Consumer Discretionary',
  'Consumer products': 'Consumer Discretionary',
  'Beverages': 'Consumer Staples',
  'Tobacco': 'Consumer Staples',
  'Aerospace & Defense': 'Industrials',
  'Airlines': 'Industrials',
  'Electrical Equipment': 'Industrials',
  'Logistics & Transportation': 'Industrials',
  'Industrial Conglomerates': 'Industrials',
  'Road & Rail': 'Industrials',
};

const SYMBOL_OVERRIDES: Record<string, string> = {
  WMT: 'Consumer Staples',
  PG: 'Consumer Staples',
  KMB: 'Consumer Staples',
};

export function broadSector(symbol: string, rawIndustry: string | null): string {
  if (SYMBOL_OVERRIDES[symbol]) return SYMBOL_OVERRIDES[symbol];
  if (!rawIndustry) return 'Other';
  return INDUSTRY_TO_SECTOR[rawIndustry] ?? rawIndustry;
}
