import React from 'react'
import { cn } from '../../lib/utils'
import { TONES } from '../../lib/tones'

const SIZES = { sm: 'h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4', md: 'h-10 w-10 rounded-[10px] [&>svg]:h-5 [&>svg]:w-5' }

export function IconChip({ icon: Icon, tone = 'sky', size = 'md', className }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center ring-1 ring-inset', TONES[tone]?.chip, SIZES[size], className)} aria-hidden="true">
      <Icon />
    </span>
  )
}
