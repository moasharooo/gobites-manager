import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Trash2, Eye, Search, FileSpreadsheet, FileText, X, AlertTriangle } from 'lucide-react'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'

const STATUS_OPTIONS = ['New', 'Preparing', 'Ready', 'With Delivery', 'Delivered', 'Cancelled']
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Credit Card', 'Online']

const STATUS_BADGE = {
  New: 'badge-info',
  Preparing: 'badge-warning',
  Ready: 'badge-gold',
  'With Delivery': 'badge-info',
  Delivered: 'badge-success',
  Cancelled: 'badge-danger'
}

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`
const today = () => new Date().toISOString().split('T')[0]

const EXPORT_COLUMNS = [
  { header: 'Order', key: 'order_number' },
  { header: 'Customer', key: 'customer_name' },
  { header: 'Date', key: 'order_date' },
  { header: 'Boxes', key: 'boxes_count' },
  { header: 'Subtotal', key: 'subtotal_fmt' },
  { header: 'Discount', key: 'discount_fmt' },
  { header: 'Delivery', key: 'delivery_fmt' },
  { header: 'Total', key: 'total_fmt' },
  { header: 'Payment', key: 'payment_method' },
  { header: 'Status', key: 'status' },
  { header: 'Notes', key: 'notes' },
]

export default function Orders() {
  const { user } = useAuth()
  const isStaff = user?.role === 'staff'
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [saving, setSaving] = useState(false)
  const [batches, setBatches] = useState([]) // production batches for stock warning
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [form, setForm] = useState({
    customer_id: '',
    order_date: today(),
    discount: 0,
    delivery_fee: 0,
    payment_method: 'Cash',
    notes: '',
    items: [],
    boxes_used: 0,
    bags_used: 0,
    stickers_used: 0
  })

  const load = async () => {
    try {
      const [o, p, c, b] = await Promise.all([
        api.get('/orders'),
        api.get('/products'),
        api.get('/customers'),
        api.get('/production-batches')
      ])
      setOrders(o.data)
      setProducts(p.data.filter(pr => pr.is_active))
      setCustomers(c.data)
      setBatches(b.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Auto-fill packaging suggestions when order items change
  useEffect(() => {
    if (!modal) return // only update if modal is active and creating new order
    const totalQty = form.items.reduce((s, it) => s + (+it.quantity || 0), 0)
    const suggestedBags = Math.ceil(totalQty / 3)
    setForm(prev => ({
      ...prev,
      boxes_used: totalQty,
      bags_used: suggestedBags,
      stickers_used: suggestedBags // stickers linked to bags by default
    }))
  }, [form.items, modal])

  const openAdd = () => {
    setForm({
      customer_id: '',
      order_date: today(),
      discount: 0,
      delivery_fee: 0,
      payment_method: 'Cash',
      notes: '',
      items: [{ product_id: '', quantity: 1, unit_price: 0 }],
      boxes_used: 1,
      bags_used: 1,
      stickers_used: 1
    })
    setCustomerSearch('')
    setCustomerDropdownOpen(false)
    setModal(true)
  }

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { product_id: '', quantity: 1, unit_price: 0 }] }))
  const removeItem = i => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const setItemField = (i, k, v) => {
    setForm(p => {
      const items = [...p.items]
      items[i] = { ...items[i], [k]: v }
      if (k === 'product_id') {
        const prod = products.find(pr => pr.id === +v)
        if (prod) items[i].unit_price = prod.selling_price
      }
      return { ...p, items }
    })
  }

  const subtotal = form.items.reduce((s, it) => s + (+it.quantity || 0) * (+it.unit_price || 0), 0)
  const packagingCost = form.boxes_used * 0.30 + form.bags_used * 0.25 + form.stickers_used * 0.015
  const totalAmount = subtotal - (+form.discount || 0) + (+form.delivery_fee || 0)

  // Calculate estimated product cost to show profit in modal
  const estimatedProductCost = form.items.reduce((s, it) => {
    const prod = products.find(p => p.id === +it.product_id)
    const costPerBox = prod ? prod.total_cost : 0
    return s + (+it.quantity || 0) * costPerBox
  }, 0)
  const estimatedProfit = totalAmount - estimatedProductCost - packagingCost - (+form.delivery_fee || 0)

  // Per-product remaining stock (from batches)
  const stockByProduct = useMemo(() => {
    const map = {}
    batches.forEach(b => {
      const pid = b.product_id
      if (!map[pid]) map[pid] = 0
      map[pid] += (b.remaining_pieces ?? b.total_pieces ?? 0)
    })
    return map
  }, [batches])

  // Stock warning: any order item where qty (boxes) * pieces_count > remaining pieces
  const stockWarnings = useMemo(() => {
    return form.items
      .filter(it => it.product_id)
      .map(it => {
        const prod = products.find(p => p.id === +it.product_id)
        if (!prod) return null
        const remaining = stockByProduct[prod.id] ?? 0
        const requestedPieces = (+it.quantity || 0) * (prod.pieces_count || 1)
        if (requestedPieces > remaining) {
          return {
            productName: prod.name,
            requested: +it.quantity,
            available: Math.floor(remaining / (prod.pieces_count || 1)),
            remainingPieces: remaining
          }
        }
        return null
      })
      .filter(Boolean)
  }, [form.items, products, stockByProduct])

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        customer_id: form.customer_id ? +form.customer_id : null,
        discount: +form.discount,
        delivery_fee: +form.delivery_fee,
        boxes_used: +form.boxes_used,
        bags_used: +form.bags_used,
        stickers_used: +form.stickers_used,
        items: form.items.map(it => ({
          product_id: +it.product_id,
          quantity: +it.quantity,
          unit_price: +it.unit_price
        }))
      }
      await api.post('/orders', payload)
      toast.success('Order created!')
      setModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error creating order')
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status })
      toast.success(`Status → ${status}`)
      load()
    } catch { toast.error('Failed to update status') }
  }

  const handleApprove = async id => {
    try {
      await api.put(`/orders/${id}/approve`)
      toast.success('Order approved!')
      load()
    } catch (err) { toast.error('Failed to approve') }
  }

  const handleReject = async id => {
    if (!confirm('Reject this order?')) return
    try {
      await api.put(`/orders/${id}/reject`)
      toast.success('Order rejected!')
      load()
    } catch (err) { toast.error('Failed to reject') }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this order? Packaging items will be restored to inventory.')) return
    try { await api.delete(`/orders/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const viewOrder = async id => {
    try {
      const res = await api.get(`/orders/${id}`)
      setSelectedOrder(res.data)
      setViewModal(true)
    } catch { toast.error('Failed to load order') }
  }

  const clearFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterPayment('')
    setMinPrice(''); setMaxPrice(''); setDateFrom(''); setDateTo('')
  }

  const filtered = orders
    .filter(o =>
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.status?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(o => !filterStatus || o.status === filterStatus)
    .filter(o => !filterPayment || o.payment_method === filterPayment)
    .filter(o => !minPrice || (+o.total_amount) >= +minPrice)
    .filter(o => !maxPrice || (+o.total_amount) <= +maxPrice)
    .filter(o => !dateFrom || o.order_date >= dateFrom)
    .filter(o => !dateTo   || o.order_date <= dateTo)

  const exportData = filtered.map(o => {
    const totalBoxes = o.items ? o.items.reduce((sum, item) => sum + item.quantity, 0) : 0
    return {
      ...o,
      customer_name: o.customer_name || '—',
      boxes_count: totalBoxes,
      subtotal_fmt: (+o.subtotal || 0).toFixed(2),
      discount_fmt: (+o.discount || 0).toFixed(2),
      delivery_fmt: (+o.delivery_fee || 0).toFixed(2),
      total_fmt: (+o.total_amount || 0).toFixed(2),
      profit_fmt: (+o.net_profit || 0).toFixed(2),
      notes: o.notes || '',
    }
  })

  const hasActiveFilters = search || filterStatus || filterPayment || minPrice || maxPrice || dateFrom || dateTo

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">{orders.length} total · {orders.filter(o => o.status === 'Delivered').length} delivered</p>
        </div>
        <button id="add-order-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> New Order
        </button>
      </div>

      {/* Orders Summary Stats (Hidden for Staff) */}
      {!isStaff && orders.length > 0 && (() => {
        const deliveredOrders = orders.filter(o => o.status !== 'Cancelled')
        const totalBoxesSold = deliveredOrders.reduce((s, o) =>
          s + (o.items ? o.items.reduce((ss, it) => ss + it.quantity, 0) : 0), 0)
        const totalPiecesSold = deliveredOrders.reduce((s, o) => {
          if (!o.items) return s
          return s + o.items.reduce((ss, it) => {
            const prod = products.find(p => p.id === it.product_id)
            return ss + it.quantity * (prod?.pieces_count || 1)
          }, 0)
        }, 0)
        const uniqueCustomers = new Set(orders.filter(o => o.customer_id).map(o => o.customer_id)).size
        const totalRevenue = deliveredOrders.reduce((s, o) => s + (+o.total_amount || 0), 0)
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(201,168,76,0.12) 100%)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C9A84C', marginBottom: 4 }}>Boxes Sold</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text)' }}>{totalBoxesSold.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{totalPiecesSold.toLocaleString()} pieces</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(92,158,80,0.12) 100%)', border: '1px solid rgba(92,158,80,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4CAF6E', marginBottom: 4 }}>Unique Customers</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text)' }}>{uniqueCustomers}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>registered buyers</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(91,155,213,0.12) 100%)', border: '1px solid rgba(91,155,213,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5B9BD5', marginBottom: 4 }}>Total Revenue</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text)' }}>{fmtJD(totalRevenue)}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{deliveredOrders.length} orders</div>
            </div>
          </div>
        )
      })()}

      <div className="card">
        {/* Search + Export row */}
        <div className="card-header">
          <div className="search-bar">
            <Search size={14} color="var(--c-text-3)" />
            <input id="order-search" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-muted" style={{ fontSize: 13 }}>{filtered.length} orders</span>
          <div className="export-btn-group">
            <button
              className="btn btn-sm btn-excel"
              onClick={() => exportToExcel(exportData, EXPORT_COLUMNS, `orders-${new Date().toISOString().slice(0,10)}`)}
              title="Export to Excel"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              className="btn btn-sm btn-pdf"
              onClick={() => exportToPDF(exportData, EXPORT_COLUMNS, `orders-${new Date().toISOString().slice(0,10)}`, 'GoBites – Orders Report')}
              title="Export to PDF"
            >
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="filter-bar">
          {/* Status filter */}
          <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Payment filter */}
          <select className="filter-select" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
            <option value="">All Payments</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Date range */}
          <input
            type="date"
            className="filter-date-input"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            title="From date"
            placeholder="From"
          />
          <span className="text-muted" style={{ fontSize: 12 }}>→</span>
          <input
            type="date"
            className="filter-date-input"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            title="To date"
            placeholder="To"
          />

          {/* Price range */}
          <input
            type="number"
            className="filter-date-input"
            placeholder="Min JD"
            min="0"
            step="0.01"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            style={{ width: 90 }}
            title="Minimum order total"
          />
          <span className="text-muted" style={{ fontSize: 12 }}>—</span>
          <input
            type="number"
            className="filter-date-input"
            placeholder="Max JD"
            min="0"
            step="0.01"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            style={{ width: 90 }}
            title="Maximum order total"
          />

          {hasActiveFilters && (
            <button className="filter-clear-btn" onClick={clearFilters}>
              <X size={12} /> Clear
            </button>
          )}
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🛒</div><div className="empty-state-title">No orders found</div><div className="empty-state-text">Try adjusting your filters</div></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order #</th><th>Customer</th><th>Created By</th><th>Date</th><th>Boxes</th>
                  {!isStaff && <th>Total</th>}
                  {!isStaff && <th>Profit</th>}
                  <th>Payment</th><th>Status</th><th>Approval</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const totalBoxes = o.items ? o.items.reduce((sum, item) => sum + item.quantity, 0) : 0
                  return (
                    <tr key={o.id}>
                      <td className="text-gold font-bold">{o.order_number}</td>
                      <td style={{ color: 'var(--c-text)' }}>{o.customer_name || '—'}</td>
                      <td className="text-muted" style={{ fontSize: 12 }}>{o.created_by_name || 'System'}</td>
                      <td className="text-muted">{o.order_date}</td>
                      <td className="text-muted">
                        {totalBoxes > 1
                          ? <span className="badge badge-gold">{totalBoxes} boxes</span>
                          : `${totalBoxes} box`
                        }
                      </td>
                      {!isStaff && <td className="font-bold">{fmtJD(o.total_amount)}</td>}
                      {!isStaff && <td className={o.net_profit >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>{fmtJD(o.net_profit)}</td>}
                      <td>
                        <span className={`badge ${o.payment_method === 'Cash' ? 'badge-success' : o.payment_method === 'Bank Transfer' ? 'badge-info' : o.payment_method === 'Credit Card' ? 'badge-gold' : 'badge-neutral'}`}>
                          {o.payment_method}
                        </span>
                      </td>
                      <td>
                        <select
                          className="status-select"
                          value={o.status}
                          onChange={e => handleStatusChange(o.id, e.target.value)}
                          disabled={isStaff || o.approval_status === 'Rejected'}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        {o.approval_status === 'Pending' && <span className="badge badge-warning">Pending</span>}
                        {o.approval_status === 'Approved' && <span className="badge badge-success">Approved</span>}
                        {o.approval_status === 'Rejected' && <span className="badge badge-danger">Rejected</span>}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => viewOrder(o.id)} title="View"><Eye size={14} /></button>
                          {!isStaff && o.approval_status === 'Pending' && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => handleApprove(o.id)}>Approve</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleReject(o.id)}>Reject</button>
                            </>
                          )}
                          {!isStaff && <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(o.id)} title="Delete"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New Order Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="New Order" size="modal-lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button id="save-order-btn" className="btn btn-primary" form="order-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Create Order'}
            </button>
          </>
        }
      >
        <form id="order-form" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Customer</label>
              {form.customer_id ? (
                // Show selected customer as a pill
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 13
                }}>
                  <span style={{ flex: 1, color: 'var(--c-text)', fontWeight: 500 }}>
                    {customers.find(c => c.id === +form.customer_id)?.name || 'Selected'}
                    {customers.find(c => c.id === +form.customer_id)?.phone
                      ? ` (${customers.find(c => c.id === +form.customer_id)?.phone})` : ''}
                  </span>
                  <button type="button"
                    onClick={() => { setField('customer_id', ''); setCustomerSearch(''); setCustomerDropdownOpen(false) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', padding: 2 }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                // Search input
                <>
                  <input
                    id="order-customer"
                    className="form-input"
                    placeholder="Search by name or phone..."
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true) }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    autoComplete="off"
                  />
                  {customerDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
                      background: '#1C1208',
                      border: '1px solid rgba(201,168,76,0.3)',
                      borderRadius: 'var(--r-md)', marginTop: 4,
                      maxHeight: 220, overflowY: 'auto',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                      backdropFilter: 'none'
                    }}>
                      {/* Walk-in option */}
                      <div
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--c-text-3)', borderBottom: '1px solid var(--c-border)' }}
                        onClick={() => { setField('customer_id', ''); setCustomerSearch(''); setCustomerDropdownOpen(false) }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        Walk-in / New Customer
                      </div>
                      {customers
                        .filter(c =>
                          !customerSearch ||
                          c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                          c.phone?.includes(customerSearch)
                        )
                        .map(c => (
                          <div
                            key={c.id}
                            style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13 }}
                            onClick={() => { setField('customer_id', c.id); setCustomerSearch(''); setCustomerDropdownOpen(false) }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{c.name}</span>
                            {c.phone && <span style={{ color: 'var(--c-text-3)', marginLeft: 8, fontSize: 12 }}>{c.phone}</span>}
                          </div>
                        ))
                      }
                      {customers.filter(c =>
                        !customerSearch ||
                        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                        c.phone?.includes(customerSearch)
                      ).length === 0 && (
                        <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--c-text-3)' }}>No customers found</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input id="order-date" className="form-input" type="date" value={form.order_date} onChange={e => setField('order_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select id="order-payment" className="form-select" value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="divider" style={{ margin: '20px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="form-label">Order Items</div>
            <button type="button" id="add-order-item-btn" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={14} /> Add Item</button>
          </div>

          {form.items.map((item, i) => (
            <div key={i} className="form-grid" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
              <div className="form-group">
                <label className="form-label">Product</label>
                <select className="form-select" value={item.product_id} onChange={e => setItemField(i, 'product_id', e.target.value)} required>
                  <option value="">Select product...</option>
                  {products.map(p => {
                    const remPieces = stockByProduct[p.id] ?? 0
                    const remBoxes = Math.floor(remPieces / (p.pieces_count || 1))
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({fmtJD(p.selling_price)}) — {remBoxes} boxes available
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Qty</label>
                <input className="form-input" type="number" min="1" value={item.quantity} onChange={e => setItemField(i, 'quantity', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (JD)</label>
                <input className="form-input" type="number" step="0.01" min="0" value={item.unit_price} onChange={e => setItemField(i, 'unit_price', e.target.value)} required />
              </div>
              <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)} style={{ marginBottom: 0 }}><Trash2 size={14} /></button>
            </div>
          ))}

          {/* ── Stock Warning ─────────────────────────────────────────── */}
          {stockWarnings.length > 0 && (
            <div style={{
              background: 'rgba(224,82,82,0.12)',
              border: '1px solid rgba(224,82,82,0.4)',
              borderRadius: 'var(--r-md)',
              padding: '12px 16px',
              marginBottom: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#E05252', fontSize: 13 }}>
                <AlertTriangle size={15} />
                Not enough stock for this order!
              </div>
              {stockWarnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: '#F0A0A0', marginLeft: 23 }}>
                  <strong>{w.productName}</strong>: requested {w.requested} boxes, only {w.available} available ({w.remainingPieces} pcs)
                </div>
              ))}
            </div>
          )}

          {/* ── Packaging Section ──────────────────────────────────────── */}
          <div className="divider" style={{ margin: '20px 0' }} />
          <div className="form-label" style={{ marginBottom: 12 }}>Packaging Materials Used</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Boxes (0.30 JD each)</label>
              <input className="form-input" type="number" min="0" value={form.boxes_used} onChange={e => setField('boxes_used', +e.target.value || 0)} />
            </div>
            <div className="form-group">
              <label className="form-label">Bags (0.25 JD each)</label>
              <input className="form-input" type="number" min="0" value={form.bags_used} onChange={e => {
                const bags = +e.target.value || 0
                setForm(prev => ({
                  ...prev,
                  bags_used: bags,
                  stickers_used: bags // update stickers to match bags automatically (with manual override allowed)
                }))
              }} />
            </div>
            <div className="form-group">
              <label className="form-label">Stickers (0.015 JD each)</label>
              <input className="form-input" type="number" min="0" value={form.stickers_used} onChange={e => setField('stickers_used', +e.target.value || 0)} />
            </div>
          </div>

          <div className="divider" style={{ margin: '20px 0' }} />
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Discount (JD)</label>
              <input id="order-discount" className="form-input" type="number" step="0.01" min="0" value={form.discount} onChange={e => setField('discount', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Fee (JD)</label>
              <input id="order-delivery" className="form-input" type="number" step="0.01" min="0" value={form.delivery_fee} onChange={e => setField('delivery_fee', e.target.value)} />
            </div>
          </div>

          <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', padding: '16px', marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div><div className="form-label">Subtotal</div><div className="font-bold">{fmtJD(subtotal)}</div></div>
            {!isStaff && <div><div className="form-label">Packaging Cost</div><div className="text-danger">{fmtJD(packagingCost)}</div></div>}
            <div><div className="form-label">Total Amount</div><div className="text-gold font-bold">{fmtJD(totalAmount)}</div></div>
            {!isStaff && <div><div className="form-label">Est. Profit</div><div className={estimatedProfit >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>{fmtJD(estimatedProfit)}</div></div>}
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Notes</label>
            <textarea id="order-notes" className="form-textarea" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </form>
      </Modal>

      {/* View Order Modal */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title={`Order ${selectedOrder?.order_number}`} size="modal-lg">
        {selectedOrder && (
          <div>
            <div className="form-grid">
              <div><div className="form-label">Customer</div><div className="font-bold">{selectedOrder.customer_name || '—'}</div></div>
              <div><div className="form-label">Date</div><div>{selectedOrder.order_date}</div></div>
              <div><div className="form-label">Status</div><span className={`badge ${STATUS_BADGE[selectedOrder.status] || 'badge-neutral'}`}>{selectedOrder.status}</span></div>
              <div><div className="form-label">Payment</div><div>{selectedOrder.payment_method}</div></div>
            </div>
            <div className="divider" />
            <table>
              <thead><tr><th>Product</th><th>Qty (Boxes)</th><th>Unit Price</th><th>Total</th><th>Cost</th><th>Profit</th></tr></thead>
              <tbody>
                {selectedOrder.items?.map(item => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{fmtJD(item.unit_price)}</td>
                    <td className="font-bold">{fmtJD(item.total_price)}</td>
                    <td className="text-muted">{fmtJD(item.estimated_cost)}</td>
                    <td className="text-success font-bold">{fmtJD(item.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {!isStaff && (
              <>
                <div className="divider" />
                <div className="form-grid">
                  <div><div className="form-label">Boxes Used</div><div className="font-bold">{selectedOrder.boxes_used || 0}</div></div>
                  <div><div className="form-label">Bags Used</div><div className="font-bold">{selectedOrder.bags_used || 0}</div></div>
                  <div><div className="form-label">Stickers Used</div><div className="font-bold">{selectedOrder.stickers_used || 0}</div></div>
                  <div><div className="form-label">Packaging Cost</div><div className="text-danger font-bold">{fmtJD(selectedOrder.packaging_cost)}</div></div>
                </div>

                <div className="divider" />
                <div className="form-grid">
                  <div><div className="form-label">Subtotal</div><div>{fmtJD(selectedOrder.subtotal)}</div></div>
                  <div><div className="form-label">Discount</div><div className="text-danger">- {fmtJD(selectedOrder.discount)}</div></div>
                  <div><div className="form-label">Delivery</div><div>{fmtJD(selectedOrder.delivery_fee)}</div></div>
                  <div><div className="form-label">Total</div><div className="text-gold font-bold">{fmtJD(selectedOrder.total_amount)}</div></div>
                  <div><div className="form-label">Net Profit</div><div className={selectedOrder.net_profit >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>{fmtJD(selectedOrder.net_profit)}</div></div>
                </div>
              </>
            )}
            {isStaff && (
              <>
                <div className="divider" />
                <div className="form-grid">
                  <div><div className="form-label">Subtotal</div><div>{fmtJD(selectedOrder.subtotal)}</div></div>
                  <div><div className="form-label">Discount</div><div className="text-danger">- {fmtJD(selectedOrder.discount)}</div></div>
                  <div><div className="form-label">Delivery</div><div>{fmtJD(selectedOrder.delivery_fee)}</div></div>
                  <div><div className="form-label">Total</div><div className="text-gold font-bold">{fmtJD(selectedOrder.total_amount)}</div></div>
                </div>
              </>
            )}
            {selectedOrder.notes && <p className="text-muted mt-4" style={{ fontSize: 13 }}>📝 {selectedOrder.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
