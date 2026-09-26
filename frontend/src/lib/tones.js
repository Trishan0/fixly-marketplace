import {
  Droplets, Flame, Hammer, HardHat, LayoutGrid, Paintbrush, Snowflake, Sparkles, TreePine, Wrench, Zap,
} from 'lucide-react'

// One harmonised palette: the brand sky, its neighbours (indigo, teal,
// violet) and three meaning colours (emerald, amber, rose). Every tinted
// surface uses the same recipe - a pale fill, a matching ring and a strong
// foreground - so colours sit together instead of competing.
export const TONES = {
  sky: { chip: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20', pill: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20', dot: 'bg-sky-500' },
  indigo: { chip: 'bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20', pill: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20', dot: 'bg-indigo-500' },
  teal: { chip: 'bg-teal-50 text-teal-600 ring-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20', pill: 'bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/20', dot: 'bg-teal-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20', pill: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20', dot: 'bg-violet-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20', dot: 'bg-emerald-500' },
  amber: { chip: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20', pill: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20', dot: 'bg-amber-500' },
  orange: { chip: 'bg-orange-50 text-orange-600 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20', pill: 'bg-orange-50 text-orange-700 ring-orange-600/15 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20', dot: 'bg-orange-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20', pill: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20', dot: 'bg-rose-500' },
  slate: { chip: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/20', pill: 'bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20', dot: 'bg-slate-400' },
}

const CATEGORY_STYLES = {
  Plumbing: { icon: Droplets, tone: 'sky' },
  Electrical: { icon: Zap, tone: 'amber' },
  Carpentry: { icon: Hammer, tone: 'orange' },
  Cleaning: { icon: Sparkles, tone: 'emerald' },
  Painting: { icon: Paintbrush, tone: 'rose' },
  Tiling: { icon: LayoutGrid, tone: 'indigo' },
  Welding: { icon: Flame, tone: 'orange' },
  'AC Repair': { icon: Snowflake, tone: 'teal' },
  Landscaping: { icon: TreePine, tone: 'emerald' },
  'General Labour': { icon: HardHat, tone: 'slate' },
}

export function categoryStyle(name) {
  return CATEGORY_STYLES[name] || { icon: Wrench, tone: 'slate' }
}

const AVATAR_TONES = ['sky', 'indigo', 'teal', 'violet', 'emerald', 'amber', 'rose', 'orange']

/** A stable colour for a person, so the same name always looks the same. */
export function avatarTone(name = '') {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}
