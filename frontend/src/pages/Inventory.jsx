import { useEffect, useState } from 'react'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search, AlertTriangle, X, FileSpreadsheet, FileText } from 'lucide-react'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'
import MultiSelect from '../components/MultiSelect'

const CATEGORIES = ['Raw Materials', 'Packaging', 'Tools', 'Other']
const CATEGORY_OPTIONS = CATEGORIES.map(c => ({ value: c, label: c }))

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
  { value: 'Bag', label: 'Bag' },
  { value: 'Box', label: 'Box' },
  { value: 'Sticker', label: 'Sticker' },
  { value: 'Cupcake Cups', label: 'Cupcake Cups' }
]

const PACKAGING_OPTIONS = PACKAGING_LIST

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name' },
  { header: 'Category', key: 'category' },
  { header: 'Current Qty', key: 'current_quantity' },
  { header: 'Min Qty', key: 'minimum_quantity' },
  { header: 'Unit', key: 'unit' },
  { header: 'Unit Cost', key: 'unit_cost_fmt' },
  { header: 'Total Value', key: 'total_value_fmt' },
  { header: 'Supplier', key: 'supplier' },
  { header: 'Expiry Date', key: 'expiry_date' },
  { header: 'Status', key: 'status' }
]

const emptyForm = { name: 'Chocolate', category: 'Raw Materials', current_quantity: 0, unit: 'kg', unit_cost: 0, minimum_quantity: 0, supplier: '', purchase_date: '', expiry_date: '' }

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`

const fmtJD2 = v => `${(+v || 0).toFixed(2)} JD`

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('Raw Materials') // 'Raw Materials' or 'Packaging'
  const [filterItems, setFilterItems] = useState([])

  // Raw Materials & Packaging Helper States
  const [selectedRawMaterial, setSelectedRawMaterial] = useState('Chocolate')
  const [selectedNut, setSelectedNut] = useState('')
  const [selectedPackaging, setSelectedPackaging] = useState('Bag')

  const load = () => api.get('/inventory').then(r => setItems(r.data)).catch(console.error).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({
      ...emptyForm,
      category: activeTab,
      name: activeTab === 'Raw Materials' ? 'Chocolate' : 'Bag',
      unit: activeTab === 'Raw Materials' ? 'kg' : 'pcs'
    })
    setSelectedRawMaterial(activeTab === 'Raw Materials' ? 'Chocolate' : '')
    setSelectedNut('')
    setSelectedPackaging(activeTab === 'Packaging' ? 'Bag' : '')
    setModal(true)
  }

  const openEdit = item => {
    setEditing(item)
    setForm({ ...item })

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
        setSelectedPackaging('Bag')
        nextForm.name = 'Bag'
        nextForm.unit = 'pcs'
      } else {
        nextForm.name = ''
      }
      return nextForm
    })
  }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, purchase_date: form.purchase_date || null, expiry_date: form.expiry_date || null }
      if (editing) {
        await api.put(`/inventory/${editing.id}`, payload)
        toast.success('Item updated')
      } else {
        await api.post('/inventory', payload)
        toast.success('Item added to inventory')
      }
      closeModal(); load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally { setSaving(false) }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this item?')) return
    try { await api.delete(`/inventory/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const filtered = items
    .filter(i =>
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.category?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(i => i.category === activeTab)
    .filter(i => filterItems.length === 0 || filterItems.includes(i.name))

  const lowCount = items.filter(i => i.status !== 'OK').length

  const STATUS_BADGE = { OK: 'badge-success', Low: 'badge-warning', Critical: 'badge-danger' }

  const getItemOptions = () => {
    let opts = []
    if (activeTab === 'Raw Materials') {
      opts = RAW_MATERIALS_OPTIONS
    } else if (activeTab === 'Packaging') {
      opts = PACKAGING_OPTIONS
    }
    return opts
  }

  const exportData = filtered.map(item => ({
    ...item,
    unit_cost_fmt: (+item.unit_cost || 0).toFixed(2),
    total_value_fmt: ((+item.current_quantity || 0) * (+item.unit_cost || 0)).toFixed(2),
    expiry_date: item.expiry_date || '—',
    supplier: item.supplier || '—'
  }))

  // Value totals per category
  const rawMaterialsValue = items
    .filter(i => i.category === 'Raw Materials')
    .reduce((s, i) => s + (+i.current_quantity || 0) * (+i.unit_cost || 0), 0)
  const packagingValue = items
    .filter(i => i.category === 'Packaging')
    .reduce((s, i) => s + (+i.current_quantity || 0) * (+i.unit_cost || 0), 0)

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{items.length} items · {lowCount > 0 && <span className="text-danger">{lowCount} need attention</span>}</p>
        </div>
        <button id="add-inventory-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Value Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(92,158,80,0.10) 100%)', border: '1px solid rgba(92,158,80,0.25)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4CAF6E', marginBottom: 6 }}>Raw Materials Value</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--c-text)' }}>{fmtJD2(rawMaterialsValue)}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 4 }}>{items.filter(i => i.category === 'Raw Materials').length} items in stock</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(201,168,76,0.10) 100%)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C9A84C', marginBottom: 6 }}>Packaging Value</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--c-text)' }}>{fmtJD2(packagingValue)}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 4 }}>{items.filter(i => i.category === 'Packaging').length} items in stock</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(91,155,213,0.10) 100%)', border: '1px solid rgba(91,155,213,0.25)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5B9BD5', marginBottom: 6 }}>Total Inventory Value</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--c-text)' }}>{fmtJD2(rawMaterialsValue + packagingValue)}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 4 }}>Across all categories</div>
        </div>
      </div>

      {lowCount > 0 && (
        <div className="alert alert-warning mb-4" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          <span><strong>{lowCount} items</strong> are below minimum stock level and need restocking.</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid var(--c-border)', paddingBottom: 0 }}>
        {['Raw Materials', 'Packaging'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              setFilterItems([])
            }}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid var(--c-accent)' : '3px solid transparent',
              color: activeTab === tab ? 'var(--c-accent)' : 'var(--c-text-3)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: -2
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-bar">
            <Search size={14} color="var(--c-text-3)" />
            <input id="inventory-search" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-muted" style={{ fontSize: 13 }}>{filtered.length} items</span>
          <div className="export-btn-group">
            <button
              className="btn btn-sm btn-excel"
              onClick={() => exportToExcel(exportData, EXPORT_COLUMNS, `inventory-${new Date().toISOString().slice(0,10)}`)}
              title="Export to Excel"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              className="btn btn-sm btn-pdf"
              onClick={() => exportToPDF(exportData, EXPORT_COLUMNS, `inventory-${new Date().toISOString().slice(0,10)}`, 'GoBites – Inventory Report')}
              title="Export to PDF"
            >
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="filter-bar">
          <MultiSelect
            options={getItemOptions()}
            selected={filterItems}
            onChange={setFilterItems}
            placeholder="All Items"
          />

          {(search || filterItems.length > 0) && (
            <button className="filter-clear-btn" onClick={() => { setSearch(''); setFilterItems([]); }}>
              <X size={12} /> Clear Filters
            </button>
          )}
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-title">No items found</div><div className="empty-state-text">Try adjusting your filters</div></div>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Category</th><th>Current Qty</th><th>Min Qty</th><th>Unit</th><th>Unit Cost</th><th>Total Value</th><th>Supplier</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td className="font-bold" style={{ color: 'var(--c-text)' }}>{item.name}</td>
                    <td><span className="badge badge-neutral">{item.category}</span></td>
                    <td className={item.status !== 'OK' ? 'text-danger font-bold' : ''}>{item.current_quantity}</td>
                    <td className="text-muted">{item.minimum_quantity}</td>
                    <td>{item.unit}</td>
                    <td>{fmtJD(item.unit_cost)}</td>
                    <td className="text-gold font-bold">{fmtJD(item.current_quantity * item.unit_cost)}</td>
                    <td>{item.supplier || '—'}</td>
                    <td className={item.expiry_date && new Date(item.expiry_date) < new Date(Date.now() + 7*86400000) ? 'text-danger' : 'text-muted'}>{item.expiry_date || '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[item.status] || 'badge-neutral'}`}>{item.status}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(item)}><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
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
        title={editing ? 'Edit Inventory Item' : 'Add Inventory Item'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button id="save-inventory-btn" className="btn btn-primary" form="inventory-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : (editing ? 'Save Changes' : 'Add Item')}
            </button>
          </>
        }
      >
        <form id="inventory-form" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select id="inv-category" className="form-select" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

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
                  value={PACKAGING_LIST.some(p => p.value === selectedPackaging) ? selectedPackaging : 'Bag'}
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
                  id="inv-name"
                  className="form-input"
                  placeholder="e.g. Cardboard Box"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  required
                />
              </div>
            )}
          </div>
          <div className="form-grid mt-4">
            <div className="form-group">
              <label className="form-label">Current Quantity</label>
              <input id="inv-qty" className="form-input" type="number" step="0.01" min="0" value={form.current_quantity} onChange={e => setField('current_quantity', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input id="inv-unit" className="form-input" placeholder="kg, pcs, box..." value={form.unit} onChange={e => setField('unit', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Cost (JD)</label>
              <input id="inv-unit-cost" className="form-input" type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => setField('unit_cost', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Quantity</label>
              <input id="inv-min-qty" className="form-input" type="number" step="0.01" min="0" value={form.minimum_quantity} onChange={e => setField('minimum_quantity', e.target.value)} />
            </div>
          </div>
          <div className="form-grid mt-4">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input id="inv-supplier" className="form-input" placeholder="Supplier name" value={form.supplier} onChange={e => setField('supplier', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input id="inv-purchase-date" className="form-input" type="date" value={form.purchase_date || ''} onChange={e => setField('purchase_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input id="inv-expiry-date" className="form-input" type="date" value={form.expiry_date || ''} onChange={e => setField('expiry_date', e.target.value)} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
