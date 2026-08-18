import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy } from "react";
import { Outlet } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard.tsx";
import Auth from "./pages/Auth.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OptionsScanProvider } from "@/context/OptionsScanContext";
import { ValueRadarProvider } from "@/context/ValueRadarContext";
import { MarketChat } from "@/components/MarketChat";
// Heavy / less-frequently-hit pages are code-split to shrink first paint.
const Stocks = lazy(() => import("./pages/Stocks.tsx"));
const StocksChart = lazy(() => import("./pages/StocksChart.tsx"));
const StocksPenny = lazy(() => import("./pages/StocksPenny.tsx"));
const StocksSignals = lazy(() => import("./pages/StocksSignals.tsx"));
const Options = lazy(() => import("./pages/Options.tsx"));
const OptionsScanner = lazy(() => import("./pages/OptionsScanner.tsx"));
const OptionsIncome = lazy(() => import("./pages/OptionsIncome.tsx"));
const OptionsTracked = lazy(() => import("./pages/OptionsTracked.tsx"));
const OptionsFlowNews = lazy(() => import("./pages/OptionsFlowNews.tsx"));
const Futures = lazy(() => import("./pages/Futures.tsx"));
const RiskCalculator = lazy(() => import("./pages/RiskCalculator.tsx"));
const InsiderActivity = lazy(() => import("./pages/InsiderActivity.tsx"));
const DividendIncome = lazy(() => import("./pages/DividendIncome.tsx"));
const Calls = lazy(() => import("./pages/Calls.tsx"));
const Puts = lazy(() => import("./pages/Puts.tsx"));
const Patterns = lazy(() => import("./pages/Patterns.tsx"));
const ValueRadar = lazy(() => import("./pages/ValueRadar.tsx"));
const ValueRadarPriceToSales = lazy(() => import("./pages/ValueRadarPriceToSales.tsx"));
const ValueRadarShort = lazy(() => import("./pages/ValueRadarShort.tsx"));
const ValueRadarSmallCap = lazy(() => import("./pages/ValueRadarSmallCap.tsx"));
const News = lazy(() => import("./pages/News.tsx"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage.tsx"));
const Performance = lazy(() => import("./pages/Performance.tsx"));
const Legal = lazy(() => import("./pages/Legal.tsx"));
const Methodology = lazy(() => import("./pages/Methodology.tsx"));
const Health = lazy(() => import("./pages/Health.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
    Loading…
  </div>
);

// Every options-related page (Overview, Scanner, Income, Tracked, Flow &
// News, Calls, Puts) shares one options-scanner fetch through this provider
// instead of each independently re-scanning on mount.
const OptionsScanLayout = () => (
  <OptionsScanProvider>
    <Outlet />
  </OptionsScanProvider>
);

// MarketChat renders as a floating widget (bottom-right), not inline page
// content -- mounting it once here instead of on every stocks sub-page keeps
// its conversation alive while navigating between them.
const StocksLayout = () => (
  <>
    <Outlet />
    <MarketChat />
  </>
);

// Every Value Radar sub-page (Quality Screen, Price-to-Sales, Short
// Candidates) shares one fundamentals/technicals/options fetch through this
// provider instead of each independently re-scanning on mount.
const ValueRadarLayout = () => (
  <ValueRadarProvider>
    <Outlet />
  </ValueRadarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public auth routes — must sit OUTSIDE AppLayout so they don't require a session */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/legal" element={<AppLayout />}>
              <Route index element={<Legal />} />
            </Route>
            <Route path="/methodology" element={<AppLayout />}>
              <Route index element={<Methodology />} />
            </Route>

            {/* Everything else requires a signed-in user */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route element={<StocksLayout />}>
                <Route path="/stocks" element={<Stocks />} />
                <Route path="/stocks/chart" element={<StocksChart />} />
                <Route path="/stocks/penny" element={<StocksPenny />} />
                <Route path="/stocks/signals" element={<StocksSignals />} />
              </Route>
              <Route element={<OptionsScanLayout />}>
                <Route path="/calls" element={<Calls />} />
                <Route path="/puts" element={<Puts />} />
                <Route path="/options" element={<Options />} />
                <Route path="/options/scanner" element={<OptionsScanner />} />
                <Route path="/options/income" element={<OptionsIncome />} />
                <Route path="/options/tracked" element={<OptionsTracked />} />
                <Route path="/options/flow-news" element={<OptionsFlowNews />} />
              </Route>
              <Route path="/patterns" element={<Patterns />} />
              <Route path="/futures" element={<Futures />} />
              <Route path="/tools/risk-calculator" element={<RiskCalculator />} />
              <Route path="/insider-activity" element={<InsiderActivity />} />
              <Route path="/dividend-income" element={<DividendIncome />} />
              <Route element={<ValueRadarLayout />}>
                <Route path="/value-radar" element={<ValueRadar />} />
                <Route path="/value-radar/price-to-sales" element={<ValueRadarPriceToSales />} />
                <Route path="/value-radar/short-candidates" element={<ValueRadarShort />} />
                <Route path="/value-radar/small-cap" element={<ValueRadarSmallCap />} />
              </Route>
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/news" element={<News />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/health" element={<ProtectedRoute requireAdmin><Health /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
