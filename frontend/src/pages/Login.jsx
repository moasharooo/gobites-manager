import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)

    const email = form.email.trim().toLowerCase()
    const password = form.password

    try {
      await login(email, password)
      toast.success('Welcome back! 🍫')
      navigate('/')
    } catch (err) {
      console.error('Login error:', err)

      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Invalid credentials'

      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card animate-fade">
        <div className="login-logo">
          <img
            src="/logo.png"
            alt="GoBites Logo"
            style={{
              height: '95px',
              maxWidth: '100%',
              objectFit: 'contain',
              margin: '0 auto var(--space-3)',
              display: 'block'
            }}
          />
          <div className="login-tagline">Your Business Intelligence Hub</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>

            <input
              id="login-email"
              className="form-input"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              placeholder="name@domain.com"
              value={form.email}
              onChange={e =>
                setForm(p => ({ ...p, email: e.target.value }))
              }
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>

            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="form-input"
                type={showPw ? 'text' : 'password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="••••••••"
                value={form.password}
                onChange={e =>
                  setForm(p => ({ ...p, password: e.target.value }))
                }
                required
                style={{ paddingRight: '44px' }}
              />

              <button
                type="button"
                id="toggle-password-btn"
                onClick={() => setShowPw(p => !p)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--c-text-3)',
                  cursor: 'pointer'
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '14px'
            }}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <>
                <LogIn size={16} /> Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}