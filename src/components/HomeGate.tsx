import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';

const Landing = lazy(() => import('@/pages/Landing'));

// "/" is the landing page for visitors who are not signed in, and the app's
// home screen (the Assistant, inside the usual layout) for people who are.
const HomeGate = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return <Suspense fallback={null}><Landing /></Suspense>;
  }
  return <AppLayout />;
};

export default HomeGate;
