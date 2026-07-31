import { Card } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-heading text-lg font-bold">{title}</h2>
    <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const Legal = () => (
  <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
        <ShieldAlert className="h-5 w-5 text-amber-400" />
      </div>
      <div>
        <h1 className="font-heading text-2xl font-bold">Disclaimers & Terms</h1>
        <p className="text-xs text-muted-foreground mt-1">Last updated {new Date().toLocaleDateString()}</p>
      </div>
    </div>

    <Card className="p-5 border-amber-500/30 bg-amber-500/5">
      <p className="text-sm text-amber-200">
        <strong className="text-amber-300">Tickerframe is a research and education tool, not a registered investment adviser, broker-dealer, or financial planner.</strong>{' '}
        Nothing on this site is a personal recommendation, solicitation, or offer to buy or sell any security, derivative, or other financial instrument.
      </p>
    </Card>

    <Card className="p-5 space-y-6">
      <Section title="No Investment Advice">
        <p>All signals, scores, patterns, alerts, commentary, and analytics are produced by automated software for informational and educational purposes only. They reflect the output of statistical models on publicly available data and do not consider your personal financial situation, risk tolerance, investment objectives, or tax circumstances.</p>
        <p>Always conduct your own due diligence and consult a licensed financial professional before making any investment decision.</p>
      </Section>

      <Section title="Risk of Loss">
        <p>Trading stocks, options, and other securities involves substantial risk. You can lose all or more than the capital you commit. Options in particular can expire worthless and may carry unlimited theoretical loss on certain strategies. Past performance — including any track record, win rate, expectancy, or backtest shown on this site — is not indicative of future results.</p>
      </Section>

      <Section title="Data Sources & Accuracy">
        <p>Market data is aggregated from third-party providers (including but not limited to Alpha Vantage, Finnhub, Tradier, SEC EDGAR, FINRA, FRED, and CBOE). Data may be delayed, incomplete, inaccurate, or temporarily unavailable. We make no warranty as to the accuracy, timeliness, or completeness of any information presented.</p>
        <p>Where a value is unknown, it is shown as "n/a" or marked "[STALE]". Backtested or simulated results are explicitly labeled and should not be interpreted as live trading results.</p>
      </Section>

      <Section title="Forward-Looking Statements">
        <p>Targets, scores, expectancies, and projections are statistical estimates only. No outcome is guaranteed. The actual return on any trade depends on market conditions, execution slippage, commissions, taxes, and many factors outside our control.</p>
      </Section>

      <Section title="No Fiduciary Relationship">
        <p>Your use of this site does not create an advisor-client, fiduciary, or any other professional relationship between you and Tickerframe, its operators, or its affiliates.</p>
      </Section>

      <Section title="Affiliate & Position Disclosure">
        <p>The operators of this site may hold positions in any of the securities mentioned at any time, with no obligation to disclose. Signals shown to users may have already been acted upon by the operators.</p>
      </Section>

      <Section title="Acceptable Use">
        <p>You agree not to scrape, redistribute, resell, or reverse-engineer the data, signals, or models on this site, and not to use the service for any unlawful purpose.</p>
      </Section>

      <Section title="Limitation of Liability">
        <p>To the maximum extent permitted by law, Tickerframe and its operators shall not be liable for any direct, indirect, incidental, consequential, special, or punitive damages — including loss of profits, data, or trading capital — arising out of or in connection with your use of, or inability to use, this service, even if advised of the possibility of such damages.</p>
      </Section>

      <Section title="Changes">
        <p>We may update these terms at any time. Continued use of the service after changes constitutes acceptance.</p>
      </Section>

      <Section title="Contact">
        <p>For questions about these disclaimers, contact the site operator through the contact channel published on the home page.</p>
      </Section>
    </Card>

    <p className="text-[11px] text-muted-foreground text-center">
      By using Tickerframe you acknowledge that you have read, understood, and agreed to these terms.
    </p>
  </div>
);

export default Legal;
