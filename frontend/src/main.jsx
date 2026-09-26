import React from 'react'
import ReactDOM from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { emitToast } from './lib/toastBus'
import { errorMessage, errorStatus } from './lib/errors'
import './index.css'

const queryClient = new QueryClient({
  // Any mutation without its own onError still tells the user it failed.
  // A mutation can opt out with `meta: { silentError: true }`.
  mutationCache: new MutationCache({
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
