import { cn } from '../../lib/utils'

const VARIANTS = {
  primary: 'bg-brand text-brand-on hover:bg-brand-hover shadow-brand',
  secondary: 'border border-line bg-surface text-fg hover:border-line-strong hover:bg-subtle shadow-xs',
  // Literal colours: the legacy dark-mode layer force-darkens `bg-white`.
  'on-brand': 'bg-[#fff] text-[#0369a1] hover:bg-[#f0f9ff] shadow-sm',
  'on-brand-ghost': 'bg-white/10 text-white ring-1 ring-inset ring-white/25 hover:bg-white/20',
  ghost: 'text-fg-muted hover:bg-subtle hover:text-fg',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-xs',
  'danger-ghost': 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40',
}

// 36px on desktop; 44px on touch screens so targets stay easy to hit.
const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 [@media(pointer:coarse)]:h-10',
  md: 'h-9 px-3.5 text-sm gap-2 [@media(pointer:coarse)]:h-11',
  lg: 'h-10 px-4 text-sm gap-2 [@media(pointer:coarse)]:h-12',
  icon: 'h-9 w-9 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11',
}

export function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-control font-semibold transition-all active:translate-y-px',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}
