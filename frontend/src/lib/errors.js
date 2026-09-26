// Turns an axios error into a sentence a person can act on.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  const serverMessage = error.response?.data?.error
  if (serverMessage) return serverMessage
  if (error.code === 'ECONNABORTED') return 'The request took too long. Check your connection and try again.'
  if (error.request && !error.response) return 'We could not reach Fixly. Check your internet connection and try again.'
  return error.message || fallback
}

export function errorStatus(error) {
  return error?.response?.status
}

/**
 * The second line of a "couldn't load" message. Only blames the connection
 * when the request never reached Fixly; a server error is our problem.
 */
export function loadFailureHint(error) {
  if (error?.code === 'ECONNABORTED' || (error?.request && !error?.response)) return 'Check your connection and try again.'
  return 'Something went wrong on our side. Please try again in a moment.'
}
