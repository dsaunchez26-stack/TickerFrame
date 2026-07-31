import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const PORTFOLIO_NAMES = ['Portfolio A', 'Portfolio B'];

interface Props {
  tracked: boolean;
  onTrack: (portfolioName: string | null) => void;
  className?: string;
}

export const TrackButton = ({ tracked, onTrack, className }: Props) => {
  if (tracked) {
    return (
      <Button size="sm" variant="secondary" className={className ?? 'h-6 px-2 text-[10px]'} disabled>
        <Check className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className={className ?? 'h-6 px-2 text-[10px]'}>
          <Plus className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PORTFOLIO_NAMES.map(name => (
          <DropdownMenuItem key={name} onClick={() => onTrack(name)}>
            Add to {name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => onTrack(null)}>Just track (no portfolio)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
