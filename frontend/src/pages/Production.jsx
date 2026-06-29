import { useEffect, useState } from 'react'
import api from '../api/client'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Trash2, Factory, ChevronDown, ChevronUp, FlaskConical, Package } from 'lucide-react'

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`
const today = () => new Date().toISOString().split('T')[0]

export default function Production() {
  const [batches, setBatches] = useState([])
  const [inventory, setInventory] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({
    batch_name: '', production_date: today(), flavor: '',
    total_pieces: '', packaging_cost: 0, labor_cost: 0, notes: '',
    ingredients: [], product_id: ''
  })

  // Recipe auto-fill state
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [useRecipe, setUseRecipe] = useState(true) // when product has recipe, use it automatically

  const load = async () => {
    try {
      const [b, inv, prod] = await Promise.all([
        api.get('/production-batches'),
        api.get('/inventory'),
        api.get('/products')
      ])
      setBatches(b.data)
      setInventory(inv.data)
      setProducts(prod.data.filter(p => p.is_active))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm({
      batch_name: `Batch-${String(batches.length + 1).padStart('3', '0')}`,
      production_date: today(), flavor: '', total_pieces: '',
      packaging_cost: 0, labor_cost: 0, notes: '', ingredients: [], product_id: ''
    })
    setSelectedProduct(null)
    setUseRecipe(true)
    setModal(true)
  }

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // When product selection changes, update selected product state
  const handleProductChange = productId => {
    setField('product_id', productId)
    if (!productId) {
      setSelectedProduct(null)
      return
    }
    const prod = products.find(p => p.id === +productId)
    setSelectedProduct(prod || null)
  }

  // Compute the expected ingredients from the recipe given total_pieces
  const recipePreview = () => {
    if (!selectedProduct || !selectedProduct.recipe || !useRecipe) return []
    const pieces = +form.total_pieces || 0
    const piecesPerBox = selectedProduct.pieces_count || 1
    return selectedProduct.recipe.map(r => {
      const invItem = inventory.find(i => i.id === r.inventory_item_id)
      const baseUnit = invItem?.unit || ''
      const inputUnit = r.input_unit || baseUnit
      
      // Calculate quantity per piece in the database base unit (e.g. kg)
      let qtyPerPieceBase = r.quantity_per_piece
      if (inputUnit === 'g' && baseUnit === 'kg') {
        qtyPerPieceBase = r.quantity_per_piece / 1000
      } else if (inputUnit === 'kg' && baseUnit === 'g') {
        qtyPerPieceBase = r.quantity_per_piece * 1000
      }

      const qtyPerSinglePieceBase = qtyPerPieceBase / piecesPerBox
      const totalQtyBase = qtyPerSinglePieceBase * pieces

      // Calculate display quantity (in user's preferred inputUnit)
      let displayQty = totalQtyBase
      if (inputUnit === 'g' && baseUnit === 'kg') {
        displayQty = totalQtyBase * 1000
      } else if (inputUnit === 'kg' && baseUnit === 'g') {
        displayQty = totalQtyBase / 1000
      }

      return {
        inventory_item_id: r.inventory_item_id,
        name: r.inventory_item_name || invItem?.name || `Item #${r.inventory_item_id}`,
        unit: inputUnit,
        base_unit: baseUnit,
        quantity_per_piece: qtyPerSinglePieceBase,
        total_quantity: totalQtyBase, // stored in base unit (kg) for cost & validation
        display_quantity: displayQty, // what is shown to user in the selected unit
        available: invItem?.current_quantity ?? null,
        unit_cost: invItem?.unit_cost ?? 0
      }
    })
  }

  const addIngredient = () => setForm(p => ({ ...p, ingredients: [...p.ingredients, { inventory_item_id: '', quantity_used: '' }] }))
  const removeIngredient = i => setForm(p => ({ ...p, ingredients: p.ingredients.filter((_, idx) => idx !== i) }))
  const setIngField = (i, k, v) => setForm(p => { const ings = [...p.ingredients]; ings[i] = { ...ings[i], [k]: v }; return { ...p, ingredients: ings } })

  // Cost calculation
  const calcRawCost = () => {
    // If using recipe mode, calculate from recipe preview
    const preview = recipePreview()
    if (preview.length > 0) {
      return preview.reduce((sum, r) => sum + r.total_quantity * r.unit_cost, 0)
    }
    // Otherwise calculate from manual ingredients
    return form.ingredients.reduce((sum, ing) => {
      const item = inventory.find(i => i.id === +ing.inventory_item_id)
      return sum + (+ing.quantity_used || 0) * (item?.unit_cost || 0)
    }, 0)
  }

  const totalCost = calcRawCost() + (+form.packaging_cost || 0) + (+form.labor_cost || 0)
  const costPerPiece = form.total_pieces > 0 ? totalCost / +form.total_pieces : 0

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      let payload
      if (selectedProduct && selectedProduct.recipe?.length > 0 && useRecipe) {
        // Let backend auto-expand recipe — send product_id, no manual ingredients
        payload = {
          ...form,
          total_pieces: +form.total_pieces,
          packaging_cost: +form.packaging_cost,
          labor_cost: +form.labor_cost,
          product_id: +form.product_id,
          ingredients: []  // backend will auto-expand from recipe
        }
      } else {
        // Manual ingredients (no recipe or recipe not used)
        payload = {
          ...form,
          total_pieces: +form.total_pieces,
          packaging_cost: +form.packaging_cost,
          labor_cost: +form.labor_cost,
          product_id: form.product_id ? +form.product_id : null,
          ingredients: form.ingredients.map(i => ({
            inventory_item_id: +i.inventory_item_id,
            quantity_used: +i.quantity_used
          }))
        }
      }
      await api.post('/production-batches', payload)
      toast.success('Production batch created! Inventory updated.')
      setModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error creating batch')
    } finally { setSaving(false) }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this batch? Note: inventory deductions will NOT be reversed.')) return
    try { await api.delete(`/production-batches/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const hasRecipe = selectedProduct && selectedProduct.recipe && selectedProduct.recipe.length > 0
  const preview = recipePreview()
  const hasStockIssue = preview.some(r => r.available !== null && r.total_quantity > r.available)

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Production</h1>
          <p className="page-subtitle">{batches.length} batches recorded</p>
        </div>
        <button id="add-batch-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> New Batch
        </button>
      </div>

      {/* Production Totals Summary */}
      {batches.length > 0 && (() => {
        const totalPieces = batches.reduce((s, b) => s + (+b.total_pieces || 0), 0)
        const totalBoxes  = batches.reduce((s, b) => {
          const prod = products.find(p => p.id === b.product_id)
          const pcs  = prod?.pieces_count || 1
          return s + Math.floor((+b.total_pieces || 0) / pcs)
        }, 0)
        const totalCost = batches.reduce((s, b) => s + (+b.total_cost || 0), 0)
        const totalRemaining = batches.reduce((s, b) => s + (b.remaining_pieces ?? +b.total_pieces ?? 0), 0)
        const totalRemainingBoxes = batches.reduce((s, b) => {
          const prod = products.find(p => p.id === b.product_id)
          const pcs  = prod?.pieces_count || 1
          return s + Math.floor((b.remaining_pieces ?? 0) / pcs)
        }, 0)
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(201,168,76,0.12) 100%)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C9A84C', marginBottom: 4 }}>Total Produced (pcs)</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text)' }}>{totalPieces.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{totalBoxes.toLocaleString()} boxes</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(92,158,80,0.12) 100%)', border: '1px solid rgba(92,158,80,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4CAF6E', marginBottom: 4 }}>Remaining Stock</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text)' }}>{totalRemaining.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{totalRemainingBoxes.toLocaleString()} boxes left</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, var(--c-surface-1) 0%, rgba(91,155,213,0.12) 100%)', border: '1px solid rgba(91,155,213,0.25)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5B9BD5', marginBottom: 4 }}>Total Production Cost</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text)' }}>{fmtJD(totalCost)}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{batches.length} batches</div>
            </div>
          </div>
        )
      })()}

      {loading ? (
        <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
      ) : batches.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🏭</div><div className="empty-state-title">No production batches yet</div><div className="empty-state-text">Record your first chocolate production run</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {batches.map(b => (
            <div key={b.id} className="card">
              <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                <div className="flex gap-3" style={{ alignItems: 'center' }}>
                  <Factory size={18} color="var(--c-accent)" />
                  <div>
                    <div className="font-bold" style={{ color: 'var(--c-text)' }}>
                      {b.batch_name}
                      {b.product_name && (
                        <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(201,168,76,0.12)', color: 'var(--c-accent)', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                          <Package size={10} style={{ display: 'inline', marginRight: 3 }} />{b.product_name}
                        </span>
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {b.production_date} · {b.flavor || 'Mixed'} · {b.total_pieces} pieces
                    </div>
                    {/* Progress Bar showing remaining pieces */}
                    {b.product_id && b.remaining_pieces !== undefined && (
                      <div style={{ marginTop: 8, width: 220 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text-3)', marginBottom: 3 }}>
                          <span>Remaining: {b.remaining_pieces} / {b.total_pieces} pcs</span>
                          <span>{Math.round((b.remaining_pieces / b.total_pieces) * 100)}%</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${(b.remaining_pieces / b.total_pieces) * 100}%`,
                            background: b.remaining_pieces === 0 ? '#E05252' : b.remaining_pieces < b.total_pieces * 0.3 ? '#F0A500' : 'var(--c-accent)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3" style={{ alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-gold font-bold">{fmtJD(b.total_cost)}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Cost/piece: {fmtJD(b.cost_per_piece)}</div>
                  </div>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={e => { e.stopPropagation(); handleDelete(b.id) }}><Trash2 size={14} /></button>
                  {expanded === b.id ? <ChevronUp size={16} color="var(--c-text-3)" /> : <ChevronDown size={16} color="var(--c-text-3)" />}
                </div>
              </div>
              {expanded === b.id && (
                <div className="card-body">
                  <div className="form-grid">
                    <div><div className="form-label">Raw Material Cost</div><div className="text-gold font-bold">{fmtJD(b.raw_material_cost)}</div></div>
                    <div><div className="form-label">Packaging Cost</div><div>{fmtJD(b.packaging_cost)}</div></div>
                    <div><div className="form-label">Labor Cost</div><div>{fmtJD(b.labor_cost)}</div></div>
                    <div><div className="form-label">Total Cost</div><div className="font-bold text-gold">{fmtJD(b.total_cost)}</div></div>
                    <div><div className="form-label">Cost Per Piece</div><div className="font-bold">{fmtJD(b.cost_per_piece)}</div></div>
                  </div>
                  {b.ingredients?.length > 0 && (
                    <>
                      <div className="divider" />
                      <div className="form-label" style={{ marginBottom: 8 }}>Ingredients Used</div>
                      <table>
                        <thead><tr><th>Material</th><th>Quantity Used</th><th>Unit Cost</th><th>Total</th></tr></thead>
                        <tbody>
                          {b.ingredients.map(ing => (
                            <tr key={ing.id}>
                              <td>{ing.inventory_item_name}</td>
                              <td>{ing.quantity_used}</td>
                              <td>{fmtJD(ing.unit_cost)}</td>
                              <td className="text-gold font-bold">{fmtJD(ing.total_cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  {b.notes && <p className="text-muted" style={{ marginTop: 12, fontSize: 13 }}>📝 {b.notes}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title="New Production Batch" size="modal-lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button id="save-batch-btn" className="btn btn-primary" form="batch-form" type="submit" disabled={saving || hasStockIssue}>
              {saving ? <span className="spinner" /> : 'Create Batch'}
            </button>
          </>
        }
      >
        <form id="batch-form" onSubmit={handleSave}>

          {/* ── Basic Info ────────────────────────────────────────── */}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Batch Name *</label>
              <input id="batch-name" className="form-input" value={form.batch_name} onChange={e => setField('batch_name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input id="batch-date" className="form-input" type="date" value={form.production_date} onChange={e => setField('production_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Flavor</label>
              <input id="batch-flavor" className="form-input" placeholder="e.g. Dark, Milk, Mixed" value={form.flavor} onChange={e => setField('flavor', e.target.value)} />
            </div>
            <div className="form-group">
              {selectedProduct ? (
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Batch Quantity *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 2 }}>Boxes</div>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        placeholder="Boxes"
                        value={form.total_pieces ? Math.round(form.total_pieces / selectedProduct.pieces_count) : ''}
                        onChange={e => {
                          const boxes = +e.target.value || 0
                          setField('total_pieces', boxes * selectedProduct.pieces_count)
                        }}
                        style={{ margin: 0 }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 2 }}>Individual Pieces</div>
                      <input
                        id="batch-pieces"
                        className="form-input"
                        type="number"
                        min="1"
                        placeholder="Pieces"
                        value={form.total_pieces || ''}
                        onChange={e => {
                          setField('total_pieces', +e.target.value || 0)
                        }}
                        style={{ margin: 0 }}
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <label className="form-label">Total Pieces *</label>
                  <input
                    id="batch-pieces"
                    className="form-input"
                    type="number"
                    min="1"
                    value={form.total_pieces}
                    onChange={e => setField('total_pieces', e.target.value)}
                    required
                  />
                </>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Packaging Cost (JD)</label>
              <input id="batch-pkg" className="form-input" type="number" step="0.01" min="0" value={form.packaging_cost} onChange={e => setField('packaging_cost', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Labor Cost (JD)</label>
              <input id="batch-labor" className="form-input" type="number" step="0.01" min="0" value={form.labor_cost} onChange={e => setField('labor_cost', e.target.value)} />
            </div>
          </div>

          {/* ── Product + Recipe Section ──────────────────────────── */}
          <div className="divider" style={{ margin: '20px 0' }} />
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={14} /> Product (optional — auto-fills recipe)
            </label>
            <select
              id="batch-product"
              className="form-select"
              value={form.product_id}
              onChange={e => handleProductChange(e.target.value)}
            >
              <option value="">No product selected (manual ingredients)</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.recipe && p.recipe.length > 0 ? ` 🧪 ${p.recipe.length} ingredient recipe` : ' (no recipe)'}
                </option>
              ))}
            </select>
          </div>

          {/* Recipe preview — shown when product with recipe is selected */}
          {hasRecipe && useRecipe && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                padding: '14px 16px',
                background: hasStockIssue ? 'rgba(220,38,38,0.06)' : 'rgba(201,168,76,0.07)',
                border: `1px solid ${hasStockIssue ? 'rgba(220,38,38,0.2)' : 'rgba(201,168,76,0.2)'}`,
                borderRadius: 'var(--r-md)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--c-accent)' }}>
                    <FlaskConical size={14} />
                    Recipe auto-fill — {selectedProduct.name}
                    {form.total_pieces && <span style={{ fontWeight: 400, color: 'var(--c-text-3)', fontSize: 12 }}>· {form.total_pieces} pieces</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseRecipe(false)}
                    style={{ fontSize: 11, color: 'var(--c-text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Switch to manual
                  </button>
                </div>
                {!form.total_pieces ? (
                  <div style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Enter the total pieces above to see ingredient amounts.</div>
                ) : (
                  <div>
                     {preview.map((r, i) => {
                       const insufficient = r.available !== null && r.total_quantity > r.available
                       return (
                         <div key={i} style={{
                           display: 'grid',
                           gridTemplateColumns: '1fr auto auto',
                           gap: 12,
                           alignItems: 'center',
                           padding: '6px 0',
                           borderBottom: i < preview.length - 1 ? '1px solid var(--c-border)' : 'none'
                         }}>
                           <div style={{ fontSize: 13 }}>{r.name}</div>
                           <div style={{ fontSize: 13, fontWeight: 600, color: insufficient ? 'var(--c-danger)' : 'var(--c-text)' }}>
                             {r.display_quantity.toFixed(2)} {r.unit}
                           </div>
                           <div style={{ fontSize: 11, color: insufficient ? 'var(--c-danger)' : 'var(--c-text-3)', textAlign: 'right' }}>
                             {insufficient
                               ? `⚠ Only ${r.available.toFixed(2)} ${r.base_unit} available`
                               : `Available: ${r.available.toFixed(2)} ${r.base_unit}`}
                           </div>
                         </div>
                       )
                     })}
                    {hasStockIssue && (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--c-danger)', fontWeight: 600 }}>
                        ⚠ Insufficient stock for one or more ingredients. Restock inventory before creating this batch.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* If product selected but no recipe */}
          {selectedProduct && !hasRecipe && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--c-text-3)', border: '1px solid var(--c-border)' }}>
              <FlaskConical size={12} style={{ display: 'inline', marginRight: 5 }} />
              "{selectedProduct.name}" has no recipe defined. You can add a recipe in the Products page, or add ingredients manually below.
            </div>
          )}

          {/* Manual ingredients — shown when no recipe auto-fill is active */}
          {(!hasRecipe || !useRecipe) && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="form-label">Ingredients (from Inventory)</div>
                  {!useRecipe && hasRecipe && (
                    <button
                      type="button"
                      onClick={() => setUseRecipe(true)}
                      style={{ fontSize: 11, color: 'var(--c-accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      ← Use recipe
                    </button>
                  )}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredient} id="add-ingredient-btn"><Plus size={14} /> Add</button>
              </div>
              {form.ingredients.map((ing, i) => (
                <div key={i} className="form-grid" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
                  <div className="form-group">
                    <label className="form-label">Material</label>
                    <select className="form-select" value={ing.inventory_item_id} onChange={e => setIngField(i, 'inventory_item_id', e.target.value)} required>
                      <option value="">Select item...</option>
                      {inventory.map(inv => <option key={inv.id} value={inv.id}>{inv.name} ({inv.current_quantity} {inv.unit})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qty Used</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={ing.quantity_used} onChange={e => setIngField(i, 'quantity_used', e.target.value)} required />
                  </div>
                  <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeIngredient(i)} style={{ marginBottom: 0 }}><Trash2 size={14} /></button>
                </div>
              ))}
            </>
          )}

          {/* ── Cost Summary ──────────────────────────────────────── */}
          <div className="divider" style={{ margin: '20px 0' }} />
          <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div><div className="form-label">Raw Materials</div><div className="text-gold font-bold">{fmtJD(calcRawCost())}</div></div>
            <div><div className="form-label">Total Cost</div><div className="text-gold font-bold">{fmtJD(totalCost)}</div></div>
            <div><div className="form-label">Cost Per Piece</div><div className="font-bold" style={{ color: 'var(--c-success)' }}>{fmtJD(costPerPiece)}</div></div>
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Notes</label>
            <textarea id="batch-notes" className="form-textarea" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
