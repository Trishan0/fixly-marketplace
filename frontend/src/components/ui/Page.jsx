import React from 'react'
import { cn } from '../../lib/utils'

const WIDTHS = { wide: 'max-w-[1200px]', default: 'max-w-5xl', narrow: 'max-w-3xl' }

/** Standard page container: consistent width and padding on every screen. */
export function Page({ width = 'wide', className, children, ...props }) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8', WIDTHS[width], className)} {...props}>
      {children}
    </div>
  )
}
