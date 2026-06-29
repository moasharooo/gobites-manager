import { useEffect, useState } from 'react'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react'

const PLATFORMS = ['Instagram','TikTok','WhatsApp','Facebook','Google','Other']

const emptyForm = { name: '', platform: 'Instagram', start_date: '', end_date: '', budget: 0, messages_count: 0, orders_count: 0, sales_amount: 0, profit_amount: 0, notes: '' }

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`

const PLATFORM_BADGE = {
  Instagram: 'badge-danger',
  TikTok: 'badge-neutral',
  WhatsApp: 'badge-success',
  Facebook: 'badge-info',
  Google: 'badge-warning',
  Other: 'badge-neutral'
}

export default function Marketing() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/marketing').then(r => setCampaigns(r.data)).catch(console.error).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModal(true) }
  const openEdit = c => { setEditing(c); setForm({ ...c, start_date: c.start_date || '', end_date: c.end_date || '' }); setModal(true) }
  const closeModal = () => setModal(false)
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const roas = form.budget > 0 ? ((+form.sales_amount || 0) / +form.budget).toFixed(2) : '0.00'

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        budget: +form.budget,
        messages_count: +form.messages_count,
        orders_count: +form.orders_count,
        sales_amount: +form.sales_amount,
        profit_amount: +form.profit_amount,
        start_date: form.start_date || null,
        end_date: form.end_date || null
      }

      let campaignId = editing?.id
      if (editing) {
        await api.put(`/marketing/${editing.id}`, payload)
        toast.success('Campaign updated')
      } else {
        const res = await api.post('/marketing', payload)
        campaignId = res.data?.id
        toast.success('Campaign created')
      }

      // Auto-sync campaign budget to Expenses (Advertising category)
      if (+form.budget > 0) {
        const expenseName = `Campaign: ${form.name}`
        const expenseDate = form.start_date || new Date().toISOString().split('T')[0]
        try {
          // Fetch existing expenses to find one linked to this campaign
          const expRes = await api.get('/expenses')
          const existingExpense = expRes.data.find(ex =>
            ex.name === expenseName && ex.category === 'Advertising'
          )
          const expensePayload = {
            name: expenseName,
            category: 'Advertising',
            date: expenseDate,
            quantity: 1,
            unit: 'campaign',
            total_cost: +form.budget,
            supplier: form.platform,
            payment_method: 'Online',
            notes: `Auto-synced from Marketing — ${form.platform} campaign`
          }
          if (existingExpense) {
            await api.put(`/expenses/${existingExpense.id}`, expensePayload)
          } else {
            await api.post('/expenses', expensePayload)
          }
        } catch (syncErr) {
          console.warn('Expense sync failed:', syncErr)
        }
      }

      closeModal(); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this campaign?')) return
    try {
      // Find and delete linked expense first
      const camp = campaigns.find(c => c.id === id)
      if (camp) {
        try {
          const expRes = await api.get('/expenses')
          const linkedExpense = expRes.data.find(ex =>
            ex.name === `Campaign: ${camp.name}` && ex.category === 'Advertising'
          )
          if (linkedExpense) await api.delete(`/expenses/${linkedExpense.id}`)
        } catch { /* ignore */ }
      }
      await api.delete(`/marketing/${id}`)
      toast.success('Deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketing</h1>
          <p className="page-subtitle">Track campaign performance and ROAS</p>
        </div>
        <button id="add-campaign-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {loading ? (
        <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📣</div><div className="empty-state-title">No campaigns yet</div><div className="empty-state-text">Track your marketing spend and ROI</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {campaigns.map(c => (
            <div key={c.id} className="card">
              <div className="card-header">
                <div>
                  <div className="font-bold" style={{ color: 'var(--c-text)' }}>{c.name}</div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${PLATFORM_BADGE[c.platform] || 'badge-neutral'}`}>{c.platform}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(c)}><Pencil size={14} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <div><div className="form-label">Budget</div><div className="font-bold">{fmtJD(c.budget)}</div></div>
                  <div><div className="form-label">Sales</div><div className="text-gold font-bold">{fmtJD(c.sales_amount)}</div></div>
                  <div><div className="form-label">Profit</div><div className="text-success font-bold">{fmtJD(c.profit_amount)}</div></div>
                  <div><div className="form-label">ROAS</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TrendingUp size={14} color={c.roas >= 2 ? 'var(--c-success)' : 'var(--c-danger)'} />
                      <span className={`font-bold ${c.roas >= 2 ? 'text-success' : 'text-danger'}`}>{(+c.roas || 0).toFixed(2)}x</span>
                    </div>
                  </div>
                  <div><div className="form-label">Orders</div><div>{c.orders_count}</div></div>
                  <div><div className="form-label">Messages</div><div>{c.messages_count}</div></div>
                </div>
                {(c.start_date || c.end_date) && (
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
                    📅 {c.start_date || '?'} → {c.end_date || 'Ongoing'}
                  </div>
                )}
                {c.notes && <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>📝 {c.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={closeModal} title={editing ? 'Edit Campaign' : 'New Campaign'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button id="save-campaign-btn" className="btn btn-primary" form="campaign-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : (editing ? 'Save Changes' : 'Create Campaign')}
            </button>
          </>
        }
      >
        <form id="campaign-form" onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Campaign Name *</label>
            <input id="camp-name" className="form-input" placeholder="e.g. Ramadan Instagram Ad" value={form.name} onChange={e => setField('name', e.target.value)} required />
          </div>
          <div className="form-grid mt-4">
            <div className="form-group">
              <label className="form-label">Platform</label>
              <select id="camp-platform" className="form-select" value={form.platform} onChange={e => setField('platform', e.target.value)}>
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Budget (JD) *</label>
              <input id="camp-budget" className="form-input" type="number" step="0.01" min="0" value={form.budget} onChange={e => setField('budget', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input id="camp-start" className="form-input" type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input id="camp-end" className="form-input" type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Orders Generated</label>
              <input id="camp-orders" className="form-input" type="number" min="0" value={form.orders_count} onChange={e => setField('orders_count', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Messages Sent</label>
              <input id="camp-messages" className="form-input" type="number" min="0" value={form.messages_count} onChange={e => setField('messages_count', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sales Generated (JD)</label>
              <input id="camp-sales" className="form-input" type="number" step="0.01" min="0" value={form.sales_amount} onChange={e => setField('sales_amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Profit Generated (JD)</label>
              <input id="camp-profit" className="form-input" type="number" step="0.01" min="0" value={form.profit_amount} onChange={e => setField('profit_amount', e.target.value)} />
            </div>
          </div>
          <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginTop: 16, display: 'flex', gap: 24 }}>
            <div><div className="form-label">ROAS Preview</div><div className={`font-bold ${+roas >= 2 ? 'text-success' : 'text-danger'}`}>{roas}x</div></div>
            <div><div className="form-label">ROI</div><div className={`font-bold ${form.profit_amount > form.budget ? 'text-success' : 'text-danger'}`}>{fmtJD(form.profit_amount - form.budget)}</div></div>
          </div>
          <div className="form-group mt-4">
            <label className="form-label">Notes</label>
            <textarea id="camp-notes" className="form-textarea" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
