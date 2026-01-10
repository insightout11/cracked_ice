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
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[72px] flex-col items-center py-6 gap-6 z-50"
        style={{
          background: 'var(--glass-fill)',
          backdropFilter: 'var(--frost-blur)',
          WebkitBackdropFilter: 'var(--frost-blur)',
          borderRight: '1px solid var(--glass-border)',
        }}
      >
        {/* Logo */}
        <div className="mb-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--laser-cyan), var(--ice-cyan))',
              boxShadow: '0 0 20px rgba(94, 245, 255, 0.3)'
            }}
          >
            <img src="/puck.png" alt="Logo" className="w-8 h-8 rounded-full object-cover" />
          </div>
        </div>

        {/* Mode Buttons */}
        <div className="flex-1 flex flex-col gap-4">
          {modes.map((m) => {
            const Icon = m.icon;
            const active = isActive(m.path);

            return (
              <button
                key={m.id}
                onClick={() => navigate(m.path)}
                className="relative group w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200"
                style={{
                  background: active ? 'var(--glass-fill-active)' : 'transparent',
                  border: active ? '1px solid var(--laser-cyan)' : '1px solid transparent',
                  boxShadow: active ? '0 0 18px rgba(94, 245, 255, 0.3)' : 'none',
                }}
                title={m.name}
              >
                <Icon
                  size={24}
                  style={{
                    color: active ? 'var(--laser-cyan)' : 'var(--ci-muted)',
                    filter: active ? 'drop-shadow(0 0 8px rgba(94, 245, 255, 0.5))' : 'none',
                  }}
                />

                {/* Tooltip */}
                <div className="absolute left-[80px] px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap"
                  style={{
                    background: 'var(--glass-fill)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: 'var(--ci-white)' }}>
                    {m.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--ci-muted)' }}>
                    {m.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile: Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around z-50"
        style={{
          background: 'var(--glass-fill)',
          backdropFilter: 'var(--frost-blur)',
          WebkitBackdropFilter: 'var(--frost-blur)',
          borderTop: '1px solid var(--glass-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
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
                  color: active ? 'var(--laser-cyan)' : 'var(--ci-muted)',
                  filter: active ? 'drop-shadow(0 0 8px rgba(94, 245, 255, 0.5))' : 'none',
                }}
              />
              <span
                className="text-[10px] font-medium"
                style={{
                  color: active ? 'var(--laser-cyan)' : 'var(--ci-muted)',
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
