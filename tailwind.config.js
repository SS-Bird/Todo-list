/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      width: {
        '100': '400px', // Standard column width
      },
      colors: {
        // Custom color palette matching your current dark theme
        slate: {
          950: '#0a0f1a', // page background
          900: '#0b1220', // surface level 1 (columns)
          800: '#0f172a', // surface level 2 (cards)
          700: '#1f2937', // border primary
          600: '#374151', // border secondary
          500: '#6b7280', // text muted
          400: '#9ca3af', // text secondary
          300: '#d1d5db', // text primary
          200: '#e5e7eb', // text high contrast
        },
        // Status colors
        status: {
          gray: {
            50: '#f8fafc',
            100: '#f1f5f9',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          },
          blue: {
            50: '#eff6ff',
            100: '#dbeafe',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
          },
          green: {
            50: '#f0fdf4',
            100: '#dcfce7',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d',
            800: '#166534',
            900: '#14532d',
          }
        }
      },
      boxShadow: {
        'card': '0 1px 0 rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.15)',
        'card-hover': '0 2px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.16s cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
