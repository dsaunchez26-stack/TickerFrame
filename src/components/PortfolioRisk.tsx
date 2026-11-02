import { useMemo, useState } from 'react';
import { Loader2, Info, ChevronDown } from 'lucide-react';
import { useHoldingClasses } from '@/hooks/useHoldingClasses';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBetas } from '@/hooks/useBetas';
import { adjustBeta, analyzePortfolio, groupRisk, observations, whatIfAdd, UNCLASSIFIED, DEFAULT_ERP_PCT, FALLBACK_RF_PCT, type RiskInput } from '@/lib/capm';

// The same menu is shown for every portfolio, so it describes how different kinds of holdings
// would change the numbers rather than picking anything for a particular person.
const ILLUSTRATION_FUNDS: Array<{ symbol: string; label: string }> = [
  { symbol: 'XLU', label: 'Utilities sector fund' },
  { symbol: 'XLP', label: 'Consumer staples sector fund' },
  { symbol: 'XLV', label: 'Health care sector fund' },
  { symbol: 'AGG', label: 'U.S. bond fund' },
  { symbol: 'GLD', label: 'Gold fund' },
  { symbol: 'VNQ', label: 'Real estate fund' },
  { symbol: 'SPY', label: 'S&P 500 fund' },
  { symbol: 'QQQ', label: 'Nasdaq-100 (tech-heavy) fund' },
];
const ILLUSTRATION_SHARE = 0.1; // an amount equal to 10% of the portfolio

interface Holding { symbol: string; quantity: number; currentPrice: number }

const store = (key: string, fallback: number) => {
  try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) && localStorage.getItem(key) !== null ? v : fallback; } catch { return fallback; }
};
const save = (key: string, v: number) => { try { localStorage.setItem(key, String(v)); } catch { /* ignore */ } };

const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
const signed = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;
const money = (v: number) => `$${Math.round(v).toLocaleString()}`;
const dPct = (d: number) => (Math.abs(d) < 0.05 ? '±0.0' : signed(d));

const Meter = ({ score }: { score: number }) => (
  <div>
    <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-signal-buy via-signal-hold to-signal-sell opacity-80">
      <div className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded bg-foreground shadow" style={{ left: `${score}%` }} />
    </div>
    <div className="mt-1 flex justify-between text-[9px] text-muted-foreground"><span>0 none</span><span>50 like the market</span><span>100 twice the market</span></div>
  </div>
);

// CAPM view of a portfolio: how sensitive it is to the market (beta, shown as a 0-100
// risk score), the return the model implies for that sensitivity, and how each holding
// moves both. A model estimate under stated assumptions - not a forecast or advice.
export const PortfolioRisk = ({ holdings }: { holdings: Holding[] }) => {
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { data, isLoading, isError } = useBetas(symbols);
  const [erp, setErp] = useState(() => store('tf_capm_erp', DEFAULT_ERP_PCT));
  const [rfOverride, setRfOverride] = useState<number | null>(() => (localStorage.getItem('tf_capm_rf') !== null ? store('tf_capm_rf', FALLBACK_RF_PCT) : null));
  const rf = rfOverride ?? data?.riskFree?.ratePct ?? FALLBACK_RF_PCT;

  const inputs: RiskInput[] = useMemo(
    () => holdings.map((h) => {
      const b = data?.betas?.[h.symbol.toUpperCase()];
      return { symbol: h.symbol, value: h.quantity * h.currentPrice, beta: b ? adjustBeta(b.beta) : null };
    }),
    [holdings, data],
  );
  const summary = useMemo(() => analyzePortfolio(inputs, rf, erp), [inputs, rf, erp]);

  // Sector or fund type of each holding, to show where the market risk is coming from.
  const { classes } = useHoldingClasses(symbols);
  const groups = useMemo(() => (summary ? groupRisk(summary, (sym) => classes.get(sym.toUpperCase())?.sector ?? UNCLASSIFIED) : []), [summary, classes]);
  const notes = useMemo(() => (summary ? observations(summary, groups) : []), [summary, groups]);

  // "How would other holdings change this?" - opens by itself when the mix looks concentrated or high-risk.
  const [learnOpen, setLearnOpen] = useState<boolean | null>(null);
  const showLearn = learnOpen ?? notes.length > 0;
  const funds = useBetas(ILLUSTRATION_FUNDS.map((f) => f.symbol), !!summary && showLearn);
  const illustrations = useMemo(() => {
    if (!summary) return [];
    return ILLUSTRATION_FUNDS.flatMap((f) => {
      const b = funds.data?.betas?.[f.symbol];
      if (!b) return [];
      const r = whatIfAdd(inputs, { symbol: f.symbol, beta: adjustBeta(b.beta), amount: summary.totalValue * ILLUSTRATION_SHARE }, rf, erp);
      return r ? [{ ...f, beta: adjustBeta(b.beta), after: r.after }] : [];
    });
  }, [summary, funds.data, inputs, rf, erp]);

  // what-if
  const [candSym, setCandSym] = useState('');
  const [candAmt, setCandAmt] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const cand = useBetas(submitted ? [submitted] : [], !!submitted);
  const candBeta = submitted ? cand.data?.betas?.[submitted] : undefined;
  const amount = Number(candAmt);
  const whatIf = useMemo(
    () => (submitted && candBeta && amount > 0 ? whatIfAdd(inputs, { symbol: submitted, beta: adjustBeta(candBeta.beta), amount }, rf, erp) : null),
    [inputs, submitted, candBeta, amount, rf, erp],
  );

  const symbolsMissing = data?.missing ?? [];

  return (
    <div className="mb-3 rounded-lg border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold">Market risk (CAPM)</h4>
        <span className="text-[10px] text-muted-foreground">Stocks and funds only</span>
      </div>

      {isLoading && <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
      {isError && <p className="py-3 text-center text-[11px] text-muted-foreground">Couldn't load market data to estimate risk right now. Try again in a few minutes.</p>}

      {!isLoading && !isError && !summary && (
        <p className="py-3 text-center text-[11px] text-muted-foreground">Not enough price history to estimate risk for these holdings{symbolsMissing.length ? ` (${symbolsMissing.join(', ')})` : ''}.</p>
      )}

      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 rounded-md border border-border/60 p-3 sm:col-span-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk score</div>
              <div className="flex items-baseline gap-1"><span className="font-heading text-3xl font-bold">{summary.score}</span><span className="text-xs text-muted-foreground">/ 100</span></div>
              <div className="text-[11px] text-muted-foreground">{summary.band}</div>
            </div>
            <div className="col-span-3 rounded-md border border-border/60 p-3 sm:col-span-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground" title="How much the whole portfolio tends to move when the S&P 500 moves">Portfolio beta</div>
                  <div className="font-heading text-lg font-bold">{summary.beta.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">S&P 500 move +1% → about {signed(summary.beta, 2)}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground" title="Risk-free rate + beta x market risk premium. A model assumption, not a forecast.">CAPM expected return</div>
                  <div className="font-heading text-lg font-bold">{pct(summary.expectedReturn)}<span className="text-[10px] font-normal text-muted-foreground"> / yr</span></div>
                  <div className="text-[10px] text-muted-foreground">market itself: {pct(summary.marketReturn)}</div>
                </div>
              </div>
            </div>
          </div>
          <Meter score={summary.score} />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-secondary/30 px-2 py-1.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Info className="h-3 w-3" />Assumptions you can change:</span>
            <label className="inline-flex items-center gap-1">Risk-free rate
              <Input type="number" step="0.1" value={Number(rf.toFixed(2))} onChange={(e) => { const v = Number(e.target.value); setRfOverride(v); save('tf_capm_rf', v); }} className="h-6 w-16 px-1 text-[10px]" />%
            </label>
            <label className="inline-flex items-center gap-1">Market premium
              <Input type="number" step="0.1" value={erp} onChange={(e) => { const v = Number(e.target.value); setErp(v); save('tf_capm_erp', v); }} className="h-6 w-16 px-1 text-[10px]" />%
            </label>
            <button className="underline hover:text-foreground" onClick={() => { setErp(DEFAULT_ERP_PCT); setRfOverride(null); try { localStorage.removeItem('tf_capm_rf'); localStorage.removeItem('tf_capm_erp'); } catch { /* ignore */ } }}>reset</button>
            <span>Risk-free = 10-year Treasury yield{data?.riskFree?.asOf && rfOverride === null ? ` (${data.riskFree.asOf})` : ''}.</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-2">Holding</th>
                  <th className="py-1.5 pr-2 text-right">Weight</th>
                  <th className="py-1.5 pr-2 text-right" title="Adjusted beta: 1.0 moves with the market">Beta</th>
                  <th className="py-1.5 pr-2 text-right" title="Risk-free rate + beta x market premium">Exp. return</th>
                  <th className="py-1.5 pr-2 text-right" title="Share of the portfolio's total market sensitivity this holding accounts for">Share of risk</th>
                  <th className="py-1.5 text-right" title="The portfolio's score and expected return if this holding were removed and the rest kept in proportion">Without it</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.symbol} className="border-b last:border-0 align-top">
                    <td className="py-1.5 pr-2 font-semibold">{r.symbol}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{pct(r.weight * 100, 0)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.beta.toFixed(2)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{pct(r.expectedReturn)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.riskShare == null ? '-' : pct(r.riskShare * 100, 0)}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {r.without ? (
                        <>
                          <div>score {r.without.score} <span className={r.without.score - summary.score < 0 ? 'text-signal-buy' : r.without.score - summary.score > 0 ? 'text-signal-sell' : ''}>({r.without.score === summary.score ? '±0' : signed(r.without.score - summary.score, 0)})</span></div>
                          <div>return {pct(r.without.expectedReturn)} <span>({dPct(r.without.expectedReturn - summary.expectedReturn)})</span></div>
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(summary.excluded.length > 0 || symbolsMissing.length > 0) && (
            <p className="text-[10px] text-muted-foreground">Left out (not enough price history for a beta): {[...new Set([...summary.excluded, ...symbolsMissing])].join(', ')}.</p>
          )}

          {groups.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold">Where the market risk comes from</div>
              <div className="space-y-1">
                {groups.slice(0, 6).map((g) => (
                  <div key={g.label} className="flex items-center gap-2 text-[11px]">
                    <span className="w-36 shrink-0 truncate text-muted-foreground" title={g.symbols.join(', ')}>{g.label}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${Math.max(0, g.weight * 100)}%` }} title="Share of portfolio value" />
                      {g.riskShare != null && <div className="absolute inset-y-0 left-0 border-r-2 border-signal-sell" style={{ width: `${Math.min(100, Math.max(0, g.riskShare * 100))}%` }} title="Share of market risk" />}
                    </div>
                    <span className="w-36 shrink-0 whitespace-nowrap text-right tabular-nums text-muted-foreground">{pct(g.weight * 100, 0)} value · {g.riskShare == null ? '-' : pct(g.riskShare * 100, 0)} risk</span>
                  </div>
                ))}
              </div>
              {groups.some((g) => g.label === UNCLASSIFIED) && <p className="mt-1 text-[10px] text-muted-foreground">"Not classified" is holdings whose company or fund type could not be looked up; they still count in the score above.</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">Filled bar = share of the portfolio's value; red mark = share of its market risk. When the red mark sits to the right of the bar's end, that group adds more market risk than its size alone.</p>
            </div>
          )}

          {notes.length > 0 && (
            <div className="space-y-1 rounded-md border border-border/60 bg-secondary/20 p-2">
              {notes.map((n) => <p key={n.key} className="text-[11px] text-muted-foreground">{n.text}</p>)}
            </div>
          )}

          <div className="rounded-md border border-border/60">
            <button className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[11px] font-semibold" onClick={() => setLearnOpen(!showLearn)} aria-expanded={showLearn}>
              <span>How different mixes change risk (education)</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showLearn ? 'rotate-180' : ''}`} />
            </button>
            {showLearn && (
              <div className="space-y-3 border-t border-border/60 p-2 text-[11px] text-muted-foreground">
                <ul className="ml-4 list-disc space-y-1">
                  <li><strong className="text-foreground">Concentration.</strong> When one sector is a large share, its swings drive the whole portfolio. Technology, for example, has historically moved more than the overall market (a beta above 1), so a tech-heavy portfolio has tended to swing more than the market.</li>
                  <li><strong className="text-foreground">Sectors behave differently.</strong> Defensive sectors such as utilities, consumer staples and health care have historically moved less than the market (lower beta), while cyclical sectors such as technology, consumer discretionary and energy have moved more. Bonds and gold have had their own, often lower, sensitivity to stocks. Past behavior can change.</li>
                  <li><strong className="text-foreground">Mixing holdings.</strong> Holdings that don't move in lockstep can smooth the ride. Beta only captures each holding's link to the market, not how holdings move relative to one another, so real diversification effects can be bigger or smaller than this model shows.</li>
                  <li><strong className="text-foreground">The trade-off.</strong> In CAPM, lower beta means a lower expected return. Taking on less market risk means accepting a lower modeled return, and where to land depends on someone's goals, time horizon and comfort with losses.</li>
                  <li><strong className="text-foreground">Funds versus single stocks.</strong> A sector or index fund holds dozens or hundreds of companies, which spreads out the company-specific risk of any one stock - risk that beta, and so this score, does not show.</li>
                </ul>
                <div>
                  <div className="mb-1 text-[11px] font-semibold text-foreground">Illustration: what the numbers would be with an amount equal to {Math.round(ILLUSTRATION_SHARE * 100)}% of this portfolio added in each of these</div>
                  {funds.isFetching && !illustrations.length ? (
                    <div className="flex items-center gap-2 py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading betas...</div>
                  ) : illustrations.length === 0 ? (
                    <p>Couldn't load fund betas right now.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead className="border-b text-left"><tr><th className="py-1 pr-2">Added</th><th className="py-1 pr-2 text-right">Its beta</th><th className="py-1 pr-2 text-right">Risk score</th><th className="py-1 text-right">Expected return</th></tr></thead>
                        <tbody>
                          {illustrations.map((it) => {
                            const ds = it.after.score - summary.score;
                            const dr = it.after.expectedReturn - summary.expectedReturn;
                            return (
                              <tr key={it.symbol} className="border-b last:border-0">
                                <td className="py-1 pr-2"><span className="font-semibold text-foreground">{it.symbol}</span> <span>{it.label}</span></td>
                                <td className="py-1 pr-2 text-right tabular-nums">{it.beta.toFixed(2)}</td>
                                <td className="py-1 pr-2 text-right tabular-nums">{it.after.score} <span className={ds < 0 ? 'text-signal-buy' : ds > 0 ? 'text-signal-sell' : ''}>({ds === 0 ? '±0' : signed(ds, 0)})</span></td>
                                <td className="py-1 text-right tabular-nums">{pct(it.after.expectedReturn)} <span>({dPct(dr)})</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-1 text-[10px]">The same list is shown for every portfolio. It illustrates how different kinds of holdings change the model's numbers; it is not a recommendation to buy or sell anything and is not tailored to anyone's situation. Use the box below to try any other ticker.</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md border border-border/60 p-2">
            <div className="mb-1.5 text-[11px] font-semibold">What would adding a stock or fund change?</div>
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); const s = candSym.trim().toUpperCase(); if (s && Number(candAmt) > 0) setSubmitted(s); }}>
              <Input placeholder="Ticker (e.g. VOO)" value={candSym} onChange={(e) => setCandSym(e.target.value.toUpperCase())} className="h-7 w-28 text-xs" />
              <Input placeholder={`$ amount (portfolio ${money(summary.totalValue)})`} type="number" value={candAmt} onChange={(e) => setCandAmt(e.target.value)} className="h-7 w-44 text-xs" />
              <Button type="submit" size="sm" className="h-7 text-xs">{cand.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Show effect'}</Button>
            </form>
            {submitted && !cand.isFetching && !candBeta && <p className="mt-1.5 text-[11px] text-muted-foreground">No beta available for {submitted} - check the ticker.</p>}
            {whatIf && (
              <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-3">
                <div className="rounded bg-secondary/30 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{whatIf.candidate.symbol} on its own</div>
                  <div>beta {whatIf.candidate.beta.toFixed(2)}</div>
                  <div>expected {pct(whatIf.candidate.expectedReturn)} / yr</div>
                  <div className="text-muted-foreground">{pct(whatIf.candidate.weightAfter * 100, 0)} of the new total</div>
                </div>
                <div className="rounded bg-secondary/30 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk score</div>
                  <div>{whatIf.before.score} → <strong>{whatIf.after.score}</strong> <span className={whatIf.after.score < whatIf.before.score ? 'text-signal-buy' : whatIf.after.score > whatIf.before.score ? 'text-signal-sell' : ''}>({whatIf.after.score === whatIf.before.score ? '±0' : signed(whatIf.after.score - whatIf.before.score, 0)})</span></div>
                  <div className="text-muted-foreground">beta {whatIf.before.beta.toFixed(2)} → {whatIf.after.beta.toFixed(2)}</div>
                </div>
                <div className="rounded bg-secondary/30 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Expected return</div>
                  <div>{pct(whatIf.before.expectedReturn)} → <strong>{pct(whatIf.after.expectedReturn)}</strong> <span>({dPct(whatIf.after.expectedReturn - whatIf.before.expectedReturn)})</span></div>
                  <div className="text-muted-foreground">per year, model estimate</div>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            How this works: beta measures how much a holding has moved with the S&P 500 over the past year (adjusted toward 1, as data vendors do). The portfolio's beta is the value-weighted average, the risk score is that beta on a 0-100 scale, and the expected return is the risk-free rate plus beta times the market premium (CAPM). It captures market-related risk only - not company-specific risk, which is large for a single stock - and a year of history is a short sample. It's a model estimate under the assumptions above, not a prediction of returns and not a recommendation. Options and futures positions are not included.
          </p>
        </div>
      )}
    </div>
  );
};
