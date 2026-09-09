import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  error: Error | null;
}

// Every lazy-loaded route chunk is fetched by its build-hashed filename
// (e.g. Chat-Bavllo4Y.js). When a new deploy goes out, those hashes change
// -- a tab that's been open since before the deploy still has the OLD
// hashes baked into its bundle, so navigating to a not-yet-visited route
// tries to fetch a chunk that no longer exists on the CDN and throws
// exactly this message (confirmed the real, recurring cause of every
// production error_logs entry to date, not a one-off). There's only one
// possible fix -- reload to pick up the new index.html's current chunk
// map -- so this recovers automatically instead of showing an error card
// the user has to click through. Guarded by a per-session flag so a
// genuinely broken deploy can't reload-loop forever; it degrades to the
// normal error card if reloading once didn't help.
const CHUNK_LOAD_ERROR_PATTERN = /Failed to fetch dynamically imported module|error loading dynamically imported module/i;
const CHUNK_RELOAD_FLAG = 'tf_chunk_reload_attempted';

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  componentDidMount() {
    // A clean mount means whatever the reload flag was guarding against is
    // over -- clear it so a genuinely new, later stale-chunk incident (the
    // next deploy, still the same tab) gets its own fresh auto-reload
    // instead of being silently blocked by a flag from a past, unrelated
    // recovery.
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
    void this.logToBackend(error, info);

    if (CHUNK_LOAD_ERROR_PATTERN.test(error.message) && !sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
      sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
      window.location.reload();
    }
  }

  private async logToBackend(error: Error, info: ErrorInfo) {
    try {
      const { data } = await supabase.auth.getUser();
      await supabase.from('error_logs').insert({
        user_id: data.user?.id ?? null,
        message: (error.message || 'unknown').slice(0, 500),
        stack: (error.stack || '').slice(0, 4000),
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
        context: { componentStack: (info.componentStack || '').slice(0, 2000) },
      });
    } catch {
      /* swallow — logging is best-effort */
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h2 className="mb-1 font-heading text-base font-bold">Something went wrong</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {this.state.error.message || 'An unexpected error occurred rendering this view.'}
          </p>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={this.reset}>Try again</Button>
            <Button size="sm" onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </div>
      </div>
    );
  }
}
