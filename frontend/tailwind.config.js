/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--color-brand-50, 238 242 255) / <alpha-value>)',
          100: 'rgb(var(--color-brand-100, 224 231 255) / <alpha-value>)',
          200: 'rgb(var(--color-brand-200, 199 210 254) / <alpha-value>)',
          300: 'rgb(var(--color-brand-300, 165 180 252) / <alpha-value>)',
          400: 'rgb(var(--color-brand-400, 129 140 248) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500, 99 102 241) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600, 79 70 229) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700, 67 56 202) / <alpha-value>)',
          800: 'rgb(var(--color-brand-800, 55 48 163) / <alpha-value>)',
          900: 'rgb(var(--color-brand-900, 49 46 129) / <alpha-value>)',
          950: 'rgb(var(--color-brand-950, 30 27 75) / <alpha-value>)',
        },
        navy: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          850: '#111827', // Deep slate navy surface
          900: '#0b0f19', // 2026 Deep OLED Surface
          950: '#070a12', // 2026 True Dark Void Background
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.15)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'glow-indigo': '0 0 25px -4px rgba(99, 102, 241, 0.4)',
        'glow-emerald': '0 0 25px -4px rgba(16, 185, 129, 0.4)',
        'glow-rose': '0 0 25px -4px rgba(244, 63, 94, 0.4)',
        'subtle': '0 2px 10px -2px rgba(15, 23, 42, 0.06), 0 1px 3px -1px rgba(15, 23, 42, 0.04)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        }
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'pulse-subtle': 'pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float-slow 4s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};

export default config;
