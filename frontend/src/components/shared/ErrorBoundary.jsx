import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { captureError } from '../../lib/monitoring'

// Catches render errors so one broken screen doesn't blank the whole app.
// `resetKey` (the current path) clears the error when the user navigates.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info?.componentStack)
    captureError(error, { componentStack: info?.componentStack })
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return <ErrorFallback onRetry={() => this.setState({ error: null })} />
  }
}

export function ErrorFallback({ onRetry, title = 'Something went wrong on this page', description = 'The rest of Fixly is still working. Try again, or go back to your dashboard.' }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        <p className="mt-1.5 text-sm leading-6 text-fg-muted">{description}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {onRetry && (
            <button type="button" onClick={onRetry} className="fixly-btn-primary gap-2 text-sm">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          )}
          <a href="/dashboard" className="fixly-btn-secondary text-sm">Go to dashboard</a>
        </div>
      </div>
    </div>
  )
}
