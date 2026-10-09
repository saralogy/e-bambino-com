/** @type {import('tailwindcss').Config} */
// e-bambino design system v1.0
// Three signals on a calm night ground:
//   ultramarine navigates, mandarin converts, limone flags a deal.
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ultramarine: {
          DEFAULT: '#2438F5', // brand, navigation, links, focus. White text: 7.1:1
          50: '#EEF0FF',
          100: '#DCE0FF',
          300: '#8E99FF',
          500: '#2438F5',
          600: '#1B2BD0',
          700: '#1521A3',
          900: '#0B1259',
        },
        mandarin: {
          DEFAULT: '#FF6A1A', // buy / conversion only. Text on it must be night-900 (6.6:1); white fails
          50: '#FFF1E8',
          100: '#FFE0CC',
          300: '#FFA672',
          500: '#FF6A1A',
          600: '#E5520A', // hover; still night-900 text
          700: '#B83F05',
          900: '#5C1F00',
        },
        limone: {
          DEFAULT: '#D9F24A', // deals, best price, new. A surface, never text on white
          50: '#F8FDDF',
          100: '#F0FBA8',
          300: '#E6F872',
          500: '#D9F24A',
          600: '#B9D326',
          700: '#8FA10F',
          900: '#3F4A00',
        },
        night: {
          DEFAULT: '#0C1020', // text, dark surfaces
          900: '#0C1020',
          800: '#151A30',
          700: '#2A3050',
          500: '#5B627F', // muted text on white: 6.0:1
        },
        fog: {
          DEFAULT: '#F2F3F8', // page sections, inputs
          50: '#F2F3F8',
          100: '#E3E5EE', // hairlines
          300: '#A4A9BD',
          field: '#8A90A8', // input borders, 3.3:1 on white
        },
        success: '#0A7A4C', // white text 5.4:1
        warning: '#F5B301', // night-900 text only
        danger: '#D4261F', // white text 5.1:1
        paper: '#FFFFFF',
      },

      fontFamily: {
        // Self-hosted in public/fonts (no Google CDN, see Base.astro).
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Mobile-first: the small end is what most readers see first.
        'display-sm': ['2.25rem', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-md': ['2.875rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        'display-lg': ['3.75rem', { lineHeight: '0.97', letterSpacing: '-0.035em' }],
        'display-xl': ['4.5rem', { lineHeight: '0.95', letterSpacing: '-0.035em' }],

        // Commerce scale (desktop sizes; step down one level on mobile)
        'ds-h1': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'ds-h2': ['2.125rem', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        'ds-h3': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        'ds-price': ['2.25rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'ds-price-sm': ['1.75rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'ds-overline': ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.08em' }],
      },

      borderRadius: {
        card: '1.125rem',
        pill: '999px',
        'ds-sm': '0.5rem', // chips, inputs
        'ds-md': '0.875rem', // cards, buttons
        'ds-lg': '1.5rem', // panels, hero
      },

      // Touch targets: nothing interactive under 44px.
      minHeight: {
        'tap-s': '2.75rem',
        'tap-m': '3.25rem',
        'tap-l': '3.75rem',
      },
      minWidth: {
        tap: '2.75rem',
      },

      boxShadow: {
        soft: '0 2px 8px rgba(12, 16, 32, 0.10)', // DS elevation 1: card
        lift: '0 12px 32px rgba(12, 16, 32, 0.18)', // DS elevation 2: overlay
      },

      ringColor: {
        focus: '#2438F5',
      },

      transitionDuration: {
        tap: '120ms',
        lift: '180ms',
        reveal: '220ms',
        price: '400ms',
      },

      backgroundImage: {
        // Placeholder for missing product photos
        'photo-stripes': 'repeating-linear-gradient(135deg, #E3E5EE 0 12px, #F2F3F8 12px 24px)',
        wash: 'linear-gradient(135deg, #FFFFFF 0%, #F2F3F8 100%)',
        deep: 'linear-gradient(150deg, #0C1020 0%, #151A30 100%)',
        'ultra-deep': 'linear-gradient(150deg, #1521A3 0%, #0C1020 100%)',
        'line-fade':
          'linear-gradient(90deg, rgba(36,56,245,0) 0%, #2438F5 50%, rgba(36,56,245,0) 100%)',
      },

      maxWidth: {
        prose: '68ch',
      },

      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
        reveal: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
