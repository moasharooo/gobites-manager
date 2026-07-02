import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Trash2, Search, MessageCircle, FileText,
  X, Info, Phone, MapPin, Truck, ArrowLeft, Printer,
  Clock, DollarSign, Package, List, Building2
} from 'lucide-react'

const emptyForm = {
  name: '',
  phone: '',
  location: '',
  notes: '',
  branch_name: 'Main Branch',
  branch_phone: '',
  branch_location: '',
  branch_notes: ''
}

const emptyBranchForm = {
  name: '',
  phone: '',
  location: '',
  notes: ''
}

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`

export default function Suppliers() {
  const { user } = useAuth()
  const isStaff = user?.role === 'staff'
  
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  
  // Search filter
  const [search, setSearch] = useState('')
  
  // Profile Sub-view state
  const [profileId, setProfileId] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [selectedProfileBranch, setSelectedProfileBranch] = useState('')

  // Branch CRUD inside Profile
  const [branchModal, setBranchModal] = useState(false)
  const [branchForm, setBranchForm] = useState(emptyBranchForm)
  const [branchSaving, setBranchSaving] = useState(false)

  // Load all suppliers
  const loadSuppliers = () => {
    setLoading(true)
    api.get('/suppliers')
      .then(r => setSuppliers(r.data))
      .catch(err => {
        console.error(err)
        toast.error('Failed to load suppliers')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  // Load profile data when profileId changes
  useEffect(() => {
    if (profileId) {
      setProfileLoading(true)
      api.get(`/suppliers/${profileId}/profile`)
        .then(r => {
          setProfileData(r.data)
          setSelectedProfileBranch('') // reset selected branch filter
        })
        .catch(err => {
          console.error(err)
          toast.error('Failed to load supplier profile')
          setProfileId(null)
        })
        .finally(() => setProfileLoading(false))
    } else {
      setProfileData(null)
    }
  }, [profileId])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setModal(true)
  }

  const openEdit = (supplier) => {
    setEditing(supplier)
    setForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      location: supplier.location || '',
      notes: supplier.notes || '',
      branch_name: '',
      branch_phone: '',
      branch_location: '',
      branch_notes: ''
    })
    setModal(true)
  }

  const closeModal = () => setModal(false)
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    if (!editing && !form.branch_name.trim()) {
      toast.error('Initial branch name is required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/suppliers/${editing.id}`, {
          name: form.name,
          phone: form.phone,
          location: form.location,
          notes: form.notes
        })
        toast.success('Supplier details updated')
        // Refresh profile if viewing it
        if (profileId === editing.id) {
          setProfileId(null)
          setTimeout(() => setProfileId(editing.id), 50)
        }
      } else {
        await api.post('/suppliers', form)
        toast.success('Supplier and initial branch added successfully')
      }
      closeModal()
      loadSuppliers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (supplier) => {
    if (!confirm(`Are you sure you want to delete supplier "${supplier.name}"? This will delete all branches associated with it.`)) return
    try {
      await api.delete(`/suppliers/${supplier.id}`)
      toast.success('Supplier deleted successfully')
      if (profileId === supplier.id) {
        setProfileId(null)
      }
      loadSuppliers()
    } catch (err) {
      toast.error('Failed to delete supplier')
    }
  }

  // Branch CRUD handlers
  const handleAddBranch = async (e) => {
    e.preventDefault()
    if (!branchForm.name.trim()) {
      toast.error('Branch name is required')
      return
    }
    setBranchSaving(true)
    try {
      await api.post(`/suppliers/${profileId}/branches`, branchForm)
      toast.success('Branch added successfully')
      setBranchModal(false)
      setBranchForm(emptyBranchForm)
      // Reload profile
      const currentProfileId = profileId
      setProfileId(null)
      setTimeout(() => setProfileId(currentProfileId), 50)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add branch')
    } finally {
      setBranchSaving(false)
    }
  }

  const handleDeleteBranch = async (branchId, branchName) => {
    if (!confirm(`Are you sure you want to delete branch "${branchName}"?`)) return
    try {
      await api.delete(`/suppliers/${profileId}/branches/${branchId}`)
      toast.success('Branch deleted successfully')
      // Reload profile
      const currentProfileId = profileId
      setProfileId(null)
      setTimeout(() => setProfileId(currentProfileId), 50)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete branch')
    }
  }

  const openWhatsApp = (phone) => {
    if (!phone) {
      toast.error('No phone number registered')
      return
    }
    let clean = phone.replace(/[^\d+]/g, '')
    if (clean.startsWith('07') && clean.length === 10) {
      clean = '+962' + clean.slice(1)
    }
    window.open(`https://wa.me/${clean}`, '_blank')
  }

  const openPhone = (phone) => {
    if (!phone) {
      toast.error('No phone number registered')
      return
    }
    window.open(`tel:${phone}`)
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) ||
    s.location?.toLowerCase().includes(search.toLowerCase())
  )

  // RENDER PROFILE VIEW
  if (profileId) {
    if (profileLoading || !profileData) {
      return (
        <div className="page-container animate-fade flex-center" style={{ minHeight: '60vh' }}>
          <div className="spinner" />
        </div>
      )
    }

    const { supplier, expenses, inventory_items } = profileData
    
    // Filter display data by selected branch
    const displayExpenses = selectedProfileBranch
      ? expenses.filter(e => e.supplier_branch === selectedProfileBranch)
      : expenses

    const displayInventoryItems = selectedProfileBranch
      ? inventory_items.filter(i => i.supplier_branch === selectedProfileBranch)
      : inventory_items

    const displayTotalSpent = displayExpenses.filter(e => e.approval_status === "Approved").reduce((sum, e) => sum + (e.total_cost || 0), 0)
    const displayTotalPending = displayExpenses.filter(e => e.approval_status === "Pending").reduce((sum, e) => sum + (e.total_cost || 0), 0)

    return (
      <div className="page-container animate-fade">
        <style dangerouslySetInnerHTML={{__html: `
          @media screen {
            .print-only-branch-info { display: none !important; }
          }
          @media print {
            .print-only-branch-info { display: block !important; margin-bottom: 20px !important; font-size: 13px !important; color: #2E1E14 !important; }
          }
        `}} />

        {/* Print-Only Header (Watermark Letterhead) */}
        <div className="print-only-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <img src="/logo-black.png" alt="GoBites Logo" style={{ height: 45, objectFit: 'contain' }} />
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#8B5E3C', fontWeight: 700 }}>GoBites Management System</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#7A6858' }}>
                Document: Supplier Profile Ledger | Generated: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Back and Print buttons (Hidden in Print) */}
        <div className="page-header print-hide" style={{ marginBottom: 20 }}>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setProfileId(null)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={16} /> Back to Suppliers
            </button>
          </div>
          <div className="flex gap-2">
            {!isStaff && (
              <button className="btn btn-secondary" onClick={() => openEdit(supplier)}>
                <Pencil size={14} /> Edit Supplier
              </button>
            )}
            <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Printer size={16} /> Print Profile
            </button>
          </div>
        </div>

        {/* Profile Card Header */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: 'var(--r-lg)',
                background: 'var(--grad-gold)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#FAF6F0', fontSize: 24, fontWeight: 700,
                boxShadow: 'var(--shadow-gold)'
              }}>
                {supplier.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="page-title" style={{ fontSize: 24, margin: 0 }}>{supplier.name}</h1>
                <p className="text-muted" style={{ fontSize: 13, margin: '4px 0 0 0' }}>
                  Registered since: {supplier.created_at ? new Date(supplier.created_at).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
            
            {/* Quick Contacts (Hidden in print) */}
            <div className="flex gap-2 print-hide">
              {supplier.phone && (
                <>
                  <button className="btn btn-secondary" onClick={() => openPhone(supplier.phone)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={14} /> {supplier.phone}
                  </button>
                  <button className="btn btn-success" onClick={() => openWhatsApp(supplier.phone)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            <div>
              <div className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Main Location / Head Office</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <MapPin size={16} className="text-gold" />
                {supplier.location ? (
                  supplier.location.startsWith('http') ? (
                    <a href={supplier.location} target="_blank" rel="noopener noreferrer" className="text-gold print-hide" style={{ textDecoration: 'underline' }}>
                      Google Maps Link
                    </a>
                  ) : supplier.location
                ) : 'No location registered'}
                {supplier.location && supplier.location.startsWith('http') && (
                  <span className="print-only" style={{ display: 'none', color: 'var(--c-text-2)' }}>{supplier.location}</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 14, color: 'var(--c-text-2)', whiteSpace: 'pre-wrap' }}>
                {supplier.notes || 'No notes written.'}
              </div>
            </div>
          </div>
        </div>

        {/* Branches Section */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} color="var(--c-accent)" />
              <h2 className="section-title" style={{ fontSize: 16, margin: 0 }}>Supplier Branches</h2>
            </div>
            {!isStaff && (
              <button className="btn btn-secondary btn-sm print-hide" onClick={() => { setBranchForm(emptyBranchForm); setBranchModal(true); }}>
                <Plus size={14} /> Add Branch
              </button>
            )}
          </div>
          
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {supplier.branches?.map(b => (
                <div key={b.id} style={{
                  background: 'var(--c-surface-2)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>{b.name}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--c-text-2)', marginBottom: 12 }}>
                      {b.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={12} className="text-gold" />
                          <span style={{ cursor: 'pointer' }} onClick={() => openPhone(b.phone)}>{b.phone}</span>
                        </div>
                      )}
                      {b.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={12} className="text-gold" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.location.startsWith('http') ? (
                              <a href={b.location} target="_blank" rel="noopener noreferrer" className="text-gold print-hide" style={{ textDecoration: 'underline' }}>Maps Link</a>
                            ) : b.location}
                          </span>
                        </div>
                      )}
                      {b.notes && <div style={{ fontSize: 12, color: 'var(--c-text-3)', fontStyle: 'italic', marginTop: 4 }}>{b.notes}</div>}
                    </div>
                  </div>

                  <div className="print-hide" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--c-border)', paddingTop: 10, marginTop: 10 }}>
                    {b.phone && (
                      <>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openPhone(b.phone)} title="Call Branch" style={{ padding: 4, color: 'var(--c-accent)' }}><Phone size={13} /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openWhatsApp(b.phone)} title="WhatsApp Branch" style={{ padding: 4, color: 'var(--c-success)' }}><MessageCircle size={13} /></button>
                      </>
                    )}
                    {!isStaff && supplier.branches.length > 1 && (
                      <button className="btn btn-ghost btn-sm btn-icon text-danger" onClick={() => handleDeleteBranch(b.id, b.name)} title="Delete Branch" style={{ padding: 4 }}><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Branch Filter dropdown for profile (Print Hide) */}
        <div className="card print-hide" style={{ marginBottom: 20, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Building2 size={16} color="var(--c-accent)" />
          <span style={{ fontSize: 13.5, fontWeight: 550 }}>Filter profile by Branch:</span>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select
              className="form-select filter-select"
              value={selectedProfileBranch}
              onChange={e => setSelectedProfileBranch(e.target.value)}
              style={{
                minWidth: 180,
                height: 34,
                background: 'var(--c-surface-2)',
                color: selectedProfileBranch ? 'var(--c-text)' : 'var(--c-text-3)',
                borderColor: 'var(--c-border)',
                borderRadius: 'var(--r-md)',
                padding: '0 32px 0 12px',
                fontSize: '12px',
                appearance: 'none',
                cursor: 'pointer',
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237A6858' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="" style={{ background: '#1A110C', color: 'var(--c-text-3)' }}>All Branches</option>
              {supplier.branches?.map(b => (
                <option key={b.id} value={b.name} style={{ background: '#1A110C', color: 'var(--c-text-2)' }}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Print-only Branch indicator */}
        <div className="print-only-branch-info">
          <strong>Filtered Branch: </strong> {selectedProfileBranch || "All Branches"}
        </div>

        {/* Stats Grid */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(201,168,76,0.10) 100%)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
            <div className="stat-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C9A84C', marginBottom: 4 }}>Total Cost Spent</div>
            <div className="stat-value text-gold" style={{ fontSize: 24, fontWeight: 700 }}>{fmtJD(displayTotalSpent)}</div>
            <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>Approved expenses</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(91,155,213,0.10) 100%)', border: '1px solid rgba(91,155,213,0.25)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
            <div className="stat-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5B9BD5', marginBottom: 4 }}>Pending Invoices</div>
            <div className="stat-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-text)' }}>{fmtJD(displayTotalPending)}</div>
            <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>Pending approval</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(224,82,82,0.10) 100%)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
            <div className="stat-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#E05252', marginBottom: 4 }}>Total Invoices</div>
            <div className="stat-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-text)' }}>{displayExpenses.length}</div>
            <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>Expenses registered</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(92,158,80,0.10) 100%)', border: '1px solid rgba(92,158,80,0.25)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
            <div className="stat-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4CAF6E', marginBottom: 4 }}>Active Materials</div>
            <div className="stat-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-text)' }}>{displayInventoryItems.length}</div>
            <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>Linked inventory items</div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <List size={18} color="var(--c-accent)" />
            <h2 className="section-title" style={{ fontSize: 16, margin: 0 }}>Purchases & Expenses</h2>
          </div>
          <div className="table-wrapper">
            {displayExpenses.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-state-icon">🧾</div>
                <div className="empty-state-title" style={{ fontSize: 14 }}>No transactions recorded</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Branch</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayExpenses.map(item => (
                    <tr key={item.id}>
                      <td className="text-muted">{item.date}</td>
                      <td className="font-bold">{item.name}</td>
                      <td className="text-gold font-medium">{item.supplier_branch || '—'}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                          {item.category}
                        </span>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{item.unit || '—'}</td>
                      <td className="font-bold text-gold">{fmtJD(item.total_cost)}</td>
                      <td>
                        {item.approval_status === 'Pending' && <span className="badge badge-warning">Pending</span>}
                        {item.approval_status === 'Approved' && <span className="badge badge-success">Approved</span>}
                        {item.approval_status === 'Rejected' && <span className="badge badge-danger">Rejected</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Linked Inventory Items */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={18} color="var(--c-accent)" />
            <h2 className="section-title" style={{ fontSize: 16, margin: 0 }}>Associated Inventory Items</h2>
          </div>
          <div className="table-wrapper">
            {displayInventoryItems.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-state-icon">📦</div>
                <div className="empty-state-title" style={{ fontSize: 14 }}>No linked inventory items</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Branch</th>
                    <th>Category</th>
                    <th>Stock Qty</th>
                    <th>Unit Cost</th>
                    <th>Inventory Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayInventoryItems.map(item => (
                    <tr key={item.id}>
                      <td className="font-bold">{item.name}</td>
                      <td className="text-gold font-medium">{item.supplier_branch || '—'}</td>
                      <td>{item.category}</td>
                      <td>{item.current_quantity} {item.unit || ''}</td>
                      <td className="text-gold font-medium">{fmtJD(item.unit_cost)} / {item.unit || 'pc'}</td>
                      <td>
                        {item.status === 'Critical' && <span className="badge badge-danger">Critical</span>}
                        {item.status === 'Low' && <span className="badge badge-warning">Low</span>}
                        {item.status === 'OK' && <span className="badge badge-success">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add Branch Modal */}
        <Modal
          isOpen={branchModal}
          onClose={() => setBranchModal(false)}
          title={`Add Branch to ${supplier.name}`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setBranchModal(false)}>Cancel</button>
              <button className="btn btn-primary" form="branch-form" type="submit" disabled={branchSaving}>
                {branchSaving ? <span className="spinner" /> : 'Add Branch'}
              </button>
            </>
          }
        >
          <form id="branch-form" onSubmit={handleAddBranch} noValidate>
            <div className="form-group">
              <label className="form-label">Branch Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Khalda Branch"
                value={branchForm.name}
                onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group mt-4">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                placeholder="e.g. 0791234568"
                value={branchForm.phone}
                onChange={e => setBranchForm(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="form-group mt-4">
              <label className="form-label">Location</label>
              <input
                className="form-input"
                placeholder="Google Maps link or address"
                value={branchForm.location}
                onChange={e => setBranchForm(p => ({ ...p, location: e.target.value }))}
              />
            </div>
            <div className="form-group mt-4">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Any branch-specific details..."
                value={branchForm.notes}
                onChange={e => setBranchForm(p => ({ ...p, notes: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>
          </form>
        </Modal>

        {/* Print-Only Footer */}
        <div className="print-only-footer">
          This supplier profile details report was generated automatically by the GoBites Management System. Confidentially secured.
        </div>
      </div>
    )
  }

  // RENDER SUPPLIERS GRID
  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">{suppliers.length} active suppliers</p>
        </div>
        <div className="flex gap-2">
          {!isStaff && (
            <button className="btn btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-bar">
            <Search size={14} color="var(--c-text-3)" />
            <input
              placeholder="Search suppliers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="text-muted" style={{ fontSize: 13 }}>{filteredSuppliers.length} records</span>
        </div>

        {loading ? (
          <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚚</div>
            <div className="empty-state-title">No suppliers found</div>
            <div className="empty-state-text">Try registering a new supplier or adjusting your search</div>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            <div className="products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {filteredSuppliers.map(supplier => (
                <div key={supplier.id} className="product-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ padding: 20, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 'var(--r-md)',
                        background: 'var(--grad-gold)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: '#FAF6F0', fontSize: 18, fontWeight: 700
                      }}>
                        {supplier.name?.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text)' }}>
                          {supplier.name}
                        </h3>
                        <p style={{ fontSize: 11, margin: '2px 0 0 0', color: 'var(--c-text-3)' }}>
                          {supplier.branches?.length || 0} branches
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--c-text-2)', marginBottom: 12 }}>
                      {supplier.phone ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={14} className="text-gold" />
                          <span style={{ cursor: 'pointer' }} onClick={() => openPhone(supplier.phone)} title="Click to call">
                            {supplier.phone}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--c-text-3)' }}>
                          <Phone size={14} />
                          <span>No phone registered</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={14} className="text-gold" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {supplier.location ? (
                            supplier.location.startsWith('http') ? 'Google Maps Office' : supplier.location
                          ) : 'No head office registered'}
                        </span>
                      </div>
                    </div>

                    {supplier.notes && (
                      <div style={{
                        fontSize: 12, color: 'var(--c-text-3)', background: 'var(--c-surface-2)',
                        padding: 8, borderRadius: 'var(--r-sm)', border: '1px solid var(--c-border)',
                        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', maxHeight: 40
                      }}>
                        {supplier.notes}
                      </div>
                    )}
                  </div>

                  <div className="product-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--c-surface-1)', borderTop: '1px solid var(--c-border)' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setProfileId(supplier.id)}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >
                      View Profile
                    </button>

                    <div className="flex gap-2">
                      {supplier.phone && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => openPhone(supplier.phone)}
                            title="Call Supplier"
                            style={{ color: 'var(--c-accent)' }}
                          >
                            <Phone size={14} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => openWhatsApp(supplier.phone)}
                            title="Chat on WhatsApp"
                            style={{ color: 'var(--c-success)' }}
                          >
                            <MessageCircle size={14} />
                          </button>
                        </>
                      )}
                      {!isStaff && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => openEdit(supplier)}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            onClick={() => handleDelete(supplier)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={modal}
        onClose={closeModal}
        title={editing ? 'Edit Supplier' : 'Add Supplier & Initial Branch'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button
              className="btn btn-primary"
              form="supplier-form"
              type="submit"
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : (editing ? 'Save Changes' : 'Add Supplier')}
            </button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSave} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, borderBottom: '1px solid var(--c-border)', paddingBottom: 6, marginBottom: 12, color: 'var(--c-accent)' }}>
                Supplier Info
              </h3>
              <div className="form-group">
                <label className="form-label">Supplier Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Al-Mahal Al-Tijari"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group mt-4">
                <label className="form-label">Head Office Phone</label>
                <input
                  className="form-input"
                  placeholder="e.g. 0791234567"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                />
              </div>

              <div className="form-group mt-4">
                <label className="form-label">Office Address / Location</label>
                <input
                  className="form-input"
                  placeholder="e.g. Amman or Google Maps Link"
                  value={form.location}
                  onChange={e => setField('location', e.target.value)}
                />
              </div>

              <div className="form-group mt-4">
                <label className="form-label">General Notes</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Prices, materials supplied..."
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Render Initial Branch Section ONLY when adding new supplier */}
            {!editing && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, borderBottom: '1px solid var(--c-border)', paddingBottom: 6, marginBottom: 12, color: 'var(--c-accent)' }}>
                  Initial Branch Info
                </h3>
                
                <div className="form-group">
                  <label className="form-label">Branch Name *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Main Branch or Amman Branch"
                    value={form.branch_name}
                    onChange={e => setField('branch_name', e.target.value)}
                    required={!editing}
                  />
                </div>

                <div className="form-group mt-4">
                  <label className="form-label">Branch Phone</label>
                  <input
                    className="form-input"
                    placeholder="e.g. 0791234568 (leave empty to copy main)"
                    value={form.branch_phone}
                    onChange={e => setField('branch_phone', e.target.value)}
                  />
                </div>

                <div className="form-group mt-4">
                  <label className="form-label">Branch Location</label>
                  <input
                    className="form-input"
                    placeholder="Google Maps link or address"
                    value={form.branch_location}
                    onChange={e => setField('branch_location', e.target.value)}
                  />
                </div>

                <div className="form-group mt-4">
                  <label className="form-label">Branch Notes</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Branch specific details..."
                    value={form.branch_notes}
                    onChange={e => setField('branch_notes', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
