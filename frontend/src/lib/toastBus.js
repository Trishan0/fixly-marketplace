// Lets code outside React (the QueryClient, the API client) raise toasts.
// ToastProvider subscribes on mount; events fired before that are dropped.
const listeners = new Set()

export function emitToast(toast) {
  listeners.forEach(listener => listener(toast))
}

export function subscribeToToasts(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
