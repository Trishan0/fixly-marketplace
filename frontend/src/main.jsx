import React from 'react'
import ReactDOM from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { emitToast } from './lib/toastBus'
import { errorMessage, errorStatus } from './lib/errors'
import { initMonitoring, track } from './lib/monitoring'
import './index.css'

const queryClient = new QueryClient({
  // Any mutation without its own onError still tells the user it failed.
  // A mutation can opt out with `meta: { silentError: true }`.
  mutationCache: new MutationCache({
    // Funnel analytics: a mutation opts in with meta.track (event name) and
    // optionally meta.trackProps(variables, data) for non-personal details.
    onSuccess: (data, variables, _context, mutation) => {
      const event = mutation.meta?.track
      if (event) track(event, mutation.meta.trackProps?.(variables, data) || {})
    },
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError || mutation.meta?.silentError) return
      if (errorStatus(error) === 401) return
      emitToast({ title: 'That did not work', description: errorMessage(error), variant: 'error' })
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = errorStatus(error)
        if (status && status >= 400 && status < 500) return false
        return failureCount < 1
      },
      staleTime: 30000,
    },
  },
})

initMonitoring()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
