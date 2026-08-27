/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fdfcf9',
          100: '#faf8f2',
          200: '#f4f0e6',
          300: '#ece5d4',
        },
        sand: {
          50: '#f7f3ea',
          100: '#efe7d6',
          200: '#e3d6bd',
          300: '#d3bf9c',
          400: '#c0a87d',
        },
        warmgray: {
          50: '#f5f3f0',
          100: '#e8e4df',
          200: '#d4cec5',
          300: '#b8afa3',
          400: '#968b7d',
          500: '#756b5e',
          600: '#5c5347',
        },
        ink: {
          50: '#f6f5f4',
          100: '#e5e3e0',
          200: '#c9c5c0',
          300: '#a09a93',
          400: '#6f6862',
          500: '#4a443f',
          600: '#322e2a',
          700: '#221f1c',
          800: '#161412',
          900: '#0c0b0a',
        },
        terracotta: {
          50: '#fbf3ef',
          100: '#f5e1d6',
          200: '#ebc4af',
          300: '#dd9f7d',
          400: '#cc7d54',
          500: '#b85f33',
          600: '#9c4a26',
          700: '#7a3a20',
          800: '#5c2d1b',
        },
        gold: {
          50: '#fbf6ec',
          100: '#f5e9cf',
          200: '#ebd29c',
          300: '#dcb56b',
          400: '#c8973f',
          500: '#a87c2c',
        },
        sage: {
          50: '#f3f6f0',
          100: '#e2ebdc',
          200: '#c4d6ba',
          300: '#9bbb8c',
          400: '#75976a',
          500: '#5a7a50',
          600: '#465e3e',
        },
        amber: {
          50: '#fbf5ea',
          100: '#f7e9cf',
          200: '#ecd29c',
          300: '#dcb56b',
          400: '#c8973f',
          500: '#a87c2c',
        },
        brick: {
          50: '#fbf0ee',
          100: '#f5dad6',
          200: '#e9b0a8',
          300: '#d8857a',
          400: '#c45a4d',
          500: '#a23f34',
          600: '#7e2f27',
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'reading': ['1.125rem', { lineHeight: '1.8' }],
      },
      borderRadius: {
        'xl2': '1.25rem',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(34, 31, 28, 0.04), 0 1px 2px rgba(34, 31, 28, 0.03)',
        'card': '0 2px 8px rgba(34, 31, 28, 0.05), 0 1px 3px rgba(34, 31, 28, 0.03)',
        'lifted': '0 8px 24px rgba(34, 31, 28, 0.08), 0 2px 8px rgba(34, 31, 28, 0.04)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-soft': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'expand': {
          '0%': { opacity: '0', maxHeight: '0' },
          '100%': { opacity: '1', maxHeight: '1000px' },
        },
        'flip-front': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        'flip-back': {
          '0%': { transform: 'rotateY(180deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        'gentle-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-6px) rotate(1deg)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.9' },
          '50%': { transform: 'scale(1.1)', opacity: '0' },
          '100%': { transform: 'scale(1.1)', opacity: '0' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'fade-in-soft': 'fade-in-soft 0.4s ease-out forwards',
        'slide-in': 'slide-in 0.4s ease-out forwards',
        'expand': 'expand 0.35s ease-out forwards',
        'gentle-pulse': 'gentle-pulse 2s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'float-slow': 'float-slow 5s ease-in-out infinite',
        'shimmer': 'shimmer 2.2s linear infinite',
        'pulse-ring': 'pulse-ring 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.6s ease-out forwards',
        'scale-in': 'scale-in 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
