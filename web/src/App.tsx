import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { SchedulePage } from './pages/SchedulePage';
import { ScheduleV2 } from './components/ScheduleV2';
import { GameAnalysisPage } from './pages/GameAnalysisPage';
import { HelpPage } from './pages/HelpPage';
import { BlogPage } from './pages/BlogPage';
import { BlogArticlePage } from './pages/BlogArticlePage';
import { RosterPage } from './pages/RosterPage';
import { WorkstationLayout } from './layouts/WorkstationLayout';
import { TeamTierProvider } from './contexts/TeamTierContext';
import { TeamTierManager } from './components/TeamTierManager';
import { TimeWindowProvider } from './contexts/TimeWindowContext';
import { GlobalLoadingBar } from './components/GlobalLoadingBar';
import { GlobalErrorToast } from './components/GlobalErrorToast';
import { TooltipProvider } from './components/ui/tooltip';

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
      <TimeWindowProvider>
        <TeamTierProvider>
          <GlobalLoadingBar />
          <GlobalErrorToast />
          <TeamTierManager />
          <Router>
            <Routes>
              {/* Workstation routes - separate layout without header */}
              <Route path="/coach" element={<WorkstationLayout />}>
                <Route path="roster" element={<RosterPage />} />
                <Route path="press-box" element={<SchedulePage />} />
                <Route path="front-office" element={
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                      <h1 className='text-2xl font-bold mb-2 text-ink'>Front Office</h1>
                      <p className='text-ink-mute'>Strategy - Coming Soon</p>
                    </div>
                  </div>
                } />
              </Route>

              {/* Standard routes with header and ice-rink-bg */}
              <Route path="*" element={
                <div className="min-h-screen ice-rink-bg">
                  <Header />
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/schedule-v2" element={<ScheduleV2 />} />
                    <Route path="/game-analysis" element={<GameAnalysisPage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/blog/:id" element={<BlogArticlePage />} />
                    <Route path="/help" element={<HelpPage />} />
                  </Routes>
                </div>
              } />
            </Routes>
          </Router>
        </TeamTierProvider>
      </TimeWindowProvider>
    </TooltipProvider>
  );
}

export default App;
