import { BrowserRouter as Router, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { SchedulePage } from './pages/SchedulePage';
import { BlogPage } from './pages/BlogPage';
import { BlogArticlePage } from './pages/BlogArticlePage';
import { RosterPage } from './pages/RosterPage';
import { TeamTierProvider } from './contexts/TeamTierContext';
import { TeamTierManager } from './components/TeamTierManager';
import { TimeWindowProvider } from './contexts/TimeWindowContext';
import { GlobalLoadingBar } from './components/GlobalLoadingBar';
import { GlobalErrorToast } from './components/GlobalErrorToast';
import { TooltipProvider } from './components/ui/tooltip';
import { RouteMeta } from './components/RouteMeta';
import { LeagueWorkspaceProvider } from './contexts/LeagueWorkspaceContext';
import { ComparePage } from './pages/ComparePage';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceCloudSyncProvider } from './contexts/WorkspaceCloudSyncContext';
import { ContactPage, PrivacyPage, TermsPage } from './pages/LegalPage';
function NotFoundPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">404</p>
        <h1 className="mb-3 text-3xl font-bold text-ink">Page not found</h1>
        <p className="mb-6 text-ink-dim">The page may have moved, or it may not be published yet.</p>
        <Link to="/" className="inline-flex min-h-11 items-center rounded-lg border border-accent bg-accent-muted px-5 font-medium text-accent">Return to Cracked Ice</Link>
      </div>
    </main>
  );
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
              <Route path="/coach" element={<Navigate to="/team" replace />} />
              <Route path="/coach/roster" element={<Navigate to="/team" replace />} />
              <Route path="/coach/press-box" element={<Navigate to="/season" replace />} />
              <Route path="/coach/front-office" element={<Navigate to="/team" replace />} />

              {/* Standard routes with header and ice-rink-bg */}
              <Route path="*" element={
                <div className="min-h-screen ice-rink-bg">
                  <Header />
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/optimizer" element={<Navigate to="/" replace />} />
                    <Route path="/season" element={<SchedulePage />} />
                    <Route path="/schedule" element={<Navigate to="/season" replace />} />
                    <Route path="/schedule-v2" element={<Navigate to="/season" replace />} />
                    <Route path="/game-analysis" element={<Navigate to="/season?view=season" replace />} />
                    <Route path="/team" element={<RosterPage />} />
                    <Route path="/compare" element={<ComparePage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/blog/:id" element={<BlogArticlePage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/help" element={<Navigate to="/" replace />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
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
