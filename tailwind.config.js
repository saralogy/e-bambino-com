/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — Berk, 2026
        ink: {
          DEFAULT: '#142030', // primary dark: headlines, footer, dark sections
          900: '#0d1622',
          800: '#142030',
          700: '#1E3442',
        },
        blush: {
          DEFAULT: '#FF5C8D', // accent: buttons, links, highlights
          50: '#FFF1F5',
          100: '#FFE1EB',
          200: '#FFC4D8',
          400: '#FF8FB0',
          500: '#FF5C8D',
          600: '#F03D76',
          700: '#732553', // deep plum, paired with blush for contrast
        },
        slate: {
          DEFAULT: '#1E3442',
          800: '#1E3442',
          700: '#264253',
        },
        mist: {
          DEFAULT: '#85A3B2', // muted blue-grey: borders, meta, secondary text
          100: '#EAF0F3',
          200: '#D6E1E7',
          300: '#B9CDD6',
          400: '#85A3B2',
          500: '#6B8B9C',
          600: '#54707F',
          700: '#3E5663',
        },
        plum: {
          DEFAULT: '#732553',
          600: '#732553',
          700: '#5C1D43',
        },
        sand: {
          DEFAULT: '#E9D8C8', // warm cream: section backgrounds, soft fills
          50: '#FDFAF6',
          100: '#F7EFE6',
          200: '#E9D8C8',
          300: '#DCC3AD',
          400: '#C9A88A',
        },
        paper: '#FFFFFF',
      },

      fontFamily: {
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        sans: ['Karla', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Mobile-first: the small end is what most readers see first.
        'display-sm': ['2.25rem', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'display-md': ['2.75rem', { lineHeight: '1.06', letterSpacing: '-0.02em' }],
        'display-lg': ['3.5rem', { lineHeight: '1.04', letterSpacing: '-0.025em' }],
        'display-xl': ['4.25rem', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
      },

      borderRadius: {
        card: '1.125rem',
        pill: '999px',
      },

      boxShadow: {
        soft: '0 1px 2px rgba(20, 32, 48, 0.04), 0 8px 24px -12px rgba(20, 32, 48, 0.16)',
        lift: '0 2px 4px rgba(20, 32, 48, 0.05), 0 18px 40px -20px rgba(115, 37, 83, 0.28)',
      },

      backgroundImage: {
        // Smooth gradients from the brand palette — warm cream into blush,
        // and a deep ink-to-slate for dark sections.
        'warm-wash': 'linear-gradient(135deg, #FDFAF6 0%, #F7EFE6 45%, #FFE1EB 100%)',
        dawn: 'linear-gradient(160deg, #FFE1EB 0%, #F7EFE6 55%, #EAF0F3 100%)',
        deep: 'linear-gradient(150deg, #142030 0%, #1E3442 100%)',
        'plum-deep': 'linear-gradient(150deg, #732553 0%, #142030 100%)',
        'line-fade':
          'linear-gradient(90deg, rgba(255,92,141,0) 0%, #FF5C8D 50%, rgba(255,92,141,0) 100%)',
      },

      maxWidth: {
        prose: '68ch',
      },

      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};