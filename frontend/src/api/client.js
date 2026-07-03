import axios from 'axios'

const API_BASE = 'http://129.121.115.46:8000'
const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
})

// Attach token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('gobites_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gobites_token')
      localStorage.removeItem('gobites_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
