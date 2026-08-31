import React from 'react'

/**
 * The supplied Fixly artwork is used everywhere the product identity appears.
 * `onDark` selects the white wordmark for dark surfaces; compact uses the
 * supplied mark-only PNG for navigation contexts where the wordmark does not fit.
 */
export function BrandLogo({ compact = false, onDark = false, className = '', alt = 'Fixly' }) {
  if (compact) {
    return <img src="/fixly-mark-192.png" alt={alt} className={`object-contain ${className}`} />
  }

  if (onDark) {
    return <img src="/fixly-logo-dark.svg" alt={alt} className={`block h-full w-full object-contain ${className}`} />
  }

  return (
    <span className={`block ${className}`}>
      <img src="/fixly-logo.svg" alt={alt} className="block h-full w-full object-contain dark:hidden" />
      <img src="/fixly-logo-dark.svg" alt={alt} className="hidden h-full w-full object-contain dark:block" />
    </span>
  )
}
