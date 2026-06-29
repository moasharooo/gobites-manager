import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Receipt, Package, Factory, ShoppingBag,
  ShoppingCart, Users, Megaphone, BarChart3, LogOut, X, UserCog
} from 'lucide-react'

const navItems = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/expenses',   label: 'Expenses',   icon: Receipt },
  { to: '/inventory',  label: 'Inventory',  icon: Package },
  { to: '/production', label: 'Production', icon: Factory },
  { to: '/products',   label: 'Products',   icon: ShoppingBag },
  { to: '/orders',     label: 'Orders',     icon: ShoppingCart },
  { to: '/customers',  label: 'Customers',  icon: Users },
  { to: '/marketing',  label: 'Marketing',  icon: Megaphone },
  { to: '/reports',    label: 'Reports',    icon: BarChart3 },
  { to: '/users',      label: 'Users & Staff', icon: UserCog },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNavClick = () => {
    // Close sidebar on mobile after nav click
    if (onClose) onClose()
  }

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'GB'

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-logo" style={{ justifyContent: 'center', padding: '12px 10px', position: 'relative' }}>
        <img src="/logo.png" alt="GoBites Logo" style={{ height: '65px', maxWidth: '100%', objectFit: 'contain' }} />
        {/* Close button — only visible on mobile */}
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {navItems.filter(item => {
          if (user?.role === 'staff') {
            return ['/orders', '/expenses', '/customers'].includes(item.to)
          }
          return true
        }).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={handleNavClick}
          >
            <Icon className="nav-icon" size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'Admin'}</div>
            <div className="sidebar-user-role">{user?.role || 'admin'}</div>
          </div>
          <button
            id="logout-btn"
            className="logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
