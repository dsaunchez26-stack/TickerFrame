import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Activity, Zap, TrendingUp, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY = 'pp_onboarding_v1_done';

const STEPS = [
  { icon: Activity, title: 'Welcome to Tickerframe', body: 'A research dashboard for stocks and options — real data, transparent scoring, no hype.' },
  { icon: Zap, title: 'Scanners rank the best picks first', body: 'The Stocks and Options tabs surface high-confidence picks at the top. Use "Show more" to load additional signals in batches.' },
  { icon: TrendingUp, title: 'Every signal is tracked', body: 'The Performance tab logs entries, stops, and targets so you can see how the system actually does — no cherry-picking.' },
  { icon: ShieldAlert, title: 'Research only', body: 'Tickerframe is not investment advice. Quotes may be delayed. Always verify before trading.' },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch { /* localStorage disabled */ }
  }, [user]);

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center">{current.title}</DialogTitle>
          <DialogDescription className="text-center">{current.body}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1 py-2">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i === step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={close}>Skip</Button>
          {isLast ? (
            <Button size="sm" onClick={close}>Get started</Button>
          ) : (
            <Button size="sm" onClick={() => setStep(s => s + 1)}>Next</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
