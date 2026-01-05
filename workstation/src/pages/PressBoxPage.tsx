export function PressBoxPage() {
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
        <div className="text-6xl mb-4">🔭</div>
        <h1 className="text-4xl font-bold" style={{ color: 'var(--laser-cyan)' }}>
          Press Box
        </h1>
        <p className="text-xl" style={{ color: 'var(--ci-white)' }}>
          Schedule & Planning
        </p>
        <p className="text-base" style={{ color: 'var(--ci-muted)' }}>
          Your strategic planning headquarters. Weekly schedules, off-night analysis,
          back-to-back tracking, and roster gap tools all in one place.
        </p>
        <div className="pt-6 text-sm" style={{ color: 'var(--ci-muted)' }}>
          Coming soon in Phase 3...
        </div>
      </div>
    </div>
  );
}
