import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Settings {
  slack_webhook_url: string;
  alerts_insider: boolean;
  alerts_target_stop: boolean;
  alerts_value_ideas: boolean;
  alerts_big_move: boolean;
  alerts_pattern: boolean;
  alerts_earnings: boolean;
}

const DEFAULTS: Settings = {
  slack_webhook_url: '',
  alerts_insider: true,
  alerts_target_stop: true,
  alerts_value_ideas: true,
  alerts_big_move: true,
  alerts_pattern: true,
  alerts_earnings: true,
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_notification_settings')
      .select('slack_webhook_url, alerts_insider, alerts_target_stop, alerts_value_ideas, alerts_big_move, alerts_pattern, alerts_earnings')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettings({
            slack_webhook_url: data.slack_webhook_url ?? '',
            alerts_insider: data.alerts_insider,
            alerts_target_stop: data.alerts_target_stop,
            alerts_value_ideas: data.alerts_value_ideas,
            alerts_big_move: data.alerts_big_move,
            alerts_pattern: data.alerts_pattern,
            alerts_earnings: data.alerts_earnings,
          });
        }
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('user_notification_settings').upsert({
      user_id: user.id,
      slack_webhook_url: settings.slack_webhook_url.trim() || null,
      alerts_insider: settings.alerts_insider,
      alerts_target_stop: settings.alerts_target_stop,
      alerts_value_ideas: settings.alerts_value_ideas,
      alerts_big_move: settings.alerts_big_move,
      alerts_pattern: settings.alerts_pattern,
      alerts_earnings: settings.alerts_earnings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Notification settings saved' });
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div>
          <h1 className="font-heading text-lg font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground">Configure Slack alerts for your portfolio.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Slack Alerts</CardTitle>
            <CardDescription className="text-xs">
              Checked every 30 minutes during market hours. Requires a Slack Incoming Webhook URL —
              in Slack, go to your workspace's <strong>Apps → Incoming Webhooks → Add to Slack</strong>,
              pick a channel (or DM to yourself), and paste the generated URL below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="webhook" className="text-xs">Slack Webhook URL</Label>
              <Input
                id="webhook"
                type="url"
                placeholder="https://hooks.slack.com/services/…"
                value={settings.slack_webhook_url}
                onChange={e => setSettings(s => ({ ...s, slack_webhook_url: e.target.value }))}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="insider" className="text-xs">Insider buy alerts</Label>
                <p className="text-[11px] text-muted-foreground">Notify when an officer/director/10%+ owner buys shares in a stock you hold.</p>
              </div>
              <Switch id="insider" checked={settings.alerts_insider} onCheckedChange={v => setSettings(s => ({ ...s, alerts_insider: v }))} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="targetstop" className="text-xs">Target / stop-loss alerts</Label>
                <p className="text-[11px] text-muted-foreground">Notify when a position crosses the gain target or stop-loss you set on it.</p>
              </div>
              <Switch id="targetstop" checked={settings.alerts_target_stop} onCheckedChange={v => setSettings(s => ({ ...s, alerts_target_stop: v }))} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ideas" className="text-xs">Small-cap value ideas</Label>
                <p className="text-[11px] text-muted-foreground">Notify when a new stock scores 65+ on the Small-Cap Value screen (weekly, per idea).</p>
              </div>
              <Switch id="ideas" checked={settings.alerts_value_ideas} onCheckedChange={v => setSettings(s => ({ ...s, alerts_value_ideas: v }))} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="bigmove" className="text-xs">Big price moves</Label>
                <p className="text-[11px] text-muted-foreground">Notify when a stock you hold moves ±6% or more in a day — so a big swing doesn't go unnoticed.</p>
              </div>
              <Switch id="bigmove" checked={settings.alerts_big_move} onCheckedChange={v => setSettings(s => ({ ...s, alerts_big_move: v }))} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="pattern" className="text-xs">Chart pattern alerts</Label>
                <p className="text-[11px] text-muted-foreground">Notify when a bullish or bearish chart pattern (breakout, flag, etc.) is detected on a tracked holding.</p>
              </div>
              <Switch id="pattern" checked={settings.alerts_pattern} onCheckedChange={v => setSettings(s => ({ ...s, alerts_pattern: v }))} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="earnings" className="text-xs">Upcoming earnings</Label>
                <p className="text-[11px] text-muted-foreground">Notify when a stock you hold reports earnings within the next 3 days.</p>
              </div>
              <Switch id="earnings" checked={settings.alerts_earnings} onCheckedChange={v => setSettings(s => ({ ...s, alerts_earnings: v }))} />
            </div>

            <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SettingsPage;
