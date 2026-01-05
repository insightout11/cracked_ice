import { useWorkstationMode } from '../contexts/WorkstationModeContext';

export function FrontOfficePage() {
  const { isPremium } = useWorkstationMode();

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-6"
        style={{
          background: 'var(--glass-fill)',
          backdropFilter: 'var(--frost-blur)',
          WebkitBackdropFilter: 'var(--frost-blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          padding: '48px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div className="text-6xl mb-4">💼</div>
        <h1 className="text-4xl font-bold" style={{ color: 'var(--laser-cyan)' }}>
          Front Office
        </h1>
        <p className="text-xl" style={{ color: 'var(--ci-white)' }}>
          Strategy
        </p>

        {!isPremium && (
          <div className="my-6 px-6 py-4 rounded-lg"
            style={{
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)'
            }}
          >
            <div className="text-2xl mb-2">⭐ Premium Feature</div>
            <p className="text-sm" style={{ color: 'var(--ci-muted)' }}>
              This mode requires a premium subscription
            </p>
          </div>
        )}

        <p className="text-base" style={{ color: 'var(--ci-muted)' }}>
          Your strategy headquarters. Weekly team reports, personalized recommendations,
          multi-team management, and cross-device sync.
        </p>

        <div className="pt-6 text-sm" style={{ color: 'var(--ci-muted)' }}>
          Coming soon in Phase 4...
        </div>

        {/* Debug toggle for testing */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <button
            onClick={() => {
              const newValue = !isPremium;
              localStorage.setItem('isPremium', newValue.toString());
              window.location.reload();
            }}
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--glass-fill-hover)',
              border: '1px solid var(--glass-border)',
              color: 'var(--ci-white)',
            }}
          >
            {isPremium ? '🔓 Premium Active' : '🔒 Toggle Premium (Test)'}
          </button>
        </div>
      </div>
    </div>
  );
}
