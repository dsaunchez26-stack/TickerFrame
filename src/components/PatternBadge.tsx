import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getPatternMeta } from '@/lib/patterns';

interface Props {
  pattern?: string | null;
  confidence?: number;
  size?: 'xs' | 'sm';
  className?: string;
}

export const PatternBadge = ({ pattern, confidence, size = 'sm', className = '' }: Props) => {
  const meta = getPatternMeta(pattern);
  if (!meta) return null;
  const Icon = meta.icon;
  const colorClass =
    meta.bias === 'bullish' ? 'border-transparent bg-transparent px-0 text-signal-buy'
    : meta.bias === 'bearish' ? 'border-transparent bg-transparent px-0 text-signal-sell'
    : 'border-transparent bg-transparent px-0 text-muted-foreground';
  const sizeClass = size === 'xs' ? 'text-[9px] gap-0.5 px-1.5 py-0' : 'text-[10px] gap-1 px-2 py-0.5';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`${colorClass} ${sizeClass} ${className} font-medium whitespace-nowrap cursor-help`}>
          <Icon className="h-3 w-3" />
          {meta.label}
          {confidence ? <span className="opacity-70">· {confidence}%</span> : null}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="max-w-xs">
          <div className="font-semibold">{meta.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
          <div className="text-xs mt-1">Bias: <span className="font-semibold capitalize">{meta.bias}</span>{confidence ? ` · Confidence ${confidence}%` : ''}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
