import { useRef, useState } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  // Signing in lands on the landing page, even if the visitor was bounced to
  // the login page from a deeper link. A brand-new account goes straight to
  // the dashboard. (The ref is set before sign-up so the redirect below sees
  // it even when the session appears before the request finishes.)
  const justSignedUp = useRef(false);
  const HOME = justSignedUp.current ? '/dashboard' : '/welcome';

  const [mode, setMode] = useState<'signin' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  if (!authLoading && user) return <Navigate to={HOME} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (resetMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: 'Check your email', description: 'If an account exists, a reset link is on its way.' });
        setResetMode(false);
        return;
      }
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Welcome back' });
        navigate(HOME, { replace: true });
      } else {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        justSignedUp.current = true;
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName || email.split('@')[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast({ title: 'Account created' });
          navigate('/dashboard', { replace: true });
        } else {
          toast({ title: 'Account created', description: 'Check your email to verify your address, then sign in.' });
          justSignedUp.current = false;
          setMode('signin');
        }
      }
    } catch (err) {
      justSignedUp.current = false;
      toast({
        title: 'Authentication failed',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Tickerframe</h1>
          <p className="text-sm text-muted-foreground">Professional trading research and signals.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {resetMode ? 'Reset your password' : mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!resetMode && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'signin' | 'signup')}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {!resetMode && mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </div>
              {!resetMode && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === 'signin' && (
                      <button type="button" onClick={() => setResetMode(true)} className="text-xs text-primary hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {resetMode ? 'Send reset link' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
              {resetMode && (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setResetMode(false)}>
                  Back to sign in
                </Button>
              )}
            </form>

          </CardContent>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground px-4">
          By creating an account you agree to our <Link to="/terms" className="underline">Terms of Use</Link>, <Link to="/privacy" className="underline">Privacy Policy</Link> and <Link to="/legal" className="underline">Disclaimers</Link>.
          Tickerframe is research and education only - not investment advice.
        </p>
      </div>
    </div>
  );
}
