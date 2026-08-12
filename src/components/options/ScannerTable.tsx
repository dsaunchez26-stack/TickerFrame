import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import type { OptionRow } from '@/lib/optionsMockData';
import { TrackButton } from '@/components/options/TrackButton';
import { useStockDetail } from '@/context/StockDetailContext';
import { OptionRiskDialogButton } from '@/components/tools/OptionRiskDialogButton';
import { EarningsBadge } from '@/components/EarningsBadge';
import { useEarningsCalendar } from '@/hooks/useEarningsCalendar';

const INITIAL = 20;
const STEP = 20;

interface Props {
  rows: OptionRow[];
  trackedIds: Set<string>;
  onTrack: (row: OptionRow, portfolioName: string | null) => void;
}

type SortKey = 'score' | 'ticker' | 'stockPrice' | 'strike' | 'expiration' | 'price' | 'bid' | 'ask' | 'delta' | 'ivRank' | 'voi' | 'expectedMovePct' | 'oneDayExpectedMovePct';

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'score', label: 'Score' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'stockPrice', label: 'Stock' },
  { key: 'strike', label: 'Strike' },
  { key: 'expiration', label: 'Exp' },
  { key: 'price', label: 'Premium' },
  { key: 'bid', label: 'Bid' },
  { key: 'ask', label: 'Ask' },
  { key: 'delta', label: 'Δ' },
  { key: 'ivRank', label: 'IV Rank' },
  { key: 'voi', label: 'V/OI' },
  { key: 'expectedMovePct', label: 'Exp. Move' },
  { key: 'oneDayExpectedMovePct', label: '1-Day Move' },
];

export const ScannerTable = ({ rows, trackedIds, onTrack }: Props) => {
  const { open } = useStockDetail();
  const { earningsBySymbol } = useEarningsCalendar();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visible, setVisible] = useState(INITIAL);

  // A new scan/filter result set should start back at the top page, not
  // silently keep whatever "show more" depth was reached on the last one.
  useEffect(() => { setVisible(INITIAL); }, [rows]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number ?? 0) - (bv as number ?? 0)) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const shown = sortedRows.slice(0, visible);
  const hasMore = visible < sortedRows.length;
  const canCollapse = visible > INITIAL;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">Scanner Results ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} className="py-2 pr-3">
                    <button
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortKey === col.key && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                ))}
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const tracked = trackedIds.has(r.id);
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-bold text-primary">{r.score}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => open(r.ticker)} className="font-semibold hover:text-primary hover:underline">{r.ticker}</button>
                        <EarningsBadge earnings={earningsBySymbol.get(r.ticker)} referenceDate={r.expiration} size="xs" />
                      </div>
                    </td>
                    <td className="py-2 pr-3">${r.stockPrice.toFixed(2)}</td>
                    <td className="py-2 pr-3">{r.cp}{r.strike}</td>
                    <td className="py-2 pr-3">{r.expiration}</td>
                    <td className="py-2 pr-3">${r.price.toFixed(2)}</td>
                    <td className="py-2 pr-3">${r.bid.toFixed(2)}</td>
                    <td className="py-2 pr-3">${r.ask.toFixed(2)}</td>
                    <td className="py-2 pr-3">{r.delta.toFixed(2)}</td>
                    <td className="py-2 pr-3">{r.ivRank}</td>
                    <td className="py-2 pr-3">{r.voi.toFixed(2)}</td>
                    <td className="py-2 pr-3">{r.expectedMovePct != null ? `±${r.expectedMovePct.toFixed(1)}%` : '—'}</td>
                    <td className="py-2 pr-3">{r.oneDayExpectedMovePct != null ? `±${r.oneDayExpectedMovePct.toFixed(2)}%` : '—'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1">
                        <OptionRiskDialogButton
                          ticker={r.ticker}
                          cp={r.cp}
                          strike={r.strike}
                          spot={r.stockPrice}
                          premium={r.ask > 0 ? r.ask : r.price}
                          expiration={r.expiration}
                        />
                        <TrackButton tracked={tracked} onTrack={(portfolioName) => onTrack(r, portfolioName)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-6 text-center text-muted-foreground">No contracts match the current filters.</p>}
        </div>
        {(hasMore || canCollapse) && (
          <div className="mt-3 flex items-center justify-center gap-2">
            {hasMore && (
              <Button size="sm" variant="outline" onClick={() => setVisible(v => v + STEP)} className="h-7 text-xs">
                <ChevronDown className="h-3 w-3 mr-1" /> Show {Math.min(STEP, sortedRows.length - visible)} more · {sortedRows.length - visible} hidden
              </Button>
            )}
            {canCollapse && <Button size="sm" variant="ghost" onClick={() => setVisible(INITIAL)} className="h-7 text-xs">Show less</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
