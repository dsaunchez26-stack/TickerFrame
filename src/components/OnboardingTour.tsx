import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, LineChart, ListFilter, Briefcase, BookOpen, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const RESHOW_AFTER_DAYS = 14;

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to Tickerframe',
    body: "A research dashboard for stocks, options, and futures - real data, transparent scoring, no hype. This is the Assistant, your home screen: search a ticker or ask it a question any time.",
  },
  {
    icon: LineChart,
    title: 'Signals are a real, simple rule',
    body: 'Buy/sell/hold comes from one technical rule - RSI plus MACD confirmation - not a black box. Balance Sheet and Growth scores compare a stock to its own sector\'s peers, not one flat cutoff for the whole market.',
  },
  {
    icon: ListFilter,
    title: 'Options, futures, and screens',
    body: 'The Options tab scans calls, puts, and income strategies against live chains. Research has focused screens - Small-Cap Value, Sector Rotation, Insider Activity - each with its own filters.',
  },
  {
    icon: Briefcase,
    title: 'Track it and get alerted',
    body: 'Add real positions on the Portfolio page to see live P&L and a concentration rating. Turn on Slack alerts in Settings for insider buys, target/stop hits, and big moves.',
  },
  {
    icon: BookOpen,
    title: 'Not sure what a term means?',
    body: 'Every signal, score, and term on the site is defined in the Handbook (under Settings) - what RSI actually measures, how IV Rank works, what a Balance Sheet Score is built from. And on pages like Options, click the chat bubble for quick explanations.',
  },
  {
    icon: ShieldAlert,
    title: 'Research only',
    body: 'Tickerframe is not investment advice, and it\'s not a registered adviser or broker-dealer. Quotes may be delayed. Always verify before trading - see Disclaimers & Terms for the full picture.',
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const checkedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || checkedRef.current === user.id) return;
    checkedRef.current = user.id;

    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from('user_onboarding_state')
        .select('last_seen_at, dismissed_forever')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      const shouldShow = !row
        || (!row.dismissed_forever && daysSince(row.last_seen_at) >= RESHOW_AFTER_DAYS);

      // Record this visit regardless of whether the tour actually shows --
      // the next check needs the gap measured from THIS visit, not a stale
      // one from weeks ago.
      await supabase.from('user_onboarding_state').upsert(
        { user_id: user.id, last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

      if (shouldShow && !cancelled) {
        setStep(0);
        setOpen(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const close = () => setOpen(false);

  const dismissForever = async () => {
    if (user) {
      await supabase.from('user_onboarding_state').upsert(
        { user_id: user.id, last_seen_at: new Date().toISOString(), dismissed_forever: true },
        { onConflict: 'user_id' },
      );
    }
    setOpen(false);
  };

  const finish = async () => {
    if (user) {
      await supabase.from('user_onboarding_state').upsert(
        { user_id: user.id, last_seen_at: new Date().toISOString(), completed_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    }
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
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" size="sm" onClick={close}>Skip</Button>
            {isLast ? (
              <Button size="sm" onClick={finish}>Get started</Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)}>Next</Button>
            )}
          </div>
          <button
            type="button"
            onClick={dismissForever}
            className="text-center text-[11px] text-muted-foreground underline hover:text-foreground"
          >
            Don't show this again
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}
