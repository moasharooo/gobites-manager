import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Inventory from './pages/Inventory'
import Production from './pages/Production'
import Products from './pages/Products'
import Orders from './pages/Orders'
import Customers from './pages/Customers'
import Marketing from './pages/Marketing'
import Reports from './pages/Reports'
import UsersPage from './pages/Users'
import { Menu, X } from 'lucide-react'

function ProtectedLayout({ children }) {
  const { isAuthenticated } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <img src="/logo.png" alt="GoBites" style={{ height: 32, objectFit: 'contain' }} />
        </div>

        {children}
      </div>
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth()
  
  const getHomeRoute = () => user?.role === 'staff' ? '/orders' : '/'

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={getHomeRoute()} replace /> : <Login />} />
      <Route path="/"          element={user?.role === 'staff' ? <Navigate to="/orders" replace /> : <ProtectedLayout><Dashboard /></ProtectedLayout>} />
      <Route path="/expenses"  element={<ProtectedLayout><Expenses /></ProtectedLayout>} />
      <Route path="/inventory" element={user?.role === 'staff' ? <Navigate to="/orders" replace /> : <ProtectedLayout><Inventory /></ProtectedLayout>} />
      <Route path="/production"element={user?.role === 'staff' ? <Navigate to="/orders" replace /> : <ProtectedLayout><Production /></ProtectedLayout>} />
      <Route path="/products"  element={user?.role === 'staff' ? <Navigate to="/orders" replace /> : <ProtectedLayout><Products /></ProtectedLayout>} />
      <Route path="/orders"    element={<ProtectedLayout><Orders /></ProtectedLayout>} />
      <Route path="/customers" element={<ProtectedLayout><Customers /></ProtectedLayout>} />
      <Route path="/marketing" element={user?.role === 'staff' ? <Navigate to="/orders" replace /> : <ProtectedLayout><Marketing /></ProtectedLayout>} />
      <Route path="/reports"   element={user?.role === 'staff' ? <Navigate to="/orders" replace /> : <ProtectedLayout><Reports /></ProtectedLayout>} />
      <Route path="/users"     element={user?.role === 'staff' ? <Navigate to="/orders" replace /> : <ProtectedLayout><UsersPage /></ProtectedLayout>} />
      <Route path="*"          element={<Navigate to={getHomeRoute()} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1E1510',
              color: '#F0E8DC',
              border: '1px solid #2E1E14',
              borderRadius: '10px',
              fontSize: '13.5px',
            },
            success: { iconTheme: { primary: '#C9A84C', secondary: '#0D0805' } },
            error:   { iconTheme: { primary: '#E05252', secondary: '#0D0805' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
