import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import type { EarningsInfo } from '@/hooks/useEarningsCalendar';

interface Props {
  earnings: EarningsInfo | null | undefined;
  /** An option's expiration date, if this badge is for a specific contract
   * rather than the underlying stock -- changes both the threshold and the
   * message, since "earnings land before this contract expires" is a much
   * sharper warning than "earnings are coming up sometime." */
  referenceDate?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

const hourLabel = (hour: string | null) =>
  hour === 'bmo' ? 'before market open' : hour === 'amc' ? 'after market close' : hour === 'dmh' ? 'during market hours' : null;

const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Real earnings-date awareness -- every other "earnings" indicator this app
// ever had (EarningsCalendar's mock dates, OptionRow.earningsInDays) was
// either fake or hardcoded null. This reads from the real SEC/Finnhub-backed
// earnings_calendar table via useEarningsCalendar.
export const EarningsBadge = ({ earnings, referenceDate, size = 'sm', className = '' }: Props) => {
  if (!earnings) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const earningsDate = new Date(earnings.date + 'T00:00:00');
  const daysUntil = Math.round((earningsDate.getTime() - today.getTime()) / 86400_000);
  if (daysUntil < 0) return null; // stale row, next real date not fetched yet

  let urgent: boolean;
  let label: string;
  let tooltip: string;

  if (referenceDate) {
    const ref = new Date(referenceDate + 'T00:00:00');
    const beforeExpiration = earningsDate <= ref;
    if (beforeExpiration) {
      urgent = true;
      label = daysUntil === 0 ? 'Earnings today — before exp.' : `Earnings in ${daysUntil}d — before exp.`;
      tooltip = `${fmtDate(earnings.date)}${hourLabel(earnings.hour) ? ` (${hourLabel(earnings.hour)})` : ''} — this contract is still open when the company reports. Earnings moves can be large in either direction and often overwhelm whatever the chart or the Greeks suggested going in.`;
    } else if (daysUntil <= 21) {
      urgent = false;
      label = `Earnings ${fmtDate(earnings.date)} (after exp.)`;
      tooltip = `${fmtDate(earnings.date)}${hourLabel(earnings.hour) ? ` (${hourLabel(earnings.hour)})` : ''} — after this contract's expiration, so it won't be open for the earnings reaction itself.`;
    } else {
      return null;
    }
  } else {
    if (daysUntil > 21) return null;
    urgent = daysUntil <= 7;
    label = daysUntil === 0 ? 'Earnings today' : `Earnings in ${daysUntil}d`;
    tooltip = `${fmtDate(earnings.date)}${hourLabel(earnings.hour) ? ` (${hourLabel(earnings.hour)})` : ''} — earnings reactions can move a stock (and anything derived from it) sharply in either direction.`;
  }

  const colorClass = urgent ? 'bg-signal-sell/15 text-signal-sell border-signal-sell/30' : 'bg-signal-hold/15 text-signal-hold border-signal-hold/30';
  const sizeClass = size === 'xs' ? 'text-[9px] gap-0.5 px-1.5 py-0' : 'text-[10px] gap-1 px-2 py-0.5';
  const Icon = urgent ? AlertTriangle : CalendarClock;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`${colorClass} ${sizeClass} ${className} font-semibold whitespace-nowrap cursor-help`}>
          <Icon className="h-3 w-3" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent><div className="max-w-xs text-xs">{tooltip}</div></TooltipContent>
    </Tooltip>
  );
};
