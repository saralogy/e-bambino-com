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

        // ---- e-bambino design system v1.0 (commerce layer) ----
        // Named to avoid colliding with the editorial palette above:
        //   night = DS "Ink", fog = DS "Mist". Use these for shop/aggregator UI.
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
      },

      fontFamily: {
        // Commerce layer. Bricolage Grotesque + Hanken Grotesk must be self-hosted
        // in public/fonts (no Google CDN, see Base.astro) before these render.
        headline: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        ui: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        sans: ['Karla', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Mobile-first: the small end is what most readers see first.
        'display-sm': ['2.25rem', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'display-md': ['2.75rem', { lineHeight: '1.06', letterSpacing: '-0.02em' }],
        'display-lg': ['3.5rem', { lineHeight: '1.04', letterSpacing: '-0.025em' }],
        'display-xl': ['4.25rem', { lineHeight: '1.02', letterSpacing: '-0.03em' }],

        // e-bambino DS type scale (desktop sizes; step down one level on mobile)
        'ds-display': ['4.5rem', { lineHeight: '0.95', letterSpacing: '-0.035em', fontWeight: '800' }],
        'ds-h1': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'ds-h2': ['2.125rem', { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '700' }],
        'ds-h3': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],
        'ds-price': ['2.25rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'ds-price-sm': ['1.75rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'ds-body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'ds-body': ['1rem', { lineHeight: '1.6' }],
        'ds-label': ['0.875rem', { lineHeight: '1.4', fontWeight: '600' }],
        'ds-overline': ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.08em', fontWeight: '700' }],
      },

      borderRadius: {
        card: '1.125rem',
        pill: '999px',
        // e-bambino DS radii
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
        soft: '0 1px 2px rgba(20, 32, 48, 0.04), 0 8px 24px -12px rgba(20, 32, 48, 0.16)',
        lift: '0 2px 4px rgba(20, 32, 48, 0.05), 0 18px 40px -20px rgba(115, 37, 83, 0.28)',
        // e-bambino DS elevation (1 = card, 2 = overlay)
        'ds-card': '0 2px 8px rgba(12, 16, 32, 0.10)',
        'ds-overlay': '0 12px 32px rgba(12, 16, 32, 0.18)',
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
        'photo-stripes':
          'repeating-linear-gradient(135deg, #E3E5EE 0 12px, #F2F3F8 12px 24px)',
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
        reveal: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};