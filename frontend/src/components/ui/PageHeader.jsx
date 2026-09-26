import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/** Standard page heading: optional breadcrumbs, title, description, actions. */
export function PageHeader({ title, description, actions, breadcrumbs }) {
  return (
    <header className="mb-6">
      {breadcrumbs?.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-[13px] text-fg-muted">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />}
                {crumb.to ? <Link to={crumb.to} className="hover:text-fg">{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
