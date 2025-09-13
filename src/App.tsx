import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { SchedulePage } from './pages/SchedulePage';
import { ScheduleV2 } from './components/ScheduleV2';
import { GameAnalysisPage } from './pages/GameAnalysisPage';
import { HelpPage } from './pages/HelpPage';

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
    <Router>
      <div className="min-h-screen ice-rink-bg">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/schedule-v2" element={<ScheduleV2 />} />
          <Route path="/game-analysis" element={<GameAnalysisPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;