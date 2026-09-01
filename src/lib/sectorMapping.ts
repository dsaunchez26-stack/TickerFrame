// Finnhub's finnhubIndustry field (stored as-is in stock_fundamentals.sector)
// is granular -- dozens of distinct labels across our ~114 tracked stocks,
// many represented by just 1-2 names. That's too thin a sample to compare a
// stock's valuation against meaningfully, so this maps it down to standard
// broad sector buckets with real peer counts.
const INDUSTRY_TO_SECTOR: Record<string, string> = {
  'Technology': 'Technology',
  'Semiconductors': 'Technology',
  'Media': 'Communication Services',
  'Communications': 'Communication Services',
  'Telecommunication': 'Communication Services',
  'Financial Services': 'Financials',
  'Banking': 'Financials',
  'Insurance': 'Financials',
  'Health Care': 'Health Care',
  'Pharmaceuticals': 'Health Care',
  'Biotechnology': 'Health Care',
  'Life Sciences Tools & Services': 'Health Care',
  'Real Estate': 'Real Estate',
  'Utilities': 'Utilities',
  'Energy': 'Energy',
  'Hotels, Restaurants & Leisure': 'Consumer Discretionary',
  'Automobiles': 'Consumer Discretionary',
  'Auto Components': 'Consumer Discretionary',
  'Textiles, Apparel & Luxury Goods': 'Consumer Discretionary',
  'Retail': 'Consumer Discretionary',
  'Consumer products': 'Consumer Discretionary',
  'Beverages': 'Consumer Staples',
  'Tobacco': 'Consumer Staples',
  'Food Products': 'Consumer Staples',
  'Aerospace & Defense': 'Industrials',
  'Airlines': 'Industrials',
  'Electrical Equipment': 'Industrials',
  'Logistics & Transportation': 'Industrials',
  'Industrial Conglomerates': 'Industrials',
  'Road & Rail': 'Industrials',
  'Machinery': 'Industrials',
  'Construction': 'Industrials',
  'Professional Services': 'Industrials',
  'Commercial Services & Supplies': 'Industrials',
  // Round-2 universe expansion (Aug 2026) added real materials/mining/
  // chemicals/packaging names for the first time -- this bucket didn't
  // exist before because nothing tracked needed it.
  'Metals & Mining': 'Materials',
  'Chemicals': 'Materials',
  'Packaging': 'Materials',
};

// A few well-known symbols where Finnhub's raw industry tag doesn't match
// standard GICS classification closely enough to trust -- e.g. Walmart's
// "Retail" tag would otherwise get lumped in with Amazon/Target
// (discretionary) even though Walmart is a staples retailer by GICS.
const SYMBOL_OVERRIDES: Record<string, string> = {
  WMT: 'Consumer Staples',
  PG: 'Consumer Staples',
  KMB: 'Consumer Staples',
};

export function broadSector(symbol: string, rawIndustry: string | null): string {
  if (SYMBOL_OVERRIDES[symbol]) return SYMBOL_OVERRIDES[symbol];
  if (!rawIndustry) return 'Other';
  return INDUSTRY_TO_SECTOR[rawIndustry] ?? rawIndustry; // unmapped label -- still better than nothing
}
