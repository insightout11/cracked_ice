import { CoffeeLink } from './CoffeeLink';

export function Footer() {
  return (
    <footer className="mt-16 py-12 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center">
          {/* Ice divider */}
          <div className="flex items-center justify-center mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-[var(--laser-cyan)] to-transparent w-full max-w-md opacity-40"></div>
            <div className="mx-4">
              <svg width="24" height="24" viewBox="0 0 32 32" className="animate-pulse-slow">
                <defs>
                  <linearGradient id="footerPuckGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#5EF5FF"/>
                    <stop offset="50%" stopColor="#9FE8FF"/>
                    <stop offset="100%" stopColor="#2FD3C9"/>
                  </linearGradient>
                </defs>
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="url(#footerPuckGradient)"
                  stroke="#5EF5FF"
                  strokeWidth="1"
                  opacity="0.7"
                />
              </svg>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-[var(--laser-cyan)] to-transparent w-full max-w-md opacity-40"></div>
          </div>

          {/* Support message */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-3 font-orbitron">
              Fuel the Analytics Engine
            </h3>
            <p className="text-gray-700 text-base max-w-2xl mx-auto leading-relaxed">
              Cracked Ice Hockey is built with passion for data-driven fantasy success.
              If our tools help you dominate your league, consider supporting the development
              of new features and analysis.
            </p>
          </div>

          {/* Coffee link with enhanced styling */}
          <div className="mb-8">
            <CoffeeLink variant="footer" />
          </div>

          {/* Additional info */}
          <div className="pt-6 border-t border-gray-300">
            <p className="text-gray-600 text-sm">
              © 2025 Cracked Ice Hockey • Optimizing fantasy lineups with mathematical precision
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}