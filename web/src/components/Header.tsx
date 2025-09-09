import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header className="hero-header">
      <div className="header-overlay">
        <button className="menu-btn" aria-label="Open menu">☰</button>
        
        {/* Logo */}
        <Link to="/" className="logo-link">
          <img src="/upscalemedia-transformed (1).png" alt="Cracked Ice Logo" className="header-logo" />
        </Link>
        
        {/* Navigation - moved much further right */}
        <nav className="hidden md:flex items-center gap-1 absolute right-8 top-1/2 transform -translate-y-1/2">
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
            Schedule V1
          </Link>
          <Link
            to="/schedule-v2"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/schedule-v2') 
                ? 'text-[var(--laser-cyan)] bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] shadow-[0_0_18px_rgba(94,245,255,0.3)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)] hover:bg-[var(--glass-fill-hover)]'
            }`}
          >
            Schedule
          </Link>
        </nav>
      </div>
      
      {/* Keep the scoreboard pill for now */}
      <div className="ci-scoreboard" role="group" aria-label="Sample scoreboard">
        <div className="ci-scoreboard__tab">LIVE</div>
        <div className="ci-scoreboard__row">
          <div className="ci-scoreboard__teams">
            TOR <span className="num">3</span> – MTL <span className="num">2</span>
          </div>
          <div className="ci-scoreboard__meta">
            <div className="meta">
              <label>PERIOD</label>
              <div className="val">2</div>
            </div>
            <div className="divider"></div>
            <div className="meta">
              <label>TIME</label>
              <div className="val">08:34</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}