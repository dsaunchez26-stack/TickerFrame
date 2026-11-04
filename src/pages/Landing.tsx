import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DotField } from '@/components/landing/DotField';
import { Counter, Reveal, useScrollProgress } from '@/components/landing/motion';
import { useAuth } from '@/hooks/useAuth';
import { BULLISH_AT } from '@/lib/signalBreakdown';
import './landing.css';

// The demo needs a full page load (it switches the data layer on at startup), so it is a plain link.
const DEMO_HREF = '/?demo=1';

const MARQUEE = [
  'Plain-English readings', 'Candles or a simple line', 'Live headlines', 'Portfolio risk score',
  'Trend', 'Momentum', 'Stretch', 'A handbook for every term', 'Tested in public', 'An assistant that answers from the data',
];

const spotlight = (e: MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
};

const Nav = ({ signedIn }: { signedIn: boolean }) => {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-colors ${stuck ? 'border-b border-border bg-[#090b0a]/95' : 'border-b border-transparent'}`}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link to="/welcome" className="text-sm font-semibold tracking-tight">Tickerframe</Link>
        <nav className="hidden items-center gap-7 text-xs text-muted-foreground md:flex">
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#readings" className="transition-colors hover:text-foreground">Readings</a>
          <a href="#honest" className="transition-colors hover:text-foreground">Honest by design</a>
          <Link to="/handbook" className="transition-colors hover:text-foreground">Handbook</Link>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link to="/" className="lp-btn inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">Open the app</Link>
          ) : (
            <>
              <Link to="/auth" className="px-2 text-xs text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
              <a href={DEMO_HREF} className="lp-btn inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">Try the demo</a>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

const Hero = ({ signedIn }: { signedIn: boolean }) => (
  <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-14">
    <div className="lp-grid pointer-events-none absolute inset-0" />
    <DotField className="absolute inset-0 h-full w-full" />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#090b0a] to-transparent" />
    <div className="relative mx-auto w-full max-w-6xl px-5 py-16">
      <p className="lp-eyebrow lp-fade">Market research for everyone</p>
      <h1 className="lp-h1 mt-5">
        <span className="lp-line"><span className="lp-accent">Simplified</span></span>
        <span className="lp-line"><span>trading.</span></span>
      </h1>
      <p className="lp-fade mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg" style={{ animationDelay: '0.8s' }}>
        Live prices, readings in plain English and the evidence behind them, so anyone can understand the market before they trade it.
      </p>
      <div className="lp-fade mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '1s' }}>
        {signedIn ? (
          <Link to="/" className="lp-btn inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">Open the app <ArrowRight className="h-4 w-4" /></Link>
        ) : (
          <>
            <a href={DEMO_HREF} className="lp-btn inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">Try the live demo <ArrowRight className="h-4 w-4" /></a>
            <Link to="/auth" className="lp-btn inline-flex h-11 items-center rounded-md border border-border bg-[#090b0a]/60 px-6 text-sm font-medium transition-colors hover:border-primary/50">Create an account</Link>
          </>
        )}
      </div>
      <p className="lp-fade mt-6 text-[11px] text-faint" style={{ animationDelay: '1.2s' }}>
        Tickerframe is a research tool, not a broker. Research and education only; not investment advice.
      </p>
    </div>
  </section>
);

const Marquee = () => (
  <div className="border-y border-border py-3.5" aria-hidden="true">
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div className="lp-marquee text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {[0, 1].map((n) => (
          <div key={n} className="flex shrink-0 items-center">
            {MARQUEE.map((m) => (
              <span key={m + n} className="flex items-center">
                <span className="px-6">{m}</span><span className="h-1 w-1 rounded-full bg-primary/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ---- Pillar playground: the same three-question scoring the app uses (-6..+6, bullish at +4). ----

const PILLARS = [
  { key: 'trend', name: 'Trend', q: 'Is the price rising or falling?', opts: ['Falling', 'Flat', 'Rising'] },
  { key: 'momentum', name: 'Momentum', q: 'Are gains building or fading?', opts: ['Fading', 'Steady', 'Building'] },
  { key: 'stretch', name: 'Stretch', q: 'Has it run too far, too fast?', opts: ['Overbought', 'Normal', 'Oversold'] },
] as const;

const Illustration = ({ k }: { k: (typeof PILLARS)[number]['key'] }) => {
  if (k === 'trend') {
    return (
      <svg viewBox="0 0 120 48" className="h-12 w-full" fill="none" aria-hidden="true">
        <path d="M2 34 C30 30 50 24 118 22" stroke="hsl(var(--faint))" strokeWidth="1" strokeDasharray="3 3" />
        <path className="lp-draw" d="M2 40 L18 30 L32 34 L48 22 L62 26 L80 14 L96 18 L118 6" stroke="hsl(var(--primary))" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  if (k === 'momentum') {
    return (
      <svg viewBox="0 0 120 48" className="h-12 w-full" aria-hidden="true">
        {[8, 20, 32, 44, 56, 68, 80, 92, 104].map((x, i) => (
          <rect key={x} className="lp-bar" x={x} y="6" width="7" height="36" rx="1.5" fill="hsl(var(--primary))" opacity={0.35 + i * 0.07} style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 48" className="h-12 w-full" fill="none" aria-hidden="true">
      <path d="M2 10 H118 M2 38 H118" stroke="hsl(var(--faint))" strokeWidth="1" strokeDasharray="3 3" />
      <path className="lp-draw" d="M2 30 C20 28 34 22 52 20 S86 14 108 10" stroke="hsl(var(--primary))" strokeWidth="1.75" strokeLinecap="round" />
      <circle className="lp-pulse" cx="108" cy="10" r="2.5" fill="hsl(var(--primary))" />
      <circle cx="108" cy="10" r="2.5" fill="hsl(var(--primary))" />
    </svg>
  );
};

const READINGS: Record<'bullish' | 'neutral' | 'bearish', { label: string; tone: string; text: string }> = {
  bullish: { label: 'Bullish', tone: 'text-signal-buy', text: 'Most of the evidence leans up right now. That describes the recent pattern, it does not predict what comes next.' },
  neutral: { label: 'Neutral', tone: 'text-signal-hold', text: 'The signals disagree or sit in the middle, so there is no clear lean either way.' },
  bearish: { label: 'Bearish', tone: 'text-signal-sell', text: 'Most of the evidence leans down right now. That describes the recent pattern, it does not predict what comes next.' },
};

const Playground = () => {
  const [pts, setPts] = useState<[number, number, number]>([2, 0, 0]);
  const total = pts[0] + pts[1] + pts[2];
  const score = Math.round((total / 6) * 100);
  const kind = total >= BULLISH_AT ? 'bullish' : total <= -BULLISH_AT ? 'bearish' : 'neutral';
  const r = READINGS[kind];
  const set = (i: number, v: number) => setPts((p) => p.map((x, j) => (j === i ? v : x)) as [number, number, number]);

  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-[1.4fr_1fr]">
      <div className="bg-[#0b0e0c] p-5 sm:p-6">
        <p className="lp-eyebrow mb-4">Try it: set the three answers</p>
        <div className="space-y-5">
          {PILLARS.map((p, i) => (
            <div key={p.key} className="grid items-center gap-3 sm:grid-cols-[7.5rem_1fr]">
              <div className="hidden sm:block"><Illustration k={p.key} /></div>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-[11px] text-muted-foreground">{p.q}</span>
                </div>
                <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={p.name}>
                  {p.opts.map((o, n) => {
                    const v = (n - 1) * 2;
                    const on = pts[i] === v;
                    return (
                      <button
                        key={o} type="button" role="radio" aria-checked={on}
                        onClick={() => set(i, v)}
                        className={`h-8 rounded-sm border text-xs transition-colors ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                      >{o}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-between bg-[#0d100e] p-5 sm:p-6">
        <div>
          <p className="lp-eyebrow mb-3">The reading</p>
          <div className={`text-4xl font-medium tracking-tight transition-colors sm:text-5xl ${r.tone}`}>{r.label}</div>
          <div className="mt-1 text-sm tabular-nums text-muted-foreground">{score > 0 ? '+' : ''}{score} on the site's scale of -100 to +100</div>
          <div className="relative mt-5 h-1 rounded-full bg-border">
            <div className="absolute top-1/2 h-3 w-1.5 -translate-y-1/2 rounded-sm bg-foreground transition-all duration-500" style={{ left: `calc(${(score + 100) / 2}% - 3px)` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-faint"><span>Bearish</span><span>Neutral</span><span>Bullish</span></div>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
      </div>
    </div>
  );
};

const FEATURES = [
  { t: 'Candles, or a simple line', d: 'Switch between candlesticks and a clean line on any stock. Real exchange bars, labelled as what they are.' },
  { t: 'Headlines with every stock', d: 'The news that is moving a company sits next to its chart, not in another tab.' },
  { t: 'A portfolio risk score', d: 'See how a portfolio moves with the market on a 0 to 100 scale, and what adding one more holding would change.' },
  { t: 'An assistant that answers from the data', d: 'Ask about a ticker, a sector or a term. Answers come from the numbers on the site, not guesses.' },
  { t: 'A handbook for every term', d: 'RSI, beta, MACD, expiration: each one explained in everyday language, with no jargon left hanging.' },
  { t: 'Stocks, ETFs, options and futures', d: 'One place to look things up, with the same plain readings everywhere.' },
];

const STEPS = [
  { n: '01', t: 'Look it up', d: 'Search any ticker. You get the price, a chart and the news on one screen.' },
  { n: '02', t: 'Read it in plain English', d: 'Three questions (trend, momentum, stretch) roll up into one reading you can follow in a sentence.' },
  { n: '03', t: 'Check the evidence', d: 'Every reading links to its reasoning, and the methodology and test results are public.' },
];

// A mock-up (not live data) that fills in as the visitor scrolls through the three steps.
const ExampleCard = ({ p }: { p: number }) => {
  const stage = (from: number) => ({ opacity: p >= from ? 1 : 0.18, transform: p >= from ? 'none' : 'translateY(8px)', transition: 'opacity 0.5s, transform 0.5s' });
  return (
    <div className="overflow-hidden rounded-md border border-border bg-[#0b0e0c]" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-faint">
        <span>Example</span><span>Illustration, not live data</span>
      </div>
      <div className="space-y-5 p-5">
        <div className="flex h-9 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">
          <span className="mr-2 text-primary">/</span>Look up a ticker<span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground" />
        </div>
        <div style={stage(0.12)}>
          <svg viewBox="0 0 300 90" className="h-24 w-full" fill="none">
            <path d="M0 62 C60 58 120 50 300 40" stroke="hsl(var(--faint))" strokeDasharray="3 3" />
            <path d="M0 74 L25 60 L50 66 L75 48 L100 56 L125 38 L150 46 L175 30 L200 38 L225 22 L250 28 L275 14 L300 20" stroke="hsl(var(--primary))" strokeWidth="1.75" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={stage(0.45)}>
          <p className="text-base font-medium leading-snug">This stock is above its recent average, and its momentum is building.</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span className="status-dot text-signal-buy">Trend</span>
            <span className="status-dot text-signal-buy">Momentum</span>
            <span className="status-dot text-signal-hold">Stretch</span>
          </div>
        </div>
        <div style={stage(0.78)} className="border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          <span className="text-foreground">See why:</span> price above its 20-day average · MACD positive · RSI in the normal range. The rule and its test results are public.
        </div>
      </div>
    </div>
  );
};

const HowItWorks = () => {
  const [ref, p] = useScrollProgress<HTMLDivElement>();
  return (
    <div ref={ref} className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
      <ol className="relative space-y-14 pl-10 sm:pl-14">
        <span className="lp-track absolute bottom-2 left-[11px] top-2 w-px sm:left-[15px]" style={{ ['--p' as string]: `${Math.round(p * 100)}%` }} aria-hidden="true" />
        {STEPS.map((s, i) => (
          <Reveal as="li" key={s.n} delay={i * 80} className="relative">
            <span className="absolute -left-10 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-[#090b0a] text-[10px] tabular-nums text-primary sm:-left-14 sm:h-8 sm:w-8 sm:text-xs">{s.n}</span>
            <h3 className="text-xl font-medium tracking-tight sm:text-2xl">{s.t}</h3>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </Reveal>
        ))}
      </ol>
      <div className="lg:sticky lg:top-24"><ExampleCard p={p} /></div>
    </div>
  );
};

const Landing = () => {
  const { user } = useAuth();
  const signedIn = !!user;

  useEffect(() => {
    const prev = document.title;
    document.title = 'Tickerframe: Simplified trading research';
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="lp min-h-screen">
      <Nav signedIn={signedIn} />
      <Hero signedIn={signedIn} />
      <Marquee />

      <section id="readings" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24 sm:py-32">
        <Reveal><p className="lp-eyebrow">One reading, three questions</p></Reveal>
        <Reveal delay={60}><h2 className="mt-3 max-w-3xl text-3xl font-medium tracking-tight sm:text-5xl">Every reading comes down to three plain questions.</h2></Reveal>
        <Reveal delay={120}><p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">No black box. Set the answers yourself and watch the reading change. It is the same rule the site applies to every stock.</p></Reveal>
        <Reveal delay={160} className="mt-10"><Playground /></Reveal>
      </section>

      <section id="how" className="relative scroll-mt-16 border-t border-border">
        <div className="lp-dotted pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <Reveal><p className="lp-eyebrow">How it works</p></Reveal>
          <Reveal delay={60}><h2 className="mt-3 max-w-3xl text-3xl font-medium tracking-tight sm:text-5xl">From a ticker to an answer in three steps.</h2></Reveal>
          <HowItWorks />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
        <Reveal><p className="lp-eyebrow">What you get</p></Reveal>
        <Reveal delay={60}><h2 className="mt-3 max-w-3xl text-3xl font-medium tracking-tight sm:text-5xl">The tools of a trading desk, in everyday language.</h2></Reveal>
        <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={(i % 3) * 80} className="bg-[#0b0e0c]">
              <div className="lp-tile h-full border border-transparent bg-[#0b0e0c] p-6" onMouseMove={spotlight}>
                <div className="mb-8 h-px w-8 bg-primary" />
                <h3 className="text-base font-medium tracking-tight">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="honest" className="relative scroll-mt-16 overflow-hidden border-t border-border">
        <div className="lp-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <Reveal><p className="lp-eyebrow">Honest by design</p></Reveal>
          <Reveal delay={60}><h2 className="mt-3 max-w-4xl text-3xl font-medium tracking-tight sm:text-5xl">We test our own readings, and publish the result, even when it is not flattering.</h2></Reveal>
          <Reveal delay={120}><p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">Most tools promise an edge. We ran our signals over five years of daily prices and report what we found, including that the technical readings did not reliably predict returns. They describe the market's recent behaviour in plain terms; they are not a forecast.</p></Reveal>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {[
              { n: 780, s: '+', l: 'stocks and funds read every trading day' },
              { n: 5, s: ' years', l: 'of daily prices behind our published tests' },
              { n: 3, s: '', l: 'questions behind every reading, never a hidden score' },
            ].map((c, i) => (
              <Reveal key={c.l} delay={i * 100}>
                <div className="border-t border-border pt-5">
                  <div className="text-5xl font-medium tracking-tight text-primary sm:text-6xl"><Counter to={c.n} suffix={c.s} /></div>
                  <p className="mt-3 max-w-[16rem] text-sm text-muted-foreground">{c.l}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200} className="mt-12">
            <Link to="/methodology" className="lp-btn inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">Read the methodology and test results <ArrowRight className="h-4 w-4" /></Link>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border">
        <DotField className="absolute inset-0 h-full w-full" spacing={18} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#090b0a] via-transparent to-[#090b0a]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_45%_at_50%_50%,rgba(9,11,10,0.85),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-28 text-center sm:py-40">
          <Reveal><h2 className="mx-auto max-w-3xl text-4xl font-medium tracking-tight sm:text-6xl">Understand the market first. Then decide.</h2></Reveal>
          <Reveal delay={100}><p className="mx-auto mt-5 max-w-md text-sm text-muted-foreground">Open the demo in one click. It runs on saved real data and needs no sign-up.</p></Reveal>
          <Reveal delay={180} className="mt-8 flex flex-wrap justify-center gap-3">
            {signedIn ? (
              <Link to="/" className="lp-btn inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">Open the app <ArrowRight className="h-4 w-4" /></Link>
            ) : (
              <>
                <a href={DEMO_HREF} className="lp-btn inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">Try the live demo <ArrowRight className="h-4 w-4" /></a>
                <Link to="/auth" className="lp-btn inline-flex h-11 items-center rounded-md border border-border bg-[#090b0a]/70 px-6 text-sm font-medium transition-colors hover:border-primary/50">Create an account</Link>
              </>
            )}
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm font-semibold tracking-tight">Tickerframe</span>
            <nav className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <Link to="/methodology" className="hover:text-foreground">How readings are generated</Link>
              <Link to="/handbook" className="hover:text-foreground">Handbook</Link>
              <Link to="/terms" className="hover:text-foreground">Terms</Link>
              <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link to="/legal" className="hover:text-foreground">Disclaimers</Link>
            </nav>
          </div>
          <p className="mt-6 max-w-3xl text-[11px] leading-relaxed text-faint">
            Research and education only. Tickerframe is not a broker-dealer or investment adviser, does not execute trades, and nothing here is a recommendation or solicitation to buy or sell any security. Readings describe recent price behaviour and do not predict future results. Data may be delayed or inaccurate.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
