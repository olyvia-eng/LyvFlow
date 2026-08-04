/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F8FAFC',
          100: '#E2E8F0',
          200: '#CBD5E1',
          300: '#94A3B8',
          400: '#64748B',
          500: '#475569',
          600: '#334155',
          700: '#1E293B',
          800: '#111827',
          900: '#0F172A',
        },
        accent: {
          50:  '#EEF4E3',
          100: '#E3EDCF',
          200: '#CADFA2',
          300: '#AECB6E',
          400: '#84A83D',
          500: '#6B8E23',
          600: '#59791D',
          700: '#4A6418',
          800: '#3B4F13',
          900: '#2E3D0F',
        },
        cream: '#F8FAFC',
      },
    },
  },
  plugins: [],
}

