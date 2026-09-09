import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { TeamTierProvider } from './contexts/TeamTierContext';
import { TeamTierManager } from './components/TeamTierManager';
import { TimeWindowProvider } from './contexts/TimeWindowContext';
import { GlobalLoadingBar } from './components/GlobalLoadingBar';
import { GlobalErrorToast } from './components/GlobalErrorToast';
import { TooltipProvider } from './components/ui/tooltip';
import { RouteMeta } from './components/RouteMeta';
import { LeagueWorkspaceProvider } from './contexts/LeagueWorkspaceContext';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceCloudSyncProvider } from './contexts/WorkspaceCloudSyncContext';
import { ContactPage, PrivacyPage, TermsPage } from './pages/LegalPage';
import { resolveRootExperience } from './lib/navigation';
import { parseHomeActionContext, replaceLeagueContext } from './lib/navigationContext';
import { useLeagueWorkspace } from './contexts/LeagueWorkspaceContext';

const ScheduleFitPage = lazy(() => import('./pages/ScheduleFitPage').then((module) => ({ default: module.ScheduleFitPage })));
const DraftPage = lazy(() => import('./pages/DraftPage').then((module) => ({ default: module.DraftPage })));
const SchedulePage = lazy(() => import('./pages/SchedulePage').then((module) => ({ default: module.SchedulePage })));
const RosterPage = lazy(() => import('./pages/RosterPage').then((module) => ({ default: module.RosterPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then((module) => ({ default: module.ComparePage })));
const BlogPage = lazy(() => import('./pages/BlogPage').then((module) => ({ default: module.BlogPage })));
const BlogArticlePage = lazy(() => import('./pages/BlogArticlePage').then((module) => ({ default: module.BlogArticlePage })));

function RouteFallback() {
  return <main className="mx-auto max-w-7xl px-4 py-8"><div className="h-80 animate-pulse rounded-xl border border-line bg-surface-1" /></main>;
}

function RootDispatcher() {
  const location = useLocation();
  const experience = resolveRootExperience(location.search);
  if (experience === 'draft') return <DraftPage />;
  if (experience === 'fit') return <ScheduleFitPage />;
  return <HomePage />;
}

function ContextGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeLeague, store, setActiveLeague } = useLeagueWorkspace();
  const context = parseHomeActionContext(location.search);
  const requestedLeague = context?.leagueId;
  const exists = !requestedLeague || store.leagues.some((league) => league.id === requestedLeague);

  useEffect(() => {
    if (requestedLeague && exists && requestedLeague !== activeLeague.id) setActiveLeague(requestedLeague);
  }, [activeLeague.id, exists, requestedLeague, setActiveLeague]);

  if (!exists) return <main className="mx-auto max-w-xl px-4 py-12"><section className="rounded-xl border border-warning/50 bg-surface-1 p-6"><p className="scoreboard-text text-warning">LEAGUE CONTEXT UNAVAILABLE</p><h1 className="mt-2 text-2xl font-semibold text-ink">Select a saved league to continue</h1><p className="mt-2 text-sm text-ink-dim">The league referenced by this Home action is not available on this device. Cracked Ice has not substituted a different league.</p><div className="mt-5 grid gap-2">{store.leagues.map((league) => <button key={league.id} type="button" onClick={() => { setActiveLeague(league.id); navigate({ pathname: location.pathname, search: replaceLeagueContext(location.search, league.id) }, { replace: true }); }} className="flex min-h-11 items-center justify-between rounded-md border border-line bg-surface-0 px-4 text-left text-sm font-semibold text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span>{league.name}</span><span className="text-xs font-normal text-ink-mute">{league.season.label}</span></button>)}</div></section></main>;
  if (requestedLeague && requestedLeague !== activeLeague.id) return <RouteFallback />;
  return children;
}

function ContextReturnLink() {
  const location = useLocation();
  const context = parseHomeActionContext(location.search);
  if (!context?.returnTo || location.pathname === '/') return null;
  return <div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 lg:px-8"><Link to={context.returnTo} className="inline-flex min-h-10 items-center text-sm font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">← Back to Home briefing</Link></div>;
}

function QueryPreservingNavigate({ to }: { to: string }) {
  const location = useLocation();
  const [pathname, destinationSearch = ''] = to.split('?');
  const params = new URLSearchParams(location.search);

  new URLSearchParams(destinationSearch).forEach((value, key) => {
    params.set(key, value);
  });

  const search = params.toString();
  return <Navigate to={`${pathname}${search ? `?${search}` : ''}`} replace />;
}

export function Puck({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="animate-pulse-slow">
      <defs>
        <linearGradient id="puckGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent)"/>
          <stop offset="50%" stopColor="var(--accent)"/>
          <stop offset="100%" stopColor="var(--accent)"/>
        </linearGradient>
        <filter id="puckGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle 
        cx="16" 
        cy="16" 
        r="14" 
        fill="url(#puckGradient)" 
        stroke="var(--accent)"
        strokeWidth="1"
        filter="url(#puckGlow)"
      />
      <circle 
        cx="16" 
        cy="16" 
        r="10" 
        fill="none" 
        stroke="var(--ink)"
        strokeWidth="1" 
        opacity="0.8"
      />
      <circle 
        cx="16" 
        cy="16" 
        r="6" 
        fill="none" 
        stroke="var(--accent)"
        strokeWidth="0.5" 
        opacity="0.6"
      />
    </svg>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <LeagueWorkspaceProvider>
          <WorkspaceCloudSyncProvider>
            <TimeWindowProvider>
          <TeamTierProvider>
          <GlobalLoadingBar />
          <GlobalErrorToast />
          <TeamTierManager />
          <Router>
            <RouteMeta />
            <Routes>
              {/* Legacy workstation URLs now resolve into the canonical site shell. */}
              <Route path="/coach" element={<QueryPreservingNavigate to="/team" />} />
              <Route path="/coach/roster" element={<QueryPreservingNavigate to="/team" />} />
              <Route path="/coach/press-box" element={<QueryPreservingNavigate to="/season" />} />
              <Route path="/coach/front-office" element={<QueryPreservingNavigate to="/team" />} />

              {/* Standard routes with header and ice-rink-bg */}
              <Route path="*" element={
                <div className="min-h-screen ice-rink-bg">
                  <Header />
                  <ContextReturnLink />
                  <Suspense fallback={<RouteFallback />}><Routes>
                    <Route path="/" element={<RootDispatcher />} />
                    <Route path="/optimizer" element={<ContextGate><ScheduleFitPage /></ContextGate>} />
                    <Route path="/draft" element={<ContextGate><DraftPage /></ContextGate>} />
                    <Route path="/season" element={<ContextGate><SchedulePage /></ContextGate>} />
                    <Route path="/schedule" element={<QueryPreservingNavigate to="/season" />} />
                    <Route path="/schedule-v2" element={<QueryPreservingNavigate to="/season" />} />
                    <Route path="/game-analysis" element={<QueryPreservingNavigate to="/season?view=season" />} />
                    <Route path="/team" element={<ContextGate><RosterPage /></ContextGate>} />
                    <Route path="/compare" element={<ContextGate><ComparePage /></ContextGate>} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/blog/:id" element={<BlogArticlePage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/help" element={<QueryPreservingNavigate to="/" />} />
                  </Routes></Suspense>
                </div>
              } />
            </Routes>
          </Router>
          </TeamTierProvider>
            </TimeWindowProvider>
          </WorkspaceCloudSyncProvider>
        </LeagueWorkspaceProvider>
      </AuthProvider>
    </TooltipProvider>
  );
}

export default App;
