import { AlertTriangle } from 'lucide-react';

export interface IndexWarning {
  index: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

const SEVERITY_STYLES: Record<IndexWarning['severity'], string> = {
  low: 'border-signal-hold/30 bg-signal-hold/10 text-signal-hold',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-signal-sell/30 bg-signal-sell/10 text-signal-sell',
};

export const IndexEarlyWarning = ({ warnings }: { warnings: IndexWarning[] }) => {
  if (!warnings.length) return null;
  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${SEVERITY_STYLES[w.severity]}`}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-semibold">{w.index}</span>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
};
