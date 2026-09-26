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
    <th scope="col" className={cn('h-10 whitespace-nowrap border-b border-line bg-subtle/70 px-4 text-xs font-semibold text-fg-subtle first:pl-5 last:pr-5', align === 'right' ? 'text-right' : 'text-left', className)} {...props}>
      {children}
    </th>
  )
}

export function Td({ className, align = 'left', children, ...props }) {
  return (
    <td className={cn('border-b border-line px-4 py-3.5 align-middle text-fg first:pl-5 last:pr-5', align === 'right' ? 'text-right tabular-nums' : 'text-left', className)} {...props}>
      {children}
    </td>
  )
}

/** A row that behaves as one link: the first cell holds the real anchor. */
export function RowLink({ children, className }) {
  return <tr className={cn('group relative transition-colors hover:bg-brand-subtle/50 [&:last-child>td]:border-b-0', className)}>{children}</tr>
}
