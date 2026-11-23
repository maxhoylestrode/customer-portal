/** @type {import('tailwindcss').Config} */
import defaultColors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// ─────────────────────────────────────────────────────────────
// Theme tokens
//
// Every colour the app uses is a CSS variable, so the existing utility
// classes (bg-white, text-gray-500, bg-red-50, text-brand-700 ...) flip
// between the light and dark theme without touching the pages. The theme
// is picked by <html data-theme="dark|light"> (see index.html + useTheme).
//
// Text, background and border colours get separate variables where the two
// themes need them to move differently: in dark mode `text-gray-900` has to
// become near-white while `bg-gray-900` stays dark, and `bg-brand-700` is a
// blue button fill while `text-brand-700` is a heading colour.
// ─────────────────────────────────────────────────────────────

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Status / accent palettes used by badges, alerts and charts
const CHROMATIC = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];

// Dark surfaces the tinted backgrounds are mixed onto
const DARK_SURFACE = '#18181b';

// Neutral greys: zinc in light mode (no blue cast), a hand-tuned scale in dark
const GRAY = {
  light: defaultColors.zinc,
  // used for text, borders, rings, dividers
  darkFg: {
    50: '#1f1f23', 100: '#27272b', 200: '#2e2e33', 300: '#3a3a40', 400: '#71717a',
    500: '#9a9aa2', 600: '#b4b4bb', 700: '#d0d0d5', 800: '#e2e2e6', 900: '#ededf0', 950: '#f7f7f8',
  },
  // used for fills
  darkBg: {
    50: '#1d1d21', 100: '#232328', 200: '#2c2c31', 300: '#3a3a40', 400: '#52525a',
    500: '#6b6b73', 600: '#3f3f46', 700: '#2e2e33', 800: '#27272a', 900: '#1f1f23', 950: '#141416',
  },
};

// The portal's blue. Light mode keeps the original navy scale; dark mode
// lifts the same hue so it reads on a near-black background.
const BRAND = {
  light: {
    50: '#eef6fb', 100: '#D6EAF8', 200: '#b6d6ee', 300: '#86b8de', 400: '#4f8fc4',
    500: '#2a6fa5', 600: '#1A5276', 700: '#0D3040', 800: '#0a2733', 900: '#081e28', 950: '#05131a',
  },
  darkText: {
    50: '#eef6fb', 100: '#D6EAF8', 200: '#b6d6ee', 300: '#9cc8ec', 400: '#7db8e8',
    500: '#6aaee6', 600: '#7db8e8', 700: '#eef2f6', 800: '#eef2f6', 900: '#f5f7f9', 950: '#f5f7f9',
  },
  darkBg: {
    50: '#141f29', 100: '#172838', 200: '#1d3447', 300: '#25465f', 400: '#3a7cb5',
    500: '#3a86c8', 600: '#3b8bd0', 700: '#2f78b8', 800: '#26659c', 900: '#1d4f7a', 950: '#163c5c',
  },
  darkBorder: {
    50: '#1d2f3f', 100: '#223a4f', 200: '#284a63', 300: '#2f5a7a', 400: '#3a7cb5',
    500: '#3b84c6', 600: '#4a94d4', 700: '#3b84c6', 800: '#2f78b8', 900: '#26659c', 950: '#1d4f7a',
  },
};

// Semantic tokens (bg-canvas, bg-sidebar, border-line ...)
const SEMANTIC = {
  light: {
    canvas: '#f7f7f8', surface: '#ffffff', sidebar: '#fbfbfc', line: '#e4e4e7',
    'line-strong': '#d4d4d8', fg: '#18181b', muted: '#71717a',
  },
  dark: {
    canvas: '#111113', surface: DARK_SURFACE, sidebar: '#141416', line: '#27272b',
    'line-strong': '#3a3a40', fg: '#ededf0', muted: '#9a9aa2',
  },
};

// ── helpers ──────────────────────────────────────────────────
function toRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgb = (hex) => toRgb(hex).join(' ');
function mix(hex, onto, amount) {
  const a = toRgb(hex);
  const b = toRgb(onto);
  return a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount))).join(' ');
}
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (prefix) => Object.fromEntries(SHADES.map((s) => [s, v(`${prefix}-${s}`)]));

// In dark mode text/borders flip to the opposite end of the palette...
const DARK_FG_SHADE = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 500, 500: 400, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 };
// ...light fills become a faint tint of the colour on the dark surface,
// and solid fills (400+) stay as they are.
const DARK_TINT = { 50: 0.1, 100: 0.16, 200: 0.24, 300: 0.34 };

function themeVars() {
  const light = {};
  const dark = {};

  for (const name of CHROMATIC) {
    const pal = defaultColors[name];
    for (const s of SHADES) {
      light[`--c-${name}-${s}`] = rgb(pal[s]);
      light[`--bg-${name}-${s}`] = rgb(pal[s]);
      dark[`--c-${name}-${s}`] = rgb(pal[DARK_FG_SHADE[s]]);
      dark[`--bg-${name}-${s}`] = DARK_TINT[s] ? mix(pal[500], DARK_SURFACE, DARK_TINT[s]) : rgb(pal[s]);
    }
  }

  for (const s of SHADES) {
    light[`--c-gray-${s}`] = rgb(GRAY.light[s]);
    light[`--bg-gray-${s}`] = rgb(GRAY.light[s]);
    dark[`--c-gray-${s}`] = rgb(GRAY.darkFg[s]);
    dark[`--bg-gray-${s}`] = rgb(GRAY.darkBg[s]);

    for (const k of ['text', 'bg', 'border']) light[`--brand-${k}-${s}`] = rgb(BRAND.light[s]);
    dark[`--brand-text-${s}`] = rgb(BRAND.darkText[s]);
    dark[`--brand-bg-${s}`] = rgb(BRAND.darkBg[s]);
    dark[`--brand-border-${s}`] = rgb(BRAND.darkBorder[s]);
  }

  for (const [k, hex] of Object.entries(SEMANTIC.light)) light[`--${k}`] = rgb(hex);
  for (const [k, hex] of Object.entries(SEMANTIC.dark)) dark[`--${k}`] = rgb(hex);
  light['--surface-white'] = '255 255 255';
  dark['--surface-white'] = rgb(DARK_SURFACE);

  return { light, dark };
}

// ── colour maps handed to Tailwind ───────────────────────────
const fgColors = { gray: scale('c-gray'), brand: scale('brand-border') };
const bgColors = { gray: scale('bg-gray'), brand: scale('brand-bg'), white: v('surface-white') };
for (const name of CHROMATIC) {
  fgColors[name] = scale(`c-${name}`);
  bgColors[name] = scale(`bg-${name}`);
}
const semantic = Object.fromEntries(Object.keys(SEMANTIC.light).map((k) => [k, v(k)]));

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Default for every utility that takes a colour (ring, divide, fill, gradients...)
      colors: { ...fgColors, ...semantic, text: v('c-gray-700') },
      textColor: { brand: scale('brand-text') },
      backgroundColor: bgColors,
      borderColor: { gray: scale('c-gray'), brand: scale('brand-border') },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      const { light, dark } = themeVars();
      addBase({
        ':root': { ...light, colorScheme: 'light' },
        ':root[data-theme="dark"]': { ...dark, colorScheme: 'dark' },
      });
    }),
  ],
};
