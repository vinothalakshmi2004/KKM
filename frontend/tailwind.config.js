const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name) =>
  Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, v(`${name}-${n}`)]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  // ThemeContext toggles .dark on <html>
  darkMode: 'class',
  theme: {
    extend: {
      // Brand palette, defined once as CSS variables in src/index.css (:root)
      colors: {
        night: { DEFAULT: v('night'), 800: v('night-800'), 700: v('night-700') },
        cream: { DEFAULT: v('cream'), 100: v('cream-100') },
        gold: { DEFAULT: v('gold'), 600: v('gold-600'), 300: v('gold-300') },
        // ink: website text colours + neutral scale for the admin portal
        ink: { DEFAULT: v('ink'), soft: v('ink-soft'), ...scale('ink') },
        // brand: gold scale for the admin portal (500 = website gold)
        brand: scale('brand'),
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
