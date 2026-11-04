import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, ShieldAlert } from 'lucide-react';

interface Props {
  pnlPct: number;
  targetGainPct: number | null;
  stopLossPct: number | null;
  size?: 'xs' | 'sm';
}

// Purely mechanical: the user sets their own target/stop percentages, this
// only flags when the position's actual P/L has crossed whichever ones they
// set. It never picks or suggests a number, and it's a visual flag shown
// when you load this page -- not a push/email/SMS alert, since nothing in
// this app can reach you when it's closed.
export const PositionAlertBadge = ({ pnlPct, targetGainPct, stopLossPct, size = 'sm' }: Props) => {
  const hitTarget = targetGainPct !== null && targetGainPct > 0 && pnlPct >= targetGainPct;
  const hitStop = stopLossPct !== null && stopLossPct > 0 && pnlPct <= -stopLossPct;

  if (!hitTarget && !hitStop) return null;

  const sizeClass = size === 'xs' ? 'text-[9px] gap-0.5 px-1.5 py-0' : 'text-[10px] gap-1 px-2 py-0.5';

  return (
    <>
      {hitTarget && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`border-transparent bg-transparent px-0 text-signal-buy ${sizeClass} font-medium whitespace-nowrap cursor-help`}>
              <Target className="h-3 w-3" />
              Target hit: {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(0)}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs text-xs">
              You set a target of +{targetGainPct}% on this position, and it's currently at {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%.
              This is just flagging that your own threshold was crossed - not a suggestion to sell.
            </div>
          </TooltipContent>
        </Tooltip>
      )}
      {hitStop && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`border-transparent bg-transparent px-0 text-signal-sell ${sizeClass} font-medium whitespace-nowrap cursor-help`}>
              <ShieldAlert className="h-3 w-3" />
              Stop level hit: {pnlPct.toFixed(0)}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs text-xs">
              You set a stop level of -{stopLossPct}% on this position, and it's currently at {pnlPct.toFixed(1)}%.
              This is just flagging that your own threshold was crossed - not a suggestion to sell.
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
};
