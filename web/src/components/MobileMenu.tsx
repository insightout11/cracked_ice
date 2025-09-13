import { Link, useLocation } from 'react-router-dom';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  console.log('MobileMenu rendered, isOpen:', isOpen);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Menu */}
      <div className="fixed top-0 left-0 w-64 h-full bg-[var(--ice-card-strong)] backdrop-filter backdrop-blur-xl z-50 transform transition-transform duration-300 ease-in-out translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Menu</h2>
          <button 
            onClick={onClose}
            className="text-[var(--text-primary)] text-2xl hover:text-[var(--laser-cyan)] transition-colors"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        
        {/* Navigation Links */}
        <nav className="mobile-menu-nav p-4 space-y-2" style={{ display: 'block !important' }}>
          <div style={{ color: 'white', padding: '10px', background: 'red' }}>DEBUG: Nav container visible</div>
          <Link
            to="/"
            onClick={onClose}
            style={{ 
              display: 'block !important', 
              color: 'white !important', 
              padding: '12px', 
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              margin: '4px 0'
            }}
          >
            Optimizer
          </Link>
          <Link
            to="/schedule"
            onClick={onClose}
            style={{ 
              display: 'block !important', 
              color: 'white !important', 
              padding: '12px', 
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              margin: '4px 0'
            }}
          >
            Schedule
          </Link>
          <Link
            to="/off-night-totals"
            onClick={onClose}
            style={{ 
              display: 'block !important', 
              color: 'white !important', 
              padding: '12px', 
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              margin: '4px 0'
            }}
          >
            Off-Night Totals
          </Link>
          <Link
            to="/help"
            onClick={onClose}
            style={{ 
              display: 'block !important', 
              color: 'white !important', 
              padding: '12px', 
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              margin: '4px 0'
            }}
          >
            Help
          </Link>
        </nav>
      </div>
    </>
  );
}