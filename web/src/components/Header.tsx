import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header className="hero-header">
      <div className="header-overlay">
        <button className="menu-btn" aria-label="Open menu">☰</button>
        
        {/* Centered Logo Section with Puck and Wordmark */}
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ marginLeft: '200px' }}>
          <Link to="/" className="logo-section flex items-center gap-4">
            {/* Puck Logo in Cracked Ice Container */}
            <div className="cracked-ice-container">
              <img 
                src="/puck.png" 
                alt="Cracked Ice Puck Logo" 
                className="puck-logo"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  console.error('Failed to load puck logo');
                }}
                onLoad={() => console.log('Puck logo loaded successfully')}
              />
            </div>
            
            {/* Cracked Ice Wordmark */}
            <div className="wordmark-container">
              <img 
                src="/upscalemedia-transformed (1).png" 
                alt="Cracked Ice Logo" 
                className="cracked-ice-wordmark" 
              />
            </div>
          </Link>
        </div>
        
        {/* Navigation - moved much further right */}
        <nav className="hidden md:flex items-center gap-1 absolute right-8 top-1/2 transform -translate-y-1/2 z-20">
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/') 
                ? 'text-[var(--laser-cyan)] bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] shadow-[0_0_18px_rgba(94,245,255,0.3)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)] hover:bg-[var(--glass-fill-hover)]'
            }`}
          >
            Optimizer
          </Link>
          <Link
            to="/schedule"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/schedule') 
                ? 'text-[var(--laser-cyan)] bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] shadow-[0_0_18px_rgba(94,245,255,0.3)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)] hover:bg-[var(--glass-fill-hover)]'
            }`}
          >
            Schedule
          </Link>
          <Link
            to="/off-night-totals"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/off-night-totals') 
                ? 'text-[var(--laser-cyan)] bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] shadow-[0_0_18px_rgba(94,245,255,0.3)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)] hover:bg-[var(--glass-fill-hover)]'
            }`}
          >
            Off-Night Totals
          </Link>
          <Link
            to="/help"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/help') 
                ? 'text-[var(--laser-cyan)] bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] shadow-[0_0_18px_rgba(94,245,255,0.3)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)] hover:bg-[var(--glass-fill-hover)]'
            }`}
          >
            Help
          </Link>
        </nav>
      </div>
      
      {/* Scoreboard temporarily removed to avoid conflicts with navigation */}
    </header>
  );
}