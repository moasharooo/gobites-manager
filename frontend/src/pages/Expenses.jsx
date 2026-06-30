import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search, X, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'
import MultiSelect from '../components/MultiSelect'

const CATEGORIES = ['Raw Materials', 'Packaging', 'Delivery', 'Advertising', 'Photography', 'Equipment', 'Tools', 'Other']
const CATEGORY_OPTIONS = CATEGORIES.map(c => ({ value: c, label: c }))
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Credit Card', 'Online']

const RAW_MATERIALS_LIST = [
  { value: 'Chocolate', label: 'Chocolate' },
  { value: 'Oats', label: 'Oats' },
  { value: 'Peanut Butter', label: 'Peanut Butter' },
  { value: 'Honey', label: 'Honey' },
  { value: 'Dates', label: 'Dates' },
  { value: 'Cocoa', label: 'Cocoa' },
  { value: 'Flaxseeds', label: 'Flaxseeds' },
  { value: 'Chia Seeds', label: 'Chia Seeds' },
  { value: 'Vanilla', label: 'Vanilla' },
  { value: 'Nuts', label: 'Nuts...' }
]

const NUTS_LIST = [
  { value: 'Almonds', label: 'Almonds' },
  { value: 'Walnuts', label: 'Walnuts' },
  { value: 'Cashews', label: 'Cashews' },
  { value: 'Hazelnuts', label: 'Hazelnuts' }
]

const RAW_MATERIALS_OPTIONS = [
  ...RAW_MATERIALS_LIST.filter(r => r.value !== 'Nuts'),
  ...NUTS_LIST
]

const PACKAGING_LIST = [
  { value: 'Bags', label: 'Bags' },
  { value: 'Boxes', label: 'Boxes' },
  { value: 'Stickers', label: 'Stickers' },
  { value: 'Cupcake Cups', label: 'Cupcake Cups' }
]

const PACKAGING_OPTIONS = PACKAGING_LIST

const EXPORT_COLUMNS = [
  { header: 'Date', key: 'date' },
  { header: 'Name', key: 'name' },
  { header: 'Category', key: 'category' },
  { header: 'Quantity', key: 'quantity' },
  { header: 'Unit', key: 'unit' },
  { header: 'Total Cost', key: 'total_cost_fmt' },
  { header: 'Supplier', key: 'supplier' },
  { header: 'Payment Method', key: 'payment_method' },
  { header: 'Notes', key: 'notes' }
]

const emptyForm = { date: new Date().toISOString().split('T')[0], name: 'Chocolate', category: 'Raw Materials', quantity: 1, unit: 'kg', total_cost: '', supplier: '', payment_method: 'Cash', notes: '' }

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`

export default function Expenses() {
  const { user } = useAuth()
  const isStaff = user?.role === 'staff'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterCategories, setFilterCategories] = useState([])
  const [filterItems, setFilterItems] = useState([])
  const [filterMonthFrom, setFilterMonthFrom] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterMonthTo, setFilterMonthTo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Raw Materials & Packaging Helper States
  const [selectedRawMaterial, setSelectedRawMaterial] = useState('Chocolate')
  const [selectedNut, setSelectedNut] = useState('')
  const [selectedPackaging, setSelectedPackaging] = useState('Bags')

  const load = () => api.get('/expenses').then(r => setItems(r.data)).catch(console.error).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setSelectedRawMaterial('Chocolate')
    setSelectedNut('')
    setSelectedPackaging('Bags')
    setModal(true)
  }

  const openEdit = item => {
    setEditing(item)
    setForm({ ...item, date: item.date?.split('T')[0] || item.date })

    // Setup helper dropdown states based on existing item name
    if (item.category === 'Raw Materials') {
      if (NUTS_LIST.some(n => n.value === item.name)) {
        setSelectedRawMaterial('Nuts')
        setSelectedNut(item.name)
      } else {
        setSelectedRawMaterial(item.name)
        setSelectedNut('')
      }
    } else if (item.category === 'Packaging') {
      setSelectedPackaging(item.name)
    }
    setModal(true)
  }

  const closeModal = () => setModal(false)
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleRawMaterialChange = val => {
    setSelectedRawMaterial(val)
    if (val === 'Nuts') {
      setSelectedNut('Almonds')
      setForm(p => ({ ...p, name: 'Almonds' }))
    } else {
      setSelectedNut('')
      setForm(p => ({ ...p, name: val }))
    }
  }

  const handleNutChange = val => {
    setSelectedNut(val)
    setForm(p => ({ ...p, name: val }))
  }

  const handleCategoryChange = val => {
    setForm(p => {
      const nextForm = { ...p, category: val }
      if (val === 'Raw Materials') {
        setSelectedRawMaterial('Chocolate')
        setSelectedNut('')
        nextForm.name = 'Chocolate'
        nextForm.unit = 'kg'
      } else if (val === 'Packaging') {
        setSelectedPackaging('Bags')
        nextForm.name = 'Bags'
        nextForm.unit = 'pcs'
      } else {
        nextForm.name = ''
        nextForm.unit = ''
      }
      return nextForm
    })
  }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/expenses/${editing.id}`, form)
        toast.success('Expense updated')
      } else {
        await api.post('/expenses', form)
        toast.success('Expense added')
      }
      closeModal()
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving expense')
    } finally {
      setSaving(false) 
    }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this expense?')) return
    try {
      await api.delete(`/expenses/${id}`)
      toast.success('Deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  const handleApprove = async id => {
    try {
      await api.put(`/expenses/${id}/approve`)
      toast.success('Expense approved!')
      load()
    } catch (err) { toast.error('Failed to approve') }
  }

  const handleReject = async id => {
    if (!confirm('Reject this expense?')) return
    try {
      await api.put(`/expenses/${id}/reject`)
      toast.success('Expense rejected!')
      load()
    } catch (err) { toast.error('Failed to reject') }
  }

  const filtered = items
    .filter(i =>
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.category?.toLowerCase().includes(search.toLowerCase()) ||
      i.supplier?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(i => filterCategories.length === 0 || filterCategories.includes(i.category))
    .filter(i => filterItems.length === 0 || filterItems.includes(i.name))
    .filter(i => {
      const d = i.date ? i.date.split('T')[0].slice(0, 7) : ''
      if (filterMonthFrom && d < filterMonthFrom) return false
      if (filterMonthTo && d > filterMonthTo) return false
      return true
    })

  // Category breakdowns for summary cards (based on filtered month)
  const monthItems = items.filter(i => {
    const d = i.date ? i.date.split('T')[0].slice(0, 7) : ''
    if (filterMonthFrom && d < filterMonthFrom) return false
    if (filterMonthTo && d > filterMonthTo) return false
    return true
  })
  const rawMatTotal = monthItems.filter(i => i.category === 'Raw Materials').reduce((s, i) => s + (+i.total_cost || 0), 0)
  const packagingTotal = monthItems.filter(i => i.category === 'Packaging').reduce((s, i) => s + (+i.total_cost || 0), 0)
  const marketingTotal = monthItems.filter(i => ['Advertising', 'Photography', 'Marketing'].includes(i.category)).reduce((s, i) => s + (+i.total_cost || 0), 0)
  const grandTotal = monthItems.reduce((s, i) => s + (+i.total_cost || 0), 0)

  const totalThisMonth = items
    .filter(i => { const d = new Date(i.date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    .reduce((s, i) => s + (+i.total_cost || 0), 0)

  const CATEGORY_COLORS = { 'Raw Materials': 'badge-gold', Packaging: 'badge-info', Delivery: 'badge-warning', Advertising: 'badge-success', Photography: 'badge-neutral', Equipment: 'badge-danger', Tools: 'badge-neutral', Other: 'badge-neutral' }

  const getItemOptions = () => {
    let opts = []
    if (filterCategories.includes('Raw Materials')) {
      opts = [...opts, ...RAW_MATERIALS_OPTIONS]
    }
    if (filterCategories.includes('Packaging')) {
      opts = [...opts, ...PACKAGING_OPTIONS]
    }
    return opts
  }

  const exportData = filtered.map(item => ({
    ...item,
    total_cost_fmt: (+item.total_cost || 0).toFixed(2),
    unit: item.unit || '—',
    supplier: item.supplier || '—',
    payment_method: item.payment_method || '—',
    notes: item.notes || ''
  }))

  return (
    <div className="page-container animate-fade">
      {/* Print Only Header */}
      <div className="print-only-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo-black.png" alt="GoBites Logo" style={{ height: 45, objectFit: 'contain' }} />
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#8B5E3C', fontWeight: 700 }}>GoBites Management System</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#7A6858' }}>
              Document: Expenses Audit Ledger | Generated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          {!isStaff && <p className="page-subtitle">This month: <strong className="text-gold">{fmtJD(totalThisMonth)}</strong></p>}
        </div>
        <div className="flex gap-2 print-hide" style={{ alignItems: 'center' }}>
          {/* Month Pickers for Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="text-muted" style={{ fontSize: 12 }}>From:</span>
              <input
                type="month"
                className="filter-date-input"
                value={filterMonthFrom}
                onChange={e => setFilterMonthFrom(e.target.value)}
                title="From month"
                style={{ fontSize: 13, padding: '4px 8px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="text-muted" style={{ fontSize: 12 }}>To:</span>
              <input
                type="month"
                className="filter-date-input"
                value={filterMonthTo}
                onChange={e => setFilterMonthTo(e.target.value)}
                title="To month"
                style={{ fontSize: 13, padding: '4px 8px' }}
              />
            </div>
          </div>
          {(filterMonthFrom || filterMonthTo) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterMonthFrom(''); setFilterMonthTo(''); }} title="Show all time">
              All Time
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> Print Page
          </button>
          <button id="add-expense-btn" className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Category Summary Cards */}
      {!isStaff && (
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(201,168,76,0.10) 100%)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
            <div className="stat-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C9A84C', marginBottom: 4 }}>Raw Materials</div>
            <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)' }}>{fmtJD(rawMatTotal)}</div>
            <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{monthItems.filter(i => i.category === 'Raw Materials').length} expenses</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(91,155,213,0.10) 100%)', border: '1px solid rgba(91,155,213,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
            <div className="stat-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5B9BD5', marginBottom: 4 }}>Packaging</div>
            <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)' }}>{fmtJD(packagingTotal)}</div>
            <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{monthItems.filter(i => i.category === 'Packaging').length} expenses</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(224,82,82,0.10) 100%)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
            <div className="stat-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#E05252', marginBottom: 4 }}>Marketing</div>
            <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)' }}>{fmtJD(marketingTotal)}</div>
            <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{monthItems.filter(i => ['Advertising', 'Photography', 'Marketing'].includes(i.category)).length} expenses</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(92,158,80,0.10) 100%)', border: '1px solid rgba(92,158,80,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
            <div className="stat-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4CAF6E', marginBottom: 4 }}>Total</div>
            <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)' }}>{fmtJD(grandTotal)}</div>
            <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{monthItems.length} expenses</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="search-bar">
            <Search size={14} color="var(--c-text-3)" />
            <input placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} id="expense-search" />
          </div>
          <span className="text-muted" style={{ fontSize: 13 }}>{filtered.length} records</span>
          <div className="export-btn-group">
            <button
              className="btn btn-sm btn-excel"
              onClick={() => exportToExcel(exportData, EXPORT_COLUMNS, `expenses-${new Date().toISOString().slice(0,10)}`)}
              title="Export to Excel"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              className="btn btn-sm btn-pdf"
              onClick={() => exportToPDF(exportData, EXPORT_COLUMNS, `expenses-${new Date().toISOString().slice(0,10)}`, 'GoBites – Expenses Report')}
              title="Export to PDF"
            >
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="filter-bar">
          <MultiSelect
            options={CATEGORY_OPTIONS}
            selected={filterCategories}
            onChange={cats => {
              setFilterCategories(cats)
              // Reset sub-items that are no longer part of selected categories
              const allowed = []
              if (cats.includes('Raw Materials')) allowed.push(...RAW_MATERIALS_OPTIONS.map(o => o.value))
              if (cats.includes('Packaging')) allowed.push(...PACKAGING_OPTIONS.map(o => o.value))
              setFilterItems(prev => prev.filter(item => allowed.includes(item)))
            }}
            placeholder="All Categories"
          />

          {(filterCategories.includes('Raw Materials') || filterCategories.includes('Packaging')) && (
            <MultiSelect
              options={getItemOptions()}
              selected={filterItems}
              onChange={setFilterItems}
              placeholder="All Items"
            />
          )}

          {(search || filterCategories.length > 0 || filterItems.length > 0) && (
            <button className="filter-clear-btn" onClick={() => { setSearch(''); setFilterCategories([]); setFilterItems([]); }}>
              <X size={12} /> Clear Filters
            </button>
          )}
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🧾</div><div className="empty-state-title">No expenses found</div><div className="empty-state-text">Try adjusting your filters</div></div>
          ) : (
            <table>
              <thead><tr><th>Date</th><th>Name</th><th>Created By</th><th>Category</th><th>Qty</th><th>Unit</th><th>Total</th><th>Supplier</th><th>Payment</th><th>Approval</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td className="text-muted">{item.date}</td>
                    <td className="font-bold" style={{ color: 'var(--c-text)' }}>{item.name}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{item.created_by_name || 'System'}</td>
                    <td><span className={`badge ${CATEGORY_COLORS[item.category] || 'badge-neutral'}`}>{item.category}</span></td>
                    <td>{item.quantity}</td>
                    <td>{item.unit || '—'}</td>
                    <td className="font-bold text-gold">{fmtJD(item.total_cost)}</td>
                    <td>{item.supplier || '—'}</td>
                    <td>{item.payment_method || '—'}</td>
                    <td>
                        {item.approval_status === 'Pending' && <span className="badge badge-warning">Pending</span>}
                        {item.approval_status === 'Approved' && <span className="badge badge-success">Approved</span>}
                        {item.approval_status === 'Rejected' && <span className="badge badge-danger">Rejected</span>}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {!isStaff && item.approval_status === 'Pending' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleApprove(item.id)}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleReject(item.id)}>Reject</button>
                          </>
                        )}
                        {!isStaff && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(item)} title="Edit"><Pencil size={14} /></button>}
                        {!isStaff && <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(item.id)} title="Delete"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        isOpen={modal}
        onClose={closeModal}
        title={editing ? 'Edit Expense' : 'Add Expense'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button id="save-expense-btn" className="btn btn-primary" form="expense-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : (editing ? 'Save Changes' : 'Add Expense')}
            </button>
          </>
        }
      >
        <form id="expense-form" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input id="expense-date" className="form-input" type="date" value={form.date} onChange={e => setField('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select id="expense-category" className="form-select" value={form.category} onChange={e => handleCategoryChange(e.target.value)} required>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid mt-4">
            {form.category === 'Raw Materials' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Raw Material *</label>
                  <select
                    className="form-select"
                    value={RAW_MATERIALS_LIST.some(r => r.value === selectedRawMaterial) ? selectedRawMaterial : 'Chocolate'}
                    onChange={e => handleRawMaterialChange(e.target.value)}
                    required
                  >
                    {RAW_MATERIALS_LIST.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {selectedRawMaterial === 'Nuts' && (
                  <div className="form-group">
                    <label className="form-label">Nut Type *</label>
                    <select
                      className="form-select"
                      value={selectedNut || 'Almonds'}
                      onChange={e => handleNutChange(e.target.value)}
                      required
                    >
                      {NUTS_LIST.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                )}
              </>
            ) : form.category === 'Packaging' ? (
              <div className="form-group">
                <label className="form-label">Packaging Item *</label>
                <select
                  className="form-select"
                  value={PACKAGING_LIST.some(p => p.value === selectedPackaging) ? selectedPackaging : 'Bags'}
                  onChange={e => { setSelectedPackaging(e.target.value); setForm(p => ({ ...p, name: e.target.value })); }}
                  required
                >
                  {PACKAGING_LIST.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  id="expense-name"
                  className="form-input"
                  placeholder="e.g. Belgian Chocolate"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="form-grid mt-4">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input id="expense-qty" className="form-input" type="number" step="0.01" min="0" value={form.quantity} onChange={e => setField('quantity', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input id="expense-unit" className="form-input" placeholder="kg, pcs, box..." value={form.unit} onChange={e => setField('unit', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Total Cost (JD) *</label>
              <input id="expense-cost" className="form-input" type="number" step="0.01" min="0" placeholder="0.00" value={form.total_cost} onChange={e => setField('total_cost', e.target.value)} required />
            </div>
          </div>
          <div className="form-grid mt-4">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input id="expense-supplier" className="form-input" placeholder="Supplier name" value={form.supplier} onChange={e => setField('supplier', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select id="expense-payment" className="form-select" value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group mt-4">
            <label className="form-label">Notes</label>
            <textarea id="expense-notes" className="form-textarea" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </form>
      </Modal>

      {/* Print Only Footer */}
      <div className="print-only-footer">
        This expenses report was generated automatically by the GoBites Management System. Confidentially secured.
      </div>
    </div>
  )
}
