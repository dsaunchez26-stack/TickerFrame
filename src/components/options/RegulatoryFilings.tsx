import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type InsiderRow = Database['public']['Tables']['insider_activity']['Row'];

const fmtDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-');

// Real SEC EDGAR data, not a stub -- this is the same insider_activity
// table the Insider Activity page reads, filtered to just the Schedule
// 13D/13G (new 5%+ holder) filings so this card has something genuinely
// "regulatory" to show instead of duplicating that page's Form 4 buys.
export const RegulatoryFilings = () => {
  const [rows, setRows] = useState<InsiderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('insider_activity')
      .select('*')
      .like('form_type', 'SCHEDULE%')
      .order('filing_date', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Regulatory Filings</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
            <FileText className="h-6 w-6" />
            <p>No recent 13D/13G filings on tracked tickers yet. Try a scan from the <Link to="/insider-activity" className="underline hover:text-foreground">Insider Activity</Link> page.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <a
                key={r.id}
                href={r.filing_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/40"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="font-semibold">{r.ticker}</span>
                  <span className="truncate text-muted-foreground">{r.filer_name}</span>
                  <span className="shrink-0 text-muted-foreground">{r.form_type}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  {fmtDate(r.filing_date)}
                  <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            ))}
            <Link to="/insider-activity" className="block pt-1 text-center text-[11px] text-muted-foreground underline hover:text-foreground">
              See all insider activity
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
