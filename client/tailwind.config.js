/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0D3040',
          mid: '#1A5276',
          light: '#D6EAF8',
        },
        text: '#4A4A4A',
      },
    },
  },
  plugins: [],
};
