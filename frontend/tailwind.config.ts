import type { Config } from 'tailwindcss';

// Dark, book-themed palette (ink backgrounds, parchment text, amber accent).
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0d12',
          900: '#12151c',
          800: '#1a1f2b',
          700: '#262d3d',
          600: '#364055',
        },
        parchment: {
          50: '#faf6ee',
          100: '#f1e9d8',
          200: '#e0d3b8',
          400: '#a89c82',
        },
        accent: {
          400: '#f2b84b',
          500: '#e09f1f',
          600: '#c0820f',
        },
        danger: '#e5484d',
        success: '#3dd68c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
