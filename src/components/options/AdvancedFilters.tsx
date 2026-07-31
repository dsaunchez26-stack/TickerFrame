import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface FilterState {
  minScore: number;
  maxIv: number;
  minVoi: number;
  minDollarFlow: number;
  deltaMin: number;
  deltaMax: number;
  sector: string;
  search: string;
  expWindow: 'all' | 'week' | 'month' | 'quarter' | 'leaps';
}

// deltaMin defaults to 0.35 (rather than 0, fully unfiltered) so the picks
// shown out of the box aren't dominated by far-OTM, sub-5%-odds contracts
// that only score well because cheap lottery-ticket strikes attract
// disproportionate volume/dollar-flow relative to their real odds of
// profit. Users can still drop it back to 0 to see everything.
export const defaultFilters: FilterState = {
  minScore: 0,
  maxIv: 100,
  minVoi: 0,
  minDollarFlow: 0,
  deltaMin: 0.35,
  deltaMax: 1,
  sector: 'all',
  search: '',
  expWindow: 'all',
};

interface Props {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  sectors: string[];
}

export const AdvancedFilters = ({ filters, setFilters, sectors }: Props) => (
  <Card>
    <CardContent className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
      <div className="space-y-1">
        <Label className="text-[10px]">Ticker search</Label>
        <Input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value.toUpperCase() })} placeholder="e.g. NVDA" className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Min score</Label>
        <Input type="number" value={filters.minScore} onChange={e => setFilters({ ...filters, minScore: Number(e.target.value) || 0 })} className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Max IV rank</Label>
        <Input type="number" value={filters.maxIv} onChange={e => setFilters({ ...filters, maxIv: Number(e.target.value) || 0 })} className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Min V/OI</Label>
        <Input type="number" step="0.1" value={filters.minVoi} onChange={e => setFilters({ ...filters, minVoi: Number(e.target.value) || 0 })} className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Min $ flow</Label>
        <Input type="number" value={filters.minDollarFlow} onChange={e => setFilters({ ...filters, minDollarFlow: Number(e.target.value) || 0 })} className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Min |Δ| (higher = more likely ITM)</Label>
        <Input
          type="number" step="0.05" min={0} max={1}
          value={filters.deltaMin}
          onChange={e => setFilters({ ...filters, deltaMin: Math.min(Math.max(Number(e.target.value) || 0, 0), 1) })}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Max |Δ|</Label>
        <Input
          type="number" step="0.05" min={0} max={1}
          value={filters.deltaMax}
          onChange={e => setFilters({ ...filters, deltaMax: Math.min(Math.max(Number(e.target.value) || 1, 0), 1) })}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Sector</Label>
        <Select value={filters.sector} onValueChange={v => setFilters({ ...filters, sector: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All sectors</SelectItem>
            {sectors.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Expiration window</Label>
        <Select value={filters.expWindow} onValueChange={v => setFilters({ ...filters, expWindow: v as FilterState['expWindow'] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All</SelectItem>
            <SelectItem value="week" className="text-xs">This week</SelectItem>
            <SelectItem value="month" className="text-xs">This month</SelectItem>
            <SelectItem value="quarter" className="text-xs">This quarter</SelectItem>
            <SelectItem value="leaps" className="text-xs">LEAPS</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CardContent>
  </Card>
);
