import type { OptionRow } from '@/lib/optionsMockData';
import type { FilterState } from '@/components/options/AdvancedFilters';

interface Options {
  // Cash-Secured Puts / Covered Calls deliberately want LOW delta (that's
  // the whole premise of selling premium out-of-the-money) and apply their
  // own strategy-appropriate delta band internally -- feeding them through
  // the global "min delta = higher probability" filter meant for the
  // directional screens (Scanner Table / Top-Scored Setups) intersects two
  // opposite-direction delta bands down to essentially nothing. Skip delta
  // here and let those components filter delta themselves.
  skipDelta?: boolean;
}

export function applyOptionFilters(rows: OptionRow[], filters: FilterState, options: Options = {}): OptionRow[] {
  return rows.filter(r => {
    if (r.score < filters.minScore) return false;
    if (r.ivRank > filters.maxIv) return false;
    if (r.voi < filters.minVoi) return false;
    if (r.dollarFlow < filters.minDollarFlow) return false;
    if (!options.skipDelta) {
      const ad = Math.abs(r.delta);
      if (ad < filters.deltaMin || ad > filters.deltaMax) return false;
    }
    if (filters.sector !== 'all' && r.sector !== filters.sector) return false;
    if (filters.search && !r.ticker.includes(filters.search)) return false;
    if (filters.expWindow !== 'all') {
      const dte = (new Date(r.expiration).getTime() - Date.now()) / 86400_000;
      if (filters.expWindow === 'week' && dte > 7) return false;
      if (filters.expWindow === 'month' && dte > 30) return false;
      if (filters.expWindow === 'quarter' && dte > 90) return false;
      if (filters.expWindow === 'leaps' && dte < 365) return false;
    }
    return true;
  });
}
