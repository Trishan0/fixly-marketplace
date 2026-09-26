import React from 'react'
import { cn, getInitials } from '../../lib/utils'
import { TONES, avatarTone } from '../../lib/tones'

const SIZES = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-sm' }

export function PersonAvatar({ name, src, size = 'sm', className }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-inset', TONES[avatarTone(name)].chip, SIZES[size], className)}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : getInitials(name)}
    </span>
  )
}
