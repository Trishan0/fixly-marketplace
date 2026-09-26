// Product analytics (PostHog) and error reporting (Sentry).
//
// Both are optional: each SDK is only downloaded when its key is configured
// (VITE_POSTHOG_KEY, VITE_SENTRY_DSN), so local development and forks send
// nothing. Only a user's id and role are ever attached - never names, emails
// or phone numbers.

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com'
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
const RELEASE = import.meta.env.VITE_RELEASE || undefined

let posthog = null
let sentry = null
let started = false
const queue = []

export function initMonitoring() {
  if (started || typeof window === 'undefined') return
  started = true

  if (SENTRY_DSN) {
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        release: RELEASE,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        tracesSampleRate: 0,
      })
      sentry = Sentry
    }).catch(() => {})
  }

  if (POSTHOG_KEY) {
    import('posthog-js').then(({ default: client }) => {
      client.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        disable_surveys: true,
        respect_dnt: true,
        persistence: 'localStorage',
      })
      posthog = client
      queue.splice(0).forEach(([method, args]) => client[method](...args))
    }).catch(() => {})
  }
}

function call(method, ...args) {
  if (!POSTHOG_KEY) return
  if (posthog) posthog[method](...args)
  else queue.push([method, args])
}

/** Record a product event. Keep properties free of personal data. */
export function track(event, properties = {}) {
  call('capture', event, properties)
}

export function trackPageview(path) {
  call('capture', '$pageview', { $current_url: `${window.location.origin}${path}` })
}

export function setMonitoringUser(user) {
  if (user) {
    call('identify', user.id, { role: user.role })
    sentry?.setUser({ id: user.id })
  } else {
    call('reset')
    sentry?.setUser(null)
  }
}

export function captureError(error, context) {
  if (sentry) sentry.captureException(error, context ? { extra: context } : undefined)
}
