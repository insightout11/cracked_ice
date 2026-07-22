import { TooltipLabel } from './ui/tooltip';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layers, Binoculars, Briefcase } from 'lucide-react';

export function WorkstationSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const modes = [
    {
      id: 'roster',
      name: 'Ice Level',
      icon: Layers,
      path: '/coach/roster',
      description: 'Roster Optimizer'
    },
    {
      id: 'press-box',
      name: 'Press Box',
      icon: Binoculars,
      path: '/coach/press-box',
      description: 'Schedule & Planning'
    },
    {
      id: 'front-office',
      name: 'Front Office',
      icon: Briefcase,
      path: '/coach/front-office',
      description: 'Strategy'
    }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Desktop: Vertical Sidebar */}
      <aside
        className='hidden md:flex fixed left-0 top-0 bottom-0 w-[72px] flex-col items-center py-6 gap-6 z-50 bg-surface-glass [backdrop-filter:var(--frost)] [-webkit-backdrop-filter:var(--frost)] [border-right:1px_solid_var(--line)]'>
        {/* Logo */}
        <div className="mb-4">
          <div
            className='w-12 h-12 rounded-full flex items-center justify-center overflow-hidden [background:linear-gradient(135deg,_var(--accent),_var(--accent))] [box-shadow:0_0_20px_var(--accent-muted)]'>
            <img src="/logo-mark.svg" alt="Cracked Ice" className="w-8 h-8 object-contain" />
          </div>
        </div>

        {/* Mode Buttons */}
        <div className="flex-1 flex flex-col gap-4">
          {modes.map((m) => {
            const Icon = m.icon;
            const active = isActive(m.path);

            return (
              <TooltipLabel label={m.name}><button
                    key={m.id}
                    onClick={() => navigate(m.path)}
                    className="relative group w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200"
                    style={{
                      background: active ? 'var(--surface-raised)' : 'transparent',
                      border: active ? '1px solid var(--accent)' : '1px solid transparent',
                      boxShadow: active ? '0 0 18px var(--accent-muted)' : 'none',
                    }}>
                    <Icon
                      size={24}
                      style={{
                        color: active ? 'var(--accent)' : 'var(--ink-mute)',
                        filter: active ? 'drop-shadow(0 0 8px var(--accent-muted))' : 'none',
                      }}
                    />
                    {/* Tooltip */}
                    <div
                      className='absolute left-[80px] px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap bg-surface-glass [border:1px_solid_var(--line)] [box-shadow:0_4px_12px_var(--surface-0)]'>
                      <div className='text-sm font-semibold text-ink'>
                        {m.name}
                      </div>
                      <div className='text-xs text-ink-mute'>
                        {m.description}
                      </div>
                    </div>
                  </button></TooltipLabel>
            );
          })}
        </div>
      </aside>
      {/* Mobile: Bottom Navigation Bar */}
      <nav
        className='md:hidden fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around z-50 bg-surface-glass [backdrop-filter:var(--frost)] [-webkit-backdrop-filter:var(--frost)] [border-top:1px_solid_var(--line)] pb-[env(safe-area-inset-bottom)]'>
        {modes.map((m) => {
          const Icon = m.icon;
          const active = isActive(m.path);

          return (
            <button
              key={m.id}
              onClick={() => navigate(m.path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 relative"
            >
              <Icon
                size={20}
                style={{
                  color: active ? 'var(--accent)' : 'var(--ink-mute)',
                  filter: active ? 'drop-shadow(0 0 8px var(--accent-muted))' : 'none',
                }}
              />
              <span
                className="text-[10px] font-medium"
                style={{
                  color: active ? 'var(--accent)' : 'var(--ink-mute)',
                }}
              >
                {m.name}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
