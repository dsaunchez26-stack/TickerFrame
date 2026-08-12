import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';
import { OptionRiskMath } from '@/components/tools/OptionRiskMath';

interface Props {
  ticker: string;
  cp: 'C' | 'P';
  strike: number;
  spot: number;
  /** Best available cost estimate for this contract -- ask price preferred, falling back to last/mid. */
  premium: number;
  expiration: string;
}

// Opens the risk/payoff calculator pre-filled for this exact contract,
// right from the row it's already listed in, instead of sending the user to
// the standalone Risk Calculator page to re-look-up the same ticker/strike.
export const OptionRiskDialogButton = ({ ticker, cp, strike, spot, premium, expiration }: Props) => {
  if (!(premium > 0) || !(strike > 0)) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Calculate risk & profit for this contract">
          <Calculator className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{ticker} ${strike}{cp === 'C' ? ' Call' : ' Put'} · Risk Calculator</DialogTitle>
        </DialogHeader>
        <OptionRiskMath ticker={ticker} cp={cp} strike={strike} spot={spot} premium={premium} expiration={expiration} />
      </DialogContent>
    </Dialog>
  );
};
