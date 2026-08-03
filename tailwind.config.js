/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f4f6ef',
          100: '#e8ecd9',
          200: '#d2dab7',
          300: '#b8c58f',
          400: '#9cae67',
          500: '#81954a',
          600: '#6a7b3a',
          700: '#4D5D2F',
          800: '#3f4d27',
          900: '#333f20',
        },
        accent: {
          50:  '#fff7e4',
          100: '#fdeec9',
          200: '#f9dda0',
          300: '#f4c96f',
          400: '#ebb33e',
          500: '#D4A017',
          600: '#b88513',
          700: '#95680f',
          800: '#77530c',
          900: '#5e420a',
        },
        cream: '#FAFAF9',
      },
    },
  },
  plugins: [],
}

