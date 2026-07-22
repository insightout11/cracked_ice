import { Link } from 'react-router-dom';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  
  
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-surface-glass bg-opacity-50 z-40"
        onClick={onClose}
      />
      {/* Menu */}
      <div className="fixed top-0 left-0 w-64 h-full bg-[var(--surface-raised)] backdrop-filter backdrop-blur-xl z-50 transform transition-transform duration-300 ease-in-out translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Menu</h2>
          <button 
            onClick={onClose}
            className="text-[var(--ink)] text-2xl hover:text-[var(--accent)] transition-colors"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        
        {/* Navigation Links */}
        <nav className='mobile-menu-nav p-4 space-y-2 [display:block_!important]'>
          <div className='[color:white] p-[10px] [background:red]'>DEBUG: Nav container visible</div>
          <Link
            to="/"
            onClick={onClose}
            className='[display:block_!important] [color:white_!important] p-[12px] bg-line [border:1px_solid_var(--line)] [margin:4px_0]'
          >
            Optimizer
          </Link>
          <Link
            to="/schedule"
            onClick={onClose}
            className='[display:block_!important] [color:white_!important] p-[12px] bg-line [border:1px_solid_var(--line)] [margin:4px_0]'
          >
            Schedule
          </Link>
          <Link
            to="/off-night-totals"
            onClick={onClose}
            className='[display:block_!important] [color:white_!important] p-[12px] bg-line [border:1px_solid_var(--line)] [margin:4px_0]'
          >
            Off-Night Totals
          </Link>
          <Link
            to="/help"
            onClick={onClose}
            className='[display:block_!important] [color:white_!important] p-[12px] bg-line [border:1px_solid_var(--line)] [margin:4px_0]'
          >
            Help
          </Link>
        </nav>
      </div>
    </>
  );
}
