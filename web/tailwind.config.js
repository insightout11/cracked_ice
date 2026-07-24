/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          // Channel form so opacity modifiers work (e.g. bg-surface-1/5).
          0: 'rgb(var(--surface-0-rgb) / <alpha-value>)',
          1: 'rgb(var(--surface-1-rgb) / <alpha-value>)',
          2: 'rgb(var(--surface-2-rgb) / <alpha-value>)',
          glass: 'var(--surface-glass)',
          raised: 'var(--surface-raised)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          dim: 'var(--ink-dim)',
          mute: 'var(--ink-mute)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        accent: {
          // Channel form so opacity modifiers work (e.g. bg-accent/10).
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          ink: 'var(--accent-ink)',
          muted: 'var(--accent-muted)',
        },
        positive: {
          DEFAULT: 'var(--positive)',
          muted: 'var(--positive-muted)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          muted: 'var(--warning-muted)',
        },
        negative: {
          DEFAULT: 'var(--negative)',
          muted: 'var(--negative-muted)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      boxShadow: {
        accent: 'var(--glow-accent)',
        'accent-soft': 'var(--glow-accent-soft)',
        positive: 'var(--glow-positive)',
        raised: 'var(--shadow-raised)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        'ice-pulse': {
          '0%, 100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: '0.85',
            transform: 'scale(1.05)',
          },
        },
      },
      animation: {
        shake: 'shake 0.5s ease-in-out',
        'ice-pulse': 'ice-pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
