import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WorkstationLayout } from './layouts/WorkstationLayout';
import { IceLevelPage } from './pages/IceLevelPage';
import { PressBoxPage } from './pages/PressBoxPage';
import { FrontOfficePage } from './pages/FrontOfficePage';
import { WorkstationModeProvider } from './contexts/WorkstationModeContext';
import { TimeWindowProvider } from './contexts/TimeWindowContext';
import { TeamTierProvider } from './contexts/TeamTierContext';
import { TeamTierManager } from './components/TeamTierManager';
import { GlobalLoadingBar } from './components/GlobalLoadingBar';
import { GlobalErrorToast } from './components/GlobalErrorToast';

export function Puck({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="animate-pulse-slow">
      <defs>
        <linearGradient id="puckGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5EF5FF"/>
          <stop offset="50%" stopColor="#9FE8FF"/>
          <stop offset="100%" stopColor="#2FD3C9"/>
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
        stroke="#5EF5FF"
        strokeWidth="1"
        filter="url(#puckGlow)"
      />
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke="#EAF6FF"
        strokeWidth="1"
        opacity="0.8"
      />
      <circle
        cx="16"
        cy="16"
        r="6"
        fill="none"
        stroke="#5EF5FF"
        strokeWidth="0.5"
        opacity="0.6"
      />
    </svg>
  );
}

function App() {
  return (
    <TimeWindowProvider>
      <TeamTierProvider>
        <WorkstationModeProvider>
          <GlobalLoadingBar />
          <GlobalErrorToast />
          <TeamTierManager />
          <Router>
            <Routes>
              <Route path="/" element={<WorkstationLayout />}>
                {/* Default redirect to ice-level */}
                <Route index element={<Navigate to="/ice-level" replace />} />

                {/* Ice Level Mode - Roster Optimizer */}
                <Route path="ice-level" element={<IceLevelPage />} />

                {/* Press Box Mode - Schedule & Planning */}
                <Route path="press-box" element={<PressBoxPage />} />

                {/* Front Office Mode - Strategy */}
                <Route path="front-office" element={<FrontOfficePage />} />
              </Route>
            </Routes>
          </Router>
        </WorkstationModeProvider>
      </TeamTierProvider>
    </TimeWindowProvider>
  );
}

export default App;
