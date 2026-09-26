import React from 'react'
import { Link } from 'react-router-dom'
import { buttonClasses } from './buttonClasses'

/** Button, or a router link styled as one when `to` is given. */
export function Button({ variant, size, className, loading = false, disabled, to, type = 'button', children, ...props }) {
  const classes = buttonClasses({ variant, size, className })
  const content = (
    <>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </>
  )
  if (to) {
    return <Link to={to} className={classes} {...props}>{content}</Link>
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  )
}
