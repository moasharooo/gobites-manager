import { useEffect, useState } from 'react'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, TrendingUp, FlaskConical, Check, Save } from 'lucide-react'

const emptyForm = {
  name: '', description: '', pieces_count: '', selling_price: '',
  cost_per_piece: 0, packaging_cost: 0, image_url: '', is_active: true,
  recipe: []
}

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`

export default function Products() {
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details') // 'details' | 'recipe'

  const load = () => Promise.all([
    api.get('/products'),
    api.get('/inventory')
  ]).then(([p, inv]) => {
    setProducts(p.data)
    setInventory(inv.data.filter(i => i.category === 'Raw Materials'))
  }).catch(console.error).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setActiveTab('details')
    setModal(true)
  }

  const openEdit = p => {
    setEditing(p)
    setForm({
      ...p,
      recipe: (p.recipe || []).map(r => {
        const invItem = inventory.find(inv => inv.id === r.inventory_item_id)
        return {
          id: r.id,
          inventory_item_id: r.inventory_item_id,
          quantity_per_piece: r.quantity_per_piece,
          input_unit: r.input_unit || invItem?.unit || null,
          original: {
            inventory_item_id: r.inventory_item_id,
            quantity_per_piece: r.quantity_per_piece,
            input_unit: r.input_unit || invItem?.unit || null
          }
        }
      })
    })
    setActiveTab('details')
    setModal(true)
  }

  const closeModal = () => setModal(false)
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Recipe helpers
  const addRecipeRow = () => setForm(p => ({ ...p, recipe: [...p.recipe, { inventory_item_id: '', quantity_per_piece: '', input_unit: null }] }))
  
  const removeRecipeRow = i => setForm(p => ({ ...p, recipe: p.recipe.filter((_, idx) => idx !== i) }))
  
  const setRecipeField = (i, k, v) => setForm(p => {
    const recipe = [...p.recipe]
    recipe[i] = { ...recipe[i], [k]: v }
    return { ...p, recipe }
  })

  // When an inventory item is selected for a recipe row, auto-set input_unit to item's unit
  const handleRecipeItemChange = (i, itemId) => {
    const item = inventory.find(inv => inv.id === +itemId)
    const defaultUnit = item?.unit || null
    setForm(p => {
      const recipe = [...p.recipe]
      recipe[i] = { ...recipe[i], inventory_item_id: itemId, input_unit: defaultUnit }
      return { ...p, recipe }
    })
  }

  // ── Save or Delete Single Row (Individual CRUD) ─────────────────────────────
  const handleSaveRow = async (idx) => {
    const row = form.recipe[idx]
    if (!row.inventory_item_id || !row.quantity_per_piece) {
      toast.error('Please select a material and enter quantity')
      return
    }

    try {
      const payload = {
        inventory_item_id: +row.inventory_item_id,
        quantity_per_piece: +row.quantity_per_piece,
        input_unit: row.input_unit
      }

      if (row.id) {
        // Update existing ingredient
        const res = await api.put(`/products/recipe-ingredients/${row.id}`, payload)
        toast.success('Saved successfully')
        setForm(p => {
          const newRecipe = [...p.recipe]
          newRecipe[idx] = {
            ...res.data,
            original: { ...res.data }
          }
          return { ...p, recipe: newRecipe }
        })
      } else {
        // Create new ingredient on backend immediately
        const res = await api.post(`/products/${editing.id}/recipe-ingredients`, payload)
        toast.success('Added successfully')
        setForm(p => {
          const newRecipe = [...p.recipe]
          newRecipe[idx] = {
            ...res.data,
            original: { ...res.data }
          }
          return { ...p, recipe: newRecipe }
        })
      }
      // Reload products state in background to update main table
      api.get('/products').then(r => setProducts(r.data)).catch(console.error)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving ingredient')
    }
  }

  const handleDeleteRow = async (idx) => {
    const row = form.recipe[idx]
    if (!row.id) {
      // Just local delete (row not in db yet)
      removeRecipeRow(idx)
      return
    }

    if (!confirm('Delete this ingredient from the recipe?')) return

    try {
      await api.delete(`/products/recipe-ingredients/${row.id}`)
      toast.success('Deleted successfully')
      removeRecipeRow(idx)
      // Reload products state in background
      api.get('/products').then(r => setProducts(r.data)).catch(console.error)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete')
    }
  }

  const getIngredientCost = (r) => {
    const invItem = inventory.find(inv => inv.id === +r.inventory_item_id)
    if (!invItem || !r.quantity_per_piece) return 0
    
    const baseUnit = invItem.unit || ''
    const inputUnit = r.input_unit || baseUnit
    let qty = +r.quantity_per_piece || 0
    
    // Convert to base unit
    if (inputUnit === 'g' && baseUnit === 'kg') {
      qty = qty / 1000
    } else if (inputUnit === 'kg' && baseUnit === 'g') {
      qty = qty * 1000
    }
    
    return qty * (invItem.unit_cost || 0)
  }

  const calculatedTotalCost = form.recipe.reduce((sum, r) => sum + getIngredientCost(r), 0)
  const calculatedCostPerPiece = calculatedTotalCost / (+form.pieces_count || 1)
  const profit = (+form.selling_price || 0) - calculatedTotalCost
  const margin = form.selling_price > 0 ? (profit / +form.selling_price * 100) : 0

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      // Note: for existing products, recipe ingredients are saved individually.
      // We only convert/map recipe for new product creation.
      const payload = {
        ...form,
        pieces_count: +form.pieces_count,
        selling_price: +form.selling_price,
        cost_per_piece: 0,
        packaging_cost: 0,
        recipe: form.recipe
          .filter(r => r.inventory_item_id && r.quantity_per_piece)
          .map(r => ({
            inventory_item_id: +r.inventory_item_id,
            quantity_per_piece: +r.quantity_per_piece,
            input_unit: r.input_unit
          }))
      }
      if (editing) { await api.put(`/products/${editing.id}`, payload); toast.success('Product updated') }
      else { await api.post('/products', payload); toast.success('Product created') }
      closeModal(); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this product?')) return
    try { await api.delete(`/products/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const EMOJIS = { 'Box 6': '🎁', 'Box 12': '🍫', 'Box 24': '🎀', 'Family Box': '👨‍👩‍👧', 'Gift Box': '🎁', 'Corporate Box': '💼' }

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{products.filter(p => p.is_active).length} active products</p>
        </div>
        <button id="add-product-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      {loading ? (
        <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
      ) : products.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🍫</div><div className="empty-state-title">No products yet</div><div className="empty-state-text">Add your chocolate boxes and gift sets</div></div>
      ) : (
        <div className="products-grid">
          {products.map(p => (
            <div key={p.id} className="product-card">
              <div className="product-card-img">
                {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{EMOJIS[p.name] || '🍫'}</span>}
              </div>
              <div className="product-card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div className="product-card-name">{p.name}</div>
                  <span className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="product-card-meta">{p.pieces_count} pieces · Cost: {fmtJD(p.total_cost)}</div>
                <div className="product-card-price">{fmtJD(p.selling_price)}</div>
                <div className="product-card-profit">
                  <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Profit: {fmtJD(p.profit)} · Margin: {(+p.profit_margin || 0).toFixed(1)}%
                </div>
                {/* Recipe badge */}
                {p.recipe && p.recipe.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--c-accent)', opacity: 0.85 }}>
                    <FlaskConical size={11} />
                    Recipe: {p.recipe.length} ingredient{p.recipe.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <div className="product-card-footer">
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openEdit(p)}><Pencil size={13} /> Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={closeModal} title={editing ? 'Edit Product' : 'New Product'} size="modal-lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button id="save-product-btn" className="btn btn-primary" form="product-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : (editing ? 'Save Changes' : 'Create Product')}
            </button>
          </>
        }
      >
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--c-border)', paddingBottom: 0 }}>
          {[
            { key: 'details', label: '📦 Product Details' },
            { key: 'recipe', label: '🧪 Recipe' }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--c-accent)' : '2px solid transparent',
                background: 'none',
                color: activeTab === tab.key ? 'var(--c-accent)' : 'var(--c-text-3)',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                fontSize: 13,
                transition: 'all 0.15s',
                marginBottom: -1
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form id="product-form" onSubmit={handleSave}>

          {/* ── DETAILS TAB ─────────────────────────────────────────── */}
          <div style={{ display: activeTab === 'details' ? 'block' : 'none' }}>
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input id="prod-name" className="form-input" placeholder="e.g. Box 12" value={form.name} onChange={e => setField('name', e.target.value)} required />
            </div>
            <div className="form-group mt-4">
              <label className="form-label">Description</label>
              <textarea id="prod-desc" className="form-textarea" rows={2} value={form.description} onChange={e => setField('description', e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-grid mt-4">
              <div className="form-group">
                <label className="form-label">Pieces Count *</label>
                <input id="prod-pieces" className="form-input" type="number" min="1" value={form.pieces_count} onChange={e => setField('pieces_count', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price (JD) *</label>
                <input id="prod-price" className="form-input" type="number" step="0.01" min="0" value={form.selling_price} onChange={e => setField('selling_price', e.target.value)} required />
              </div>
            </div>

            <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', padding: '16px', marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div><div className="form-label" style={{ fontSize: 11 }}>Cost/Piece</div><div className="font-bold">{fmtJD(calculatedCostPerPiece)}</div></div>
              <div><div className="form-label" style={{ fontSize: 11 }}>Box Food Cost</div><div className="font-bold">{fmtJD(calculatedTotalCost)}</div></div>
              <div><div className="form-label" style={{ fontSize: 11 }}>Profit</div><div className={`font-bold ${profit >= 0 ? 'text-success' : 'text-danger'}`}>{fmtJD(profit)}</div></div>
              <div><div className="form-label" style={{ fontSize: 11 }}>Margin</div><div className={`font-bold ${margin >= 20 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger'}`}>{margin.toFixed(1)}%</div></div>
            </div>

            <div className="form-group mt-4">
              <label className="form-label">Image URL</label>
              <input id="prod-image" className="form-input" placeholder="https://..." value={form.image_url} onChange={e => setField('image_url', e.target.value)} />
            </div>
            <div className="form-group mt-4" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <input id="prod-active" type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} style={{ width: 16, height: 16 }} />
              <label className="form-label" htmlFor="prod-active" style={{ margin: 0, cursor: 'pointer' }}>Active (visible in orders)</label>
            </div>
          </div>

          {/* ── RECIPE TAB ──────────────────────────────────────────── */}
          <div style={{ display: activeTab === 'recipe' ? 'block' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div className="form-label" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Recipe Ingredients</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-3)' }}>
                  Specify how much of each raw material is used <strong>for 1 product box ({form.pieces_count || 'N'} pieces)</strong>.
                  {editing ? " Save each ingredient row individually." : " The recipe will be created when you create the product."}
                </div>
              </div>
              <button type="button" id="add-recipe-btn" className="btn btn-secondary btn-sm" onClick={addRecipeRow} style={{ flexShrink: 0, marginLeft: 12 }}>
                <Plus size={14} /> Add Ingredient
              </button>
            </div>

            {form.recipe.length === 0 ? (
              <div style={{
                border: '2px dashed var(--c-border)',
                borderRadius: 'var(--r-md)',
                padding: '32px 20px',
                textAlign: 'center',
                color: 'var(--c-text-3)'
              }}>
                <FlaskConical size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>No recipe defined yet.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Ingredient" to define the recipe for this product.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 80px', gap: 8, padding: '4px 0', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Raw Material</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 40 }}>Qty / Product ({form.pieces_count || 'N'} pieces)</div>
                  <div />
                </div>
                {form.recipe.map((row, i) => {
                  const selectedItem = inventory.find(inv => inv.id === +row.inventory_item_id)
                  const baseUnit = selectedItem?.unit || ''
                  const showGKgToggle = baseUnit === 'g' || baseUnit === 'kg'
                  const inputUnit = row.input_unit || baseUnit
                  
                  // Check if row has been changed compared to original DB state
                  const isChanged = !row.id || (
                    row.inventory_item_id !== row.original?.inventory_item_id ||
                    row.quantity_per_piece !== row.original?.quantity_per_piece ||
                    row.input_unit !== row.original?.input_unit
                  )

                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 80px', gap: 8, alignItems: 'center', padding: '10px 12px', background: 'var(--c-surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--c-border)' }}>
                      <select
                        className="form-select"
                        value={row.inventory_item_id}
                        onChange={e => handleRecipeItemChange(i, e.target.value)}
                        style={{ margin: 0 }}
                      >
                        <option value="">Select raw material...</option>
                        {inventory.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} (available: {inv.current_quantity} {inv.unit})
                          </option>
                        ))}
                      </select>

                      {/* Qty input + unit picker */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                        <input
                          className="form-input"
                          type="number"
                          step="1"
                          min="0"
                          placeholder="e.g. 4"
                          value={row.quantity_per_piece}
                          onChange={e => setRecipeField(i, 'quantity_per_piece', e.target.value)}
                          style={{ margin: 0, width: 80, minWidth: 0 }}
                        />
                        {/* g / kg toggle buttons */}
                        {showGKgToggle ? (
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            {['g', 'kg'].map(u => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => setRecipeField(i, 'input_unit', u)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  border: '1px solid',
                                  borderColor: inputUnit === u ? 'var(--c-accent)' : 'var(--c-border)',
                                  borderRadius: 'var(--r-sm)',
                                  background: inputUnit === u ? 'var(--c-accent)' : 'var(--c-surface-3)',
                                  color: inputUnit === u ? '#1a0d00' : 'var(--c-text-3)',
                                  cursor: 'pointer',
                                  transition: 'all 0.12s',
                                  letterSpacing: '0.03em'
                                }}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        ) : baseUnit ? (
                          <span style={{ fontSize: 11, color: 'var(--c-text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {baseUnit}
                          </span>
                        ) : null}
                      </div>

                      {/* Individual CRUD Controls */}
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {editing && (
                          <button
                            type="button"
                            className={`btn btn-icon ${isChanged ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => handleSaveRow(i)}
                            style={{ margin: 0, padding: 6, height: 32, width: 32 }}
                            title={row.id ? "Save this ingredient" : "Add this ingredient"}
                            disabled={!isChanged}
                          >
                            {row.id ? <Save size={14} /> : <Check size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDeleteRow(i)}
                          style={{ margin: 0, padding: 6, height: 32, width: 32 }}
                          title="Delete ingredient"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Recipe summary */}
                {form.pieces_count > 0 && form.recipe.some(r => r.inventory_item_id && r.quantity_per_piece) && (
                  <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 'var(--r-md)' }}>
                    <div style={{ fontSize: 12, color: 'var(--c-accent)', fontWeight: 600, marginBottom: 8 }}>
                      📦 For 1 product/box ({form.pieces_count} pieces):
                    </div>
                    {form.recipe.filter(r => r.inventory_item_id && r.quantity_per_piece).map((r, i) => {
                      const item = inventory.find(inv => inv.id === +r.inventory_item_id)
                      if (!item) return null
                      const total = +(r.quantity_per_piece) || 0
                      const displayUnit = r.input_unit || item.unit || ''
                      return (
                        <div key={i} style={{ fontSize: 12, color: 'var(--c-text-2)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>{item.name}</span>
                          <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{total.toFixed(2)} {displayUnit}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        </form>
      </Modal>
    </div>
  )
}
