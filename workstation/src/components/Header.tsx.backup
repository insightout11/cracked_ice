import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

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
            console.log('Hamburger menu clicked!');
            setIsMobileMenuOpen(true);
          }}
        >
          ☰
        </button>
        
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
            to="/game-analysis"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/game-analysis')
                ? 'text-[var(--laser-cyan)] bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] shadow-[0_0_18px_rgba(94,245,255,0.3)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)] hover:bg-[var(--glass-fill-hover)]'
            }`}
          >
            Game Analysis
          </Link>
          <Link
            to="/blog"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive('/blog')
                ? 'text-[var(--laser-cyan)] bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] shadow-[0_0_18px_rgba(94,245,255,0.3)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)] hover:bg-[var(--glass-fill-hover)]'
            }`}
          >
            Blog
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
    
    {/* Professional Mobile Dropdown Menu */}
    {isMobileMenuOpen && (
      <div style={{
        position: 'fixed',
        top: '70px',
        left: '10px',
        right: '10px',
        backgroundColor: 'var(--ice-card-strong)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 9999,
        color: 'var(--text-primary)',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(94,245,255,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--glass-border)'
        }}>
          <h3 style={{ 
            margin: '0',
            color: 'var(--laser-cyan)',
            fontSize: '18px',
            fontWeight: '600',
            letterSpacing: '0.5px',
            textShadow: '0 0 8px rgba(94,245,255,0.3)'
          }}>
            Navigation
          </h3>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ 
              backgroundColor: 'transparent',
              color: 'var(--laser-cyan)', 
              border: '1px solid var(--glass-border)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: '500'
            }}
          >
            ✕ Close
          </button>
        </div>
          
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ 
              backgroundColor: isActive('/') ? 'var(--glass-fill-active)' : 'var(--glass-fill)',
              color: isActive('/') ? 'var(--laser-cyan)' : 'var(--text-primary)',
              padding: '16px 20px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontWeight: '500',
              borderRadius: '12px',
              border: isActive('/') ? '1px solid var(--laser-cyan)' : '1px solid var(--glass-border)',
              transition: 'all 0.3s ease',
              boxShadow: isActive('/') ? '0 0 18px rgba(94,245,255,0.2)' : 'none'
            }}
          >
            <span style={{ marginRight: '12px', fontSize: '18px' }}>🏠</span>
            Optimizer
          </Link>
          
          <Link
            to="/schedule"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ 
              backgroundColor: isActive('/schedule') ? 'var(--glass-fill-active)' : 'var(--glass-fill)',
              color: isActive('/schedule') ? 'var(--laser-cyan)' : 'var(--text-primary)',
              padding: '16px 20px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontWeight: '500',
              borderRadius: '12px',
              border: isActive('/schedule') ? '1px solid var(--laser-cyan)' : '1px solid var(--glass-border)',
              transition: 'all 0.3s ease',
              boxShadow: isActive('/schedule') ? '0 0 18px rgba(94,245,255,0.2)' : 'none'
            }}
          >
            <span style={{ marginRight: '12px', fontSize: '18px' }}>📅</span>
            Schedule
          </Link>
          
          <Link
            to="/game-analysis"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              backgroundColor: isActive('/game-analysis') ? 'var(--glass-fill-active)' : 'var(--glass-fill)',
              color: isActive('/game-analysis') ? 'var(--laser-cyan)' : 'var(--text-primary)',
              padding: '16px 20px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontWeight: '500',
              borderRadius: '12px',
              border: isActive('/game-analysis') ? '1px solid var(--laser-cyan)' : '1px solid var(--glass-border)',
              transition: 'all 0.3s ease',
              boxShadow: isActive('/game-analysis') ? '0 0 18px rgba(94,245,255,0.2)' : 'none'
            }}
          >
            <span style={{ marginRight: '12px', fontSize: '18px' }}>📊</span>
            Game Analysis
          </Link>

          <Link
            to="/blog"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              backgroundColor: isActive('/blog') ? 'var(--glass-fill-active)' : 'var(--glass-fill)',
              color: isActive('/blog') ? 'var(--laser-cyan)' : 'var(--text-primary)',
              padding: '16px 20px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontWeight: '500',
              borderRadius: '12px',
              border: isActive('/blog') ? '1px solid var(--laser-cyan)' : '1px solid var(--glass-border)',
              transition: 'all 0.3s ease',
              boxShadow: isActive('/blog') ? '0 0 18px rgba(94,245,255,0.2)' : 'none'
            }}
          >
            <span style={{ marginRight: '12px', fontSize: '18px' }}>📝</span>
            Blog
          </Link>

          <Link
            to="/help"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              backgroundColor: isActive('/help') ? 'var(--glass-fill-active)' : 'var(--glass-fill)',
              color: isActive('/help') ? 'var(--laser-cyan)' : 'var(--text-primary)',
              padding: '16px 20px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontWeight: '500',
              borderRadius: '12px',
              border: isActive('/help') ? '1px solid var(--laser-cyan)' : '1px solid var(--glass-border)',
              transition: 'all 0.3s ease',
              boxShadow: isActive('/help') ? '0 0 18px rgba(94,245,255,0.2)' : 'none'
            }}
          >
            <span style={{ marginRight: '12px', fontSize: '18px' }}>❓</span>
            Help
          </Link>
        </div>
      </div>
    )}
    </>
  );
}