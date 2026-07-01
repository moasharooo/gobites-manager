import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('gobites_user')
    return stored ? JSON.parse(stored) : null
  })

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem('gobites_token', access_token)
    localStorage.setItem('gobites_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch (err) {
      console.error('Logout logging failed:', err)
    } finally {
      localStorage.removeItem('gobites_token')
      localStorage.removeItem('gobites_user')
      setUser(null)
    }
  }, [])

  // Auto-logout after 30 minutes of inactivity
  useEffect(() => {
    if (!user) return

    let timer
    const INACTIVITY_TIME = 30 * 60 * 1000 // 30 minutes

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        logout()
      }, INACTIVITY_TIME)
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => document.addEventListener(event, resetTimer))

    resetTimer() // Start timer

    return () => {
      clearTimeout(timer)
      events.forEach(event => document.removeEventListener(event, resetTimer))
    }
  }, [user, logout])

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
