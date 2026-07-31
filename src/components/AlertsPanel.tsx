import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Bell, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStockDetail } from '@/context/StockDetailContext';

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommended_action: string | null;
  triggered_at: string;
  acknowledged: boolean;
  priority_filer: string | null;
}

const sevStyles: Record<Alert['severity'], string> = {
  critical: 'border-signal-sell/50 bg-signal-sell/5 text-signal-sell',
  high: 'border-signal-sell/40 bg-signal-sell/5 text-signal-sell',
  medium: 'border-signal-hold/40 bg-signal-hold/5 text-signal-hold',
  low: 'border-border bg-card text-muted-foreground',
};

export const AlertsPanel = () => {
  const qc = useQueryClient();
  const { open } = useStockDetail();

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('triggered_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Alert[];
    },
    refetchInterval: 60_000,
  });

  const ack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alerts').update({ acknowledged: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const ackAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('alerts').update({ acknowledged: true }).eq('acknowledged', false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  if (isLoading) return null;
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Alerts</h3>
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            {alerts.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => ackAll.mutate()} disabled={ackAll.isPending}>
          <Check className="mr-1 h-3 w-3" /> Clear all
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-border">
        {[...alerts].sort((x, y) => {
          const px = x.priority_filer ? 1 : 0;
          const py = y.priority_filer ? 1 : 0;
          if (px !== py) return py - px;
          return new Date(y.triggered_at).getTime() - new Date(x.triggered_at).getTime();
        }).map(a => (
          <div
            key={a.id}
            className={`group flex items-start gap-2 border-l-2 px-4 py-2.5 text-xs ${sevStyles[a.severity]} cursor-pointer hover:bg-secondary/40 transition-colors`}
            onClick={() => open(a.symbol)}
            title="Click for deep analysis"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-foreground">{a.symbol}</span>
                {a.priority_filer && (
                  <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                    {a.priority_filer.split(' ')[0]} {a.priority_filer.split(' ')[1] ?? ''}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wider opacity-70">{a.alert_type.replace(/_/g, ' ')}</span>
                <span className="ml-auto text-[10px] opacity-60">
                  {new Date(a.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-0.5 text-foreground/90">{a.description}</p>
              {a.recommended_action && (
                <p className="mt-0.5 text-[11px] italic opacity-80">→ {a.recommended_action}</p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); ack.mutate(a.id); }}
              className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-destructive/10 hover:text-destructive transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
