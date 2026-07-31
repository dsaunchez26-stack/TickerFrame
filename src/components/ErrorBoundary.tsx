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

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
    void this.logToBackend(error, info);
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
