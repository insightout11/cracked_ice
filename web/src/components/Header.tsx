import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { CoffeeLink } from './CoffeeLink';

export function Header() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  
  return (
    <>
      <header className={`hero-header ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      <div className="header-overlay">
        <button 
          className="menu-btn" 
          aria-label="Open menu"
          onClick={() => {
            setIsMobileMenuOpen(true);
          }}
        >
          <Menu size={28} aria-hidden="true" />
        </button>
        
        {/* Centered Logo Section with Puck and Wordmark */}
        <div
          className='absolute inset-0 flex items-center justify-center z-10 ml-[200px] pointer-events-none'>
          <Link
            to="/"
            className='logo-section inline-flex items-center pointer-events-auto'>
            <img
              src="/logo-horizontal.svg"
              alt="Cracked Ice — win your league with schedule math"
              className="h-9 w-auto"
            />
          </Link>
        </div>
        
        {/* Navigation - moved much further right */}
        <nav className="hidden md:flex items-center gap-1 absolute right-8 top-1/2 transform -translate-y-1/2 z-20">
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/') 
                ? 'text-[var(--accent)] bg-[var(--surface-raised)] border border-[var(--accent)] shadow-[0_0_18px_var(--accent-muted)]'
                : 'text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            Optimizer
          </Link>
          <Link
            to="/schedule"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/schedule') 
                ? 'text-[var(--accent)] bg-[var(--surface-raised)] border border-[var(--accent)] shadow-[0_0_18px_var(--accent-muted)]'
                : 'text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            Schedule
          </Link>
          <Link
            to="/game-analysis"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/game-analysis')
                ? 'text-[var(--accent)] bg-[var(--surface-raised)] border border-[var(--accent)] shadow-[0_0_18px_var(--accent-muted)]'
                : 'text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            Game Analysis
          </Link>
          {/* Roster tab hidden for production - still in development */}
          <Link
            to="/blog"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/blog')
                ? 'text-[var(--accent)] bg-[var(--surface-raised)] border border-[var(--accent)] shadow-[0_0_18px_var(--accent-muted)]'
                : 'text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            Blog
          </Link>
          <Link
            to="/help"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/help')
                ? 'text-[var(--accent)] bg-[var(--surface-raised)] border border-[var(--accent)] shadow-[0_0_18px_var(--accent-muted)]'
                : 'text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            Help
          </Link>
          <CoffeeLink variant="header" />
        </nav>
      </div>
      
      
      {/* Scoreboard temporarily removed to avoid conflicts with navigation */}
    </header>
      {/* Professional Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className='fixed top-[70px] left-[10px] right-[10px] bg-surface-raised [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)] z-[9999] text-ink p-[24px] rounded-[16px] [border:1px_solid_var(--line)] [box-shadow:0_20px_40px_var(--surface-0),_0_0_30px_var(--accent-muted)]'>
          <div className='flex justify-between items-center mb-[24px] pb-[16px] [border-bottom:1px_solid_var(--line)]'>
            <h3 className='m-[0] text-accent text-[18px] font-semibold tracking-[0.5px] [text-shadow:0_0_8px_var(--accent-muted)]'>
              Navigation
            </h3>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className='[background-color:transparent] text-accent [border:1px_solid_var(--line)] [padding:8px_12px] rounded-[8px] text-[14px] cursor-pointer [transition:all_0.2s_ease] font-medium'
            >
              ✕ Close
            </button>
          </div>

          <div className='flex flex-col gap-[12px]'>
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                backgroundColor: isActive('/') ? 'var(--surface-raised)' : 'var(--surface-glass)',
                color: isActive('/') ? 'var(--accent)' : 'var(--ink)',
                border: isActive('/') ? '1px solid var(--accent)' : '1px solid var(--line)',
                boxShadow: isActive('/') ? '0 0 18px var(--accent-muted)' : 'none'
              }}
              className='[padding:16px_20px] text-[16px] flex items-center [text-decoration:none] font-medium rounded-[12px] [transition:all_0.3s_ease]'>
   Optimizer
            </Link>

            <Link
              to="/schedule"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                backgroundColor: isActive('/schedule') ? 'var(--surface-raised)' : 'var(--surface-glass)',
                color: isActive('/schedule') ? 'var(--accent)' : 'var(--ink)',
                border: isActive('/schedule') ? '1px solid var(--accent)' : '1px solid var(--line)',
                boxShadow: isActive('/schedule') ? '0 0 18px var(--accent-muted)' : 'none'
              }}
              className='[padding:16px_20px] text-[16px] flex items-center [text-decoration:none] font-medium rounded-[12px] [transition:all_0.3s_ease]'>
   Schedule
            </Link>

            <Link
              to="/game-analysis"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                backgroundColor: isActive('/game-analysis') ? 'var(--surface-raised)' : 'var(--surface-glass)',
                color: isActive('/game-analysis') ? 'var(--accent)' : 'var(--ink)',
                border: isActive('/game-analysis') ? '1px solid var(--accent)' : '1px solid var(--line)',
                boxShadow: isActive('/game-analysis') ? '0 0 18px var(--accent-muted)' : 'none'
              }}
              className='[padding:16px_20px] text-[16px] flex items-center [text-decoration:none] font-medium rounded-[12px] [transition:all_0.3s_ease]'>
   Game Analysis
            </Link>

            {/* Roster tab hidden for production - still in development */}

            <Link
              to="/blog"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                backgroundColor: isActive('/blog') ? 'var(--surface-raised)' : 'var(--surface-glass)',
                color: isActive('/blog') ? 'var(--accent)' : 'var(--ink)',
                border: isActive('/blog') ? '1px solid var(--accent)' : '1px solid var(--line)',
                boxShadow: isActive('/blog') ? '0 0 18px var(--accent-muted)' : 'none'
              }}
              className='[padding:16px_20px] text-[16px] flex items-center [text-decoration:none] font-medium rounded-[12px] [transition:all_0.3s_ease]'>
   Blog
            </Link>

            <Link
              to="/help"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                backgroundColor: isActive('/help') ? 'var(--surface-raised)' : 'var(--surface-glass)',
                color: isActive('/help') ? 'var(--accent)' : 'var(--ink)',
                border: isActive('/help') ? '1px solid var(--accent)' : '1px solid var(--line)',
                boxShadow: isActive('/help') ? '0 0 18px var(--accent-muted)' : 'none'
              }}
              className='[padding:16px_20px] text-[16px] flex items-center [text-decoration:none] font-medium rounded-[12px] [transition:all_0.3s_ease]'>
   Help
            </Link>

            <div className='bg-surface-glass [padding:16px_20px] rounded-[12px] [border:1px_solid_var(--line)] flex items-center justify-center'>
              <CoffeeLink variant="blog" onClick={() => setIsMobileMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
