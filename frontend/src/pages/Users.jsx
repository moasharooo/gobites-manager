import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search, X, ShieldAlert, History, Users as UsersIcon, Clock } from 'lucide-react'

const emptyForm = { name: '', email: '', password: '', role: 'staff', phone: '', financial_advances: 0 }

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [activeTab, setActiveTab] = useState('users') // 'users', 'logs', or 'logins'
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadUsers = () => {
    setLoading(true)
    api.get('/auth/users')
      .then(r => setUsers(r.data))
      .catch(err => {
        console.error(err)
        toast.error('Failed to load users list')
      })
      .finally(() => setLoading(false))
  }

  const loadLogs = () => {
    setLogsLoading(true)
    api.get('/auth/activity-log')
      .then(r => setLogs(r.data))
      .catch(err => {
        console.error(err)
        toast.error('Failed to load activity logs')
      })
      .finally(() => setLogsLoading(false))
  }

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers()
    } else {
      loadLogs()
    }
  }, [activeTab])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setModal(true)
  }

  const openEdit = u => {
    setEditing(u)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      phone: u.phone || '',
      financial_advances: u.financial_advances || 0
    })
    setModal(true)
  }

  const closeModal = () => setModal(false)
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const payload = {
          name: form.name,
          email: form.email,
          role: form.role,
          phone: form.phone,
          financial_advances: +form.financial_advances || 0
        }
        if (form.password.trim() !== '') {
          payload.password = form.password
        }
        await api.put(`/auth/users/${editing.id}`, payload)
        toast.success('User updated successfully')
      } else {
        if (!form.password.trim()) {
          toast.error('Password is required for new users')
          setSaving(false)
          return
        }
        await api.post('/auth/register', form)
        toast.success('User created successfully')
      }
      closeModal()
      loadUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async targetUser => {
    if (targetUser.id === user.id) {
      toast.error('You cannot delete your own admin account!')
      return
    }
    if (!confirm(`Are you sure you want to delete user "${targetUser.name}"? This action cannot be undone.`)) return
    try {
      await api.delete(`/auth/users/${targetUser.id}`)
      toast.success('User deleted successfully')
      loadUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete user')
    }
  }

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    const logDate = log.created_at ? log.created_at.split('T')[0] : ''
    if (dateFrom && logDate < dateFrom) return false
    if (dateTo && logDate > dateTo) return false
    return true
  })

  const filteredLogins = logs.filter(log => {
    if (log.action !== 'LOGIN' && log.action !== 'LOGOUT') return false
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    const logDate = log.created_at ? log.created_at.split('T')[0] : ''
    if (dateFrom && logDate < dateFrom) return false
    if (dateTo && logDate > dateTo) return false
    return true
  })

  const getActionBadgeClass = (action) => {
    if (action.startsWith('APPROVE_')) return 'badge-success'
    if (action.startsWith('REJECT_')) return 'badge-gold'
    if (action.startsWith('DELETE_')) return 'badge-danger'
    if (action.startsWith('UPDATE_')) return 'badge-info'
    return 'badge-neutral'
  }

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users & Audit Logs</h1>
          <p className="page-subtitle">
            {activeTab === 'users' 
              ? `${users.length} active platform accounts`
              : activeTab === 'logs'
                ? `${logs.length} audit log entries registered`
                : `${filteredLogins.length} login events recorded`
            }
          </p>
        </div>
        {activeTab === 'users' && (
          <button id="add-user-btn" className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add New User
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid var(--c-border)', paddingBottom: 10 }}>
        <button 
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setActiveTab('users'); setSearch(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <UsersIcon size={16} /> Users & Staff
        </button>
        <button 
          className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setActiveTab('logs'); setSearch(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <History size={16} /> Activity Audit Log
        </button>
        <button 
          className={`btn ${activeTab === 'logins' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setActiveTab('logins'); setSearch(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Clock size={16} /> Login History
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar" style={{ minWidth: 240 }}>
            <Search size={14} color="var(--c-text-3)" />
            <input
              id="user-search"
              placeholder={activeTab === 'users' ? "Search users by name or email..." : "Search logs by user, action or details..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {activeTab !== 'users' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="date"
                className="form-input"
                style={{ padding: '6px 12px', fontSize: 13, width: 140, height: 36 }}
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                placeholder="From Date"
              />
              <span style={{ color: 'var(--c-text-3)', fontSize: 12 }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ padding: '6px 12px', fontSize: 13, width: 140, height: 36 }}
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                placeholder="To Date"
              />
              {(dateFrom || dateTo) && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  style={{ color: 'var(--c-danger)', fontSize: 12, padding: '4px 8px' }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <span className="text-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
            {activeTab === 'users' ? filteredUsers.length : activeTab === 'logs' ? filteredLogs.length : filteredLogins.length} items
          </span>
        </div>

        <div className="table-wrapper">
          {activeTab === 'users' ? (
            loading ? (
              <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">No users found</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Advances</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td className="font-bold" style={{ color: 'var(--c-text)' }}>{u.name}</td>
                      <td className="text-muted">{u.email}</td>
                      <td className="text-muted">{u.phone || '-'}</td>
                      <td>
                        <span className={`badge ${
                          u.role === 'owner' ? 'badge-gold' :
                          u.role === 'admin' ? 'badge-warning' : 'badge-info'
                        }`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="font-bold text-danger">{u.financial_advances ? `${u.financial_advances.toFixed(2)} JD` : '0.00 JD'}</td>
                      <td className="text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => openEdit(u)}
                            title="Edit User / Reset Password"
                          >
                            <Pencil size={14} />
                          </button>
                          {u.id !== user?.id ? (
                            <button
                              className="btn btn-danger btn-sm btn-icon"
                              onClick={() => handleDelete(u)}
                              title="Delete User"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--c-text-3)', padding: '0 8px' }}>
                              Current User
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : activeTab === 'logs' ? (
            logsLoading ? (
              <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
            ) : filteredLogs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No activities recorded yet</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td className="font-bold" style={{ color: 'var(--c-text)' }}>{log.user_name}</td>
                      <td>
                        <span className={`badge ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="text-muted" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.details}
                      </td>
                      <td className="text-muted">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            logsLoading ? (
              <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
            ) : filteredLogins.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔑</div>
                <div className="empty-state-title">No login history recorded yet</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Event</th>
                    <th>Details</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogins.map(log => (
                    <tr key={log.id}>
                      <td className="font-bold" style={{ color: 'var(--c-text)' }}>{log.user_name}</td>
                      <td>
                        <span className={`badge ${log.action === 'LOGIN' ? 'badge-success' : 'badge-danger'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="text-muted">{log.details}</td>
                      <td className="text-muted">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      <Modal
        isOpen={modal}
        onClose={closeModal}
        title={editing ? 'Edit User / Reset Password' : 'Add New User'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button id="save-user-submit-btn" className="btn btn-primary" form="user-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : (editing ? 'Save Changes' : 'Create User')}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              id="user-name-input"
              className="form-input"
              placeholder="e.g. John Doe"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              required
            />
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Email Address *</label>
            <input
              id="user-email-input"
              className="form-input"
              type="email"
              placeholder="name@gobites.co"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              required
            />
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Role *</label>
            <select
              id="user-role-select"
              className="form-select"
              value={form.role}
              onChange={e => setField('role', e.target.value)}
              required
            >
              <option value="staff">Staff (Limited Access)</option>
              <option value="admin">Manager / Admin (Standard Management)</option>
              <option value="owner">Owner (Full Privileged Access)</option>
            </select>
          </div>

          <div className="form-group mt-4">
            <label className="form-label">
              {editing ? 'New Password (Leave blank to keep unchanged)' : 'Password *'}
            </label>
            <input
              id="user-password-input"
              className="form-input"
              type="password"
              placeholder={editing ? "••••••••" : "Min 6 characters"}
              value={form.password}
              onChange={e => setField('password', e.target.value)}
              required={!editing}
            />
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Phone Number</label>
            <input
              id="user-phone-input"
              className="form-input"
              type="text"
              placeholder="e.g. +962 79 123 4567"
              value={form.phone}
              onChange={e => setField('phone', e.target.value)}
            />
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Financial Advances / Drawn Amount (JD)</label>
            <input
              id="user-advances-input"
              className="form-input"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 150.00"
              value={form.financial_advances}
              onChange={e => setField('financial_advances', e.target.value)}
            />
          </div>

          {editing && editing.id === user?.id && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 'var(--r-md)', padding: 12, marginTop: 16
            }}>
              <ShieldAlert size={16} color="#C9A84C" />
              <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                You are editing your own admin account. If you change your email or password, you may need to log in again.
              </span>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
