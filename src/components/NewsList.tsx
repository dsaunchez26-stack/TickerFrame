import { Loader2 } from 'lucide-react';
import { useNews } from '@/hooks/useNews';

const ago = (unixSeconds: number) => {
  const mins = Math.max(0, Math.round((Date.now() / 1000 - unixSeconds) / 60));
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

// Headlines link out to the publisher; nothing from the articles is copied.
export const NewsList = ({ symbol, limit = 6, emptyText }: { symbol?: string | null; limit?: number; emptyText?: string }) => {
  const { data, isLoading, isError } = useNews(symbol);

  if (isLoading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (isError) return <p className="py-4 text-center text-xs text-muted-foreground">Headlines are unavailable right now. Try again in a few minutes.</p>;
  const items = (data ?? []).slice(0, limit);
  if (!items.length) return <p className="py-4 text-center text-xs text-muted-foreground">{emptyText ?? 'No recent headlines found.'}</p>;

  return (
    <div>
      <ul className="divide-y divide-border/50">
        {items.map((n) => (
          <li key={n.url} className="py-2">
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium leading-snug hover:underline">{n.headline}</a>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{[n.source, n.datetime ? ago(n.datetime) : ''].filter(Boolean).join(' · ')}</div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] italic text-muted-foreground/70">
        Headlines come from outside publishers and open on their sites. A headline appearing next to a stock doesn't mean it caused any price move.
      </p>
    </div>
  );
};
