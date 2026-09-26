import React from 'react'
import { cn } from '../../lib/utils'

// Plain semantic table styled to the design system.
export function Table({ className, children, ...props }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props}>{children}</table>
    </div>
  )
}

export function Th({ className, align = 'left', children, ...props }) {
  return (
    <th scope="col" className={cn('h-9 whitespace-nowrap border-b border-line bg-subtle/60 px-4 text-xs font-medium text-fg-muted', align === 'right' ? 'text-right' : 'text-left', className)} {...props}>
      {children}
    </th>
  )
}

export function Td({ className, align = 'left', children, ...props }) {
  return (
    <td className={cn('border-b border-line px-4 py-3 align-middle text-fg', align === 'right' ? 'text-right tabular-nums' : 'text-left', className)} {...props}>
      {children}
    </td>
  )
}

/** A row that behaves as one link: the first cell holds the real anchor. */
export function RowLink({ children, className }) {
  return <tr className={cn('group relative transition-colors hover:bg-subtle/60 [&:last-child>td]:border-b-0', className)}>{children}</tr>
}
