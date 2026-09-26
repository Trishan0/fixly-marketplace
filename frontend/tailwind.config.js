/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // Design system tokens - see --ds-* in index.css
        canvas: 'hsl(var(--ds-canvas))',
        surface: 'hsl(var(--ds-surface))',
        subtle: 'hsl(var(--ds-subtle))',
        line: {
          DEFAULT: 'hsl(var(--ds-line))',
          strong: 'hsl(var(--ds-line-strong))',
        },
        fg: {
          DEFAULT: 'hsl(var(--ds-fg))',
          muted: 'hsl(var(--ds-fg-muted))',
          subtle: 'hsl(var(--ds-fg-subtle))',
        },
        brand: {
          DEFAULT: 'hsl(var(--ds-brand))',
          hover: 'hsl(var(--ds-brand-hover))',
          subtle: 'hsl(var(--ds-brand-subtle))',
          text: 'hsl(var(--ds-brand-text))',
          on: 'hsl(var(--ds-on-brand))',
        },
      },
      boxShadow: {
        // Only for things that float above the page (menus, dialogs, toasts).
        overlay: '0 8px 24px -6px rgb(15 23 42 / 0.16), 0 2px 6px -2px rgb(15 23 42 / 0.08)',
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
      },
      borderRadius: {
        // Design system radii: controls, cards, overlays.
        control: '6px',
        card: '8px',
        overlay: '12px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
