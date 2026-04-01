import axios from 'axios'

const TOKEN_KEY = 'fixly_token'
const USER_KEY = 'fixly_user'

const api = axios.create({
  baseURL: '/api',
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

      if (!window.location.pathname.startsWith('/auth')) {
        window.location.assign('/auth')
      }
    }

    return Promise.reject(err)
  }
)

export default api
