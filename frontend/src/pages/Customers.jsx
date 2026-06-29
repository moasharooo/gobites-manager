import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search, MessageCircle, FileSpreadsheet, FileText, X, Info } from 'lucide-react'
import { exportToExcel, exportToPDF, exportCustomerOrdersPDF } from '../utils/exportUtils'

const GOVERNORATES = [
  'Amman', 'Zarqa', 'Irbid', 'Balqa', 'Madaba', 
  'Aqaba', 'Jerash', 'Ajloun', 'Mafraq', 'Karak', 
  'Tafilah', 'Ma\'an'
]
const SOURCES = ['Instagram', 'TikTok', 'Referral', 'WhatsApp', 'Friend', 'Paid Ad']

const emptyForm = { name: '', phone: '', area: 'Amman', gender: '', customer_type: '', source: 'Instagram', notes: '' }

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`

const SOURCE_BADGE = {
  Instagram: 'badge-danger',
  TikTok: 'badge-neutral',
  Referral: 'badge-success',
  WhatsApp: 'badge-success',
  Friend: 'badge-info',
  'Paid Ad': 'badge-gold'
}

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name' },
  { header: 'Phone', key: 'phone' },
  { header: 'Governorate', key: 'area' },
  { header: 'Detailed Location', key: 'customer_type' },
  { header: 'Gender', key: 'gender' },
  { header: 'Source', key: 'source' },
  { header: 'Total Orders', key: 'total_orders' },
  { header: 'Total Spent', key: 'total_purchases_fmt' },
  { header: 'Notes', key: 'notes' },
]

export default function Customers() {
  const { user } = useAuth()
  const isStaff = user?.role === 'staff'
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [minOrders, setMinOrders] = useState('')

  const load = () => api.get('/customers').then(r => setCustomers(r.data)).catch(console.error).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModal(true) }
  const openEdit = c => { setEditing(c); setForm({ ...c }); setModal(true) }
  const closeModal = () => setModal(false)
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, form)
        toast.success('Customer updated')
      } else {
        await api.post('/customers', form)
        toast.success('Customer added')
      }
      closeModal(); load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally { setSaving(false) }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this customer?')) return
    try { await api.delete(`/customers/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const openWhatsApp = phone => {
    if (!phone) { toast.error('No phone number for this customer'); return }
    const cleaned = phone.replace(/\D/g, '')
    const number = cleaned.startsWith('0') ? '962' + cleaned.slice(1) : cleaned
    window.open(`https://wa.me/${number}`, '_blank')
  }

  const handleCustomerHistoryPDF = async (customer) => {
    const loadToast = toast.loading(`Generating order history for ${customer.name}...`)
    try {
      const res = await api.get('/orders')
      const allOrders = res.data
      const customerOrders = allOrders.filter(o => o.customer_id === customer.id)
      
      toast.dismiss(loadToast)
      if (customerOrders.length === 0) {
        toast.error('This customer has no orders yet')
        return
      }
      
      exportCustomerOrdersPDF(customer, customerOrders)
      toast.success('History report ready')
    } catch (err) {
      toast.dismiss(loadToast)
      console.error(err)
      toast.error('Failed to generate order history')
    }
  }

  const clearFilters = () => {
    setSearch(''); setFilterArea(''); setFilterSource(''); setFilterGender(''); setMinOrders('')
  }

  const filtered = customers
    .filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.area?.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_type?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(c => !filterArea || c.area === filterArea)
    .filter(c => !filterSource || c.source === filterSource)
    .filter(c => !filterGender || c.gender === filterGender)
    .filter(c => !minOrders || (c.total_orders >= +minOrders))

  const exportData = filtered.map(c => ({
    ...c,
    total_purchases_fmt: (+c.total_purchases || 0).toFixed(2),
    phone: c.phone || '—',
    area: c.area || '—',
    customer_type: c.customer_type || '—',
    notes: c.notes || '',
  }))

  const hasActiveFilters = search || filterArea || filterSource || filterGender || minOrders

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} registered customers</p>
        </div>
        <button id="add-customer-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="card">
        {/* Search + Export row */}
        <div className="card-header">
          <div className="search-bar">
            <Search size={14} color="var(--c-text-3)" />
            <input id="customer-search" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-muted" style={{ fontSize: 13 }}>{filtered.length} customers</span>
          {!isStaff && (
            <div className="export-btn-group">
              <button
                className="btn btn-sm btn-excel"
                onClick={() => exportToExcel(exportData, EXPORT_COLUMNS, `customers-${new Date().toISOString().slice(0,10)}`)}
                title="Export to Excel"
              >
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button
                className="btn btn-sm btn-pdf"
                onClick={() => exportToPDF(exportData, EXPORT_COLUMNS, `customers-${new Date().toISOString().slice(0,10)}`, 'GoBites – Customers Report')}
                title="Export to PDF"
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          )}
        </div>

        {/* Advanced Filters */}
        <div className="filter-bar">
          <select
            className="filter-select"
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
          >
            <option value="">All Governorates</option>
            {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            className="filter-select"
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
          >
            <option value="">All Sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            className="filter-select"
            value={filterGender}
            onChange={e => setFilterGender(e.target.value)}
          >
            <option value="">All Genders</option>
            <option value="Male">Male ♂</option>
            <option value="Female">Female ♀</option>
          </select>

          <input
            type="number"
            className="filter-date-input"
            placeholder="Min Orders"
            min="0"
            value={minOrders}
            onChange={e => setMinOrders(e.target.value)}
            style={{ width: 110 }}
            title="Filter by minimum number of orders"
          />

          {hasActiveFilters && (
            <button className="filter-clear-btn" onClick={clearFilters}>
              <X size={12} /> Clear Filters
            </button>
          )}
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">👥</div><div className="empty-state-title">No customers found</div><div className="empty-state-text">Try adjusting your filters</div></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th><th>Governorate</th><th>Detailed Location</th><th>Source</th><th>Orders</th>
                  {!isStaff && <th>Total Spent</th>}
                  <th>Last Order</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="font-bold" style={{ color: 'var(--c-text)' }}>{c.name}</td>
                    <td className="text-muted">{c.phone || '—'}</td>
                    <td>{c.area || '—'}</td>
                    <td>{c.customer_type || '—'}</td>
                    <td><span className={`badge ${SOURCE_BADGE[c.source] || 'badge-neutral'}`}>{c.source || '—'}</span></td>
                    <td className="font-bold">
                      {c.total_orders > 1
                        ? <span className="badge badge-success">{c.total_orders}</span>
                        : c.total_orders
                      }
                    </td>
                    {!isStaff && <td className="text-gold font-bold">{fmtJD(c.total_purchases)}</td>}
                    <td className="text-muted">{c.last_order_date || '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleCustomerHistoryPDF(c)}
                          title="View Order History PDF"
                          style={{ color: '#C9A84C' }}
                        >
                          <Info size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => openWhatsApp(c.phone)}
                          title="Send WhatsApp Message"
                          style={{ color: '#25D366' }}
                        >
                          <MessageCircle size={14} />
                        </button>
                        {!isStaff && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(c)} title="Edit"><Pencil size={14} /></button>}
                        {!isStaff && <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)} title="Delete"><Trash2 size={14} /></button>}
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
        title={editing ? 'Edit Customer' : 'Add Customer'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button id="save-customer-btn" className="btn btn-primary" form="customer-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : (editing ? 'Save Changes' : 'Add Customer')}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input id="cust-name" className="form-input" placeholder="Customer name" value={form.name} onChange={e => setField('name', e.target.value)} required />
          </div>
          <div className="form-grid mt-4">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input id="cust-phone" className="form-input" placeholder="07x xxx xxxx" value={form.phone} onChange={e => setField('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Governorate *</label>
              <select id="cust-area" className="form-select" value={form.area} onChange={e => setField('area', e.target.value)} required>
                {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Detailed Location</label>
              <input id="cust-detail-loc" className="form-input" placeholder="Building #, Street, etc. (Optional)" value={form.customer_type} onChange={e => setField('customer_type', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select id="cust-gender" className="form-select" value={form.gender} onChange={e => setField('gender', e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Source</label>
              <select id="cust-source" className="form-select" value={form.source} onChange={e => setField('source', e.target.value)}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group mt-4">
            <label className="form-label">Notes</label>
            <textarea id="cust-notes" className="form-textarea" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
