import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { ValueRadarSubNav } from '@/components/ValueRadarSubNav';

interface Props {
  title: string;
  subtitle: string;
  scanning: boolean;
  onRefresh: () => void;
}

export const ValueRadarPageHeader = ({ title, subtitle, scanning, onRefresh }: Props) => (
  <div className="border-b border-border">
    <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <h1 className="truncate font-heading text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRefresh} disabled={scanning}>
        {scanning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
        Refresh scan
      </Button>
    </div>
    <div className="mx-auto max-w-7xl px-4">
      <ValueRadarSubNav />
    </div>
  </div>
);
