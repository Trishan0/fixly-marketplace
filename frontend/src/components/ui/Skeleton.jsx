import React from 'react'
import { cn } from '../../lib/utils'

export function Skeleton({ className }) {
  return <span className={cn('block animate-pulse rounded-control bg-subtle', className)} aria-hidden="true" />
}
