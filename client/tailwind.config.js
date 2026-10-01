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
          // Numeric scale used by the staff pages, built around the client
          // palette above (700 = dark, 600 = mid, 100 = light) so both
          // sections share one look.
          50: '#eef6fb',
          100: '#D6EAF8',
          200: '#b6d6ee',
          300: '#86b8de',
          400: '#4f8fc4',
          500: '#2a6fa5',
          600: '#1A5276',
          700: '#0D3040',
          800: '#0a2733',
          900: '#081e28',
          950: '#05131a',
        },
        text: '#4A4A4A',
      },
    },
  },
  plugins: [],
};
