import axios from 'axios'
import { emitToast } from './toastBus'

const TOKEN_KEY = 'fixly_token'
const USER_KEY = 'fixly_user'
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const hadToken = !!localStorage.getItem(TOKEN_KEY)
    const isAuthFailure = err.response?.status === 401

    if (hadToken && isAuthFailure) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.dispatchEvent(new CustomEvent('fixly:auth-expired'))

      // AuthContext clears the session on this event and the route guards
      // redirect to sign-in with ?next= so the user returns to this page.
      emitToast({ title: 'Your session has ended', description: 'Please sign in again to continue.', variant: 'warning' })
    }

    return Promise.reject(err)
  }
)

export default api
