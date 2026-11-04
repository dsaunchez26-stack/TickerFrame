import { AlertTriangle } from 'lucide-react';

export const Disclaimer = ({ compact = false }: { compact?: boolean }) => (
  <div className={`flex items-start gap-2 border-l-2 border-border ${compact ? 'py-1 pl-2 text-[10px]' : 'py-1 pl-3 text-[11px]'} text-muted-foreground`}>
    <AlertTriangle className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} mt-0.5 flex-shrink-0 text-faint`} />
    <div>
      <strong className="font-medium text-foreground">Research & education only.</strong>{' '}
      This is not financial advice, a recommendation, or a solicitation to buy or sell any security or derivative.
      Options trading involves substantial risk of loss and is not suitable for every investor.
      Past performance - including any track record shown on this site - does not guarantee future results.
      Do your own research and consult a licensed advisor before trading.
    </div>
  </div>
);
