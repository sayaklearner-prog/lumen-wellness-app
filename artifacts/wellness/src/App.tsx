import { Suspense, lazy, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shell } from "@/components/layout/shell";
import { OnboardingGate } from "@/components/onboarding-gate";
import { LoadingState } from "@/components/loading-state";
import LandingPage from "@/pages/landing";
import { OnboardingModal } from "@/components/onboarding-modal";

// Lazy load pages for code splitting
const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Coach = lazy(() => import("@/pages/coach"));
const Nutrition = lazy(() => import("@/pages/nutrition"));
const Planner = lazy(() => import("@/pages/planner"));
const Reports = lazy(() => import("@/pages/reports"));
const Activity = lazy(() => import("@/pages/activity"));
const Sleep = lazy(() => import("@/pages/sleep"));
const ScreenTime = lazy(() => import("@/pages/screen-time"));
const Glucose = lazy(() => import("@/pages/glucose"));
const Connections = lazy(() => import("@/pages/connections"));
const Badges = lazy(() => import("@/pages/badges"));
const Settings = lazy(() => import("@/pages/settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes stale time for better performance
      gcTime: 30 * 60 * 1000, // 30 minutes garbage collection time
    },
  },
});

function OnboardingPage() {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-3xl font-black text-slate-100">Welcome to Lumen Health OS</h1>
        <p className="text-slate-400">Complete your profile to build your dynamic health dashboard.</p>
        <OnboardingModal open={true} onOpenChange={() => {}} onComplete={() => navigate("/")} />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Shell>
      <Suspense fallback={<div className="p-8 max-w-5xl mx-auto"><LoadingState title="Loading page..." /></div>}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/coach" component={Coach} />
          <Route path="/reports" component={Reports} />
          <Route path="/nutrition" component={Nutrition} />
          <Route path="/planner" component={Planner} />
          <Route path="/activity" component={Activity} />
          <Route path="/sleep" component={Sleep} />
          <Route path="/screen-time" component={ScreenTime} />
          <Route path="/glucose" component={Glucose} />
          <Route path="/connections" component={Connections} />
          <Route path="/badges" component={Badges} />
          <Route path="/settings" component={Settings} />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Shell>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => {
    return localStorage.getItem("lumen_authenticated") === "true";
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {authenticated ? (
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <OnboardingGate>
              <Router />
            </OnboardingGate>
          </WouterRouter>
        ) : (
          <LandingPage onAuthenticate={() => setAuthenticated(true)} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
