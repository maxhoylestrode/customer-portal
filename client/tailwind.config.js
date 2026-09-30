/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Client-portal palette
          dark: '#0D3040',
          mid: '#1A5276',
          light: '#D6EAF8',
          // Staff-portal palette (dark-themed CRM section)
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#111827',
          light: '#1f2937',
          lighter: '#374151',
        },
        text: '#4A4A4A',
      },
    },
  },
  plugins: [],
};
