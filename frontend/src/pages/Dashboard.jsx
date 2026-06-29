import { useEffect, useState } from 'react'
import api from '../api/client'
import StatCard from '../components/StatCard'
import { TrendingUp, ShoppingCart, Users, DollarSign, Package, Star, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const STATUS_COLORS = {
  New: 'badge-info',
  Preparing: 'badge-warning',
  Ready: 'badge-gold',
  'With Delivery': 'badge-info',
  Delivered: 'badge-success',
  Cancelled: 'badge-danger'
}

const PIE_COLORS = ['#C9A84C', '#8B5E3C', '#5B9BD5', '#4CAF6E', '#E05252', '#F0A500', '#7B68EE', '#20B2AA']

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="loading-page">
      <div className="spinner" />
      Loading dashboard...
    </div>
  )

  if (!data) return <div className="page-container"><p>Failed to load dashboard.</p></div>

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back — here's your business overview</p>
        </div>
        <div className="navbar-date">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid">
        <StatCard label="Today's Sales"    value={fmtJD(data.today_sales)}    sub={`${data.today_orders} orders`}     accent="gold"  icon={DollarSign} />
        <StatCard label="Month Sales"      value={fmtJD(data.month_sales)}    sub={`${data.month_orders} orders`}     accent="green" icon={TrendingUp} />
        <StatCard label="Net Profit"       value={fmtJD(data.net_profit)}     sub="Sales − Expenses"                  accent={data.net_profit >= 0 ? 'green' : 'red'} icon={Star} />
        <StatCard label="Month Expenses"   value={fmtJD(data.month_expenses)} sub="This month"                        accent="red"   icon={ShoppingCart} />
        <StatCard label="Total Customers"  value={data.total_customers}       sub="Registered"                        accent="blue"  icon={Users} />
        <StatCard label="Chocolates Stock"  value={`${data.total_pieces_in_stock || 0} pcs`} sub="Across active products"          accent="gold"  icon={Package} />
        <StatCard label="Best Product"     value={data.best_product || '—'}   sub="Most sold this month"              accent="" />
        <StatCard label="Top Customer"     value={data.top_customer || '—'}   sub="Highest purchases"                 accent="" />
        <StatCard label="Low Stock Items"  value={data.low_stock_alerts.length} sub="Need restock"                    accent={data.low_stock_alerts.length > 0 ? 'red' : 'green'} icon={Package} />
        <StatCard label="Total Boxes Sold"  value={(data.total_boxes_sold || 0).toLocaleString()} sub={`${(data.total_pieces_sold || 0).toLocaleString()} pieces`} accent="gold" icon={Package} />
      </div>

      {/* ── Critical Stock Warning ─────────────────────────────────────── */}
      {data.total_pieces_in_stock < 48 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(224,82,82,0.15) 0%, rgba(224,82,82,0.05) 100%)',
          border: '1.5px solid rgba(224,82,82,0.5)',
          borderRadius: 'var(--r-lg)',
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <AlertTriangle size={22} color="#E05252" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: '#E05252', fontSize: 14, marginBottom: 3 }}>
              ⚠️ Low Product Stock — Only {data.total_pieces_in_stock} pieces left!
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-3)' }}>
              Stock is below the minimum threshold of 48 pieces. Consider starting a new production batch.
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#E05252' }}>{data.total_pieces_in_stock}</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-3)' }}>of 48 min</div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="chart-grid">
        {/* Area Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp size={16} /> Monthly Sales & Profit</span>
          </div>
          <div className="card-body" style={{ padding: '16px 8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.monthly_sales_chart} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4CAF6E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4CAF6E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#7A6858" tick={{ fontSize: 11 }} />
                <YAxis stroke="#7A6858" tick={{ fontSize: 11 }} tickFormatter={v => `${v}JD`} />
                <Tooltip
                  contentStyle={{ background: '#1E1510', border: '1px solid #2E1E14', borderRadius: '10px', color: '#F0E8DC' }}
                  formatter={v => [`${(+v).toFixed(2)} JD`]}
                />
                <Area type="monotone" dataKey="sales"  stroke="#C9A84C" fill="url(#gradSales)"  strokeWidth={2} name="Sales" />
                <Area type="monotone" dataKey="profit" stroke="#4CAF6E" fill="url(#gradProfit)" strokeWidth={2} name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><DollarSign size={16} /> Expenses by Category</span>
          </div>
          <div className="card-body" style={{ padding: '16px 8px' }}>
            {data.category_expenses_chart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.category_expenses_chart}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {data.category_expenses_chart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1E1510', border: '1px solid #2E1E14', borderRadius: '10px', color: '#F0E8DC' }}
                    formatter={v => [`${(+v).toFixed(2)} JD`]}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: '#B8A898', fontSize: 11 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">No expense data this month</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><AlertTriangle size={16} /> Stock Alerts</span>
            {data.low_stock_alerts.length > 0 && (
              <span className="badge badge-danger">{data.low_stock_alerts.length}</span>
            )}
          </div>
          <div className="card-body">
            {data.low_stock_alerts.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div>✅</div>
                <div className="empty-state-text">All stock levels are OK</div>
              </div>
            ) : (
              <div className="alerts-list">
                {data.low_stock_alerts.map(alert => (
                  <div key={alert.id} className={`alert-item ${alert.status === 'Critical' ? 'critical' : ''}`}>
                    <AlertTriangle size={14} />
                    <div>
                      <strong>{alert.name}</strong>
                      <span style={{ marginLeft: '8px', opacity: 0.8 }}>
                        {alert.current_quantity} / {alert.minimum_quantity} {alert.unit}
                      </span>
                    </div>
                    <span className={`badge ${alert.status === 'Critical' ? 'badge-danger' : 'badge-warning'}`} style={{ marginLeft: 'auto' }}>
                      {alert.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chocolate Stock Breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Package size={16} /> Chocolates Stock</span>
            <span className="badge badge-gold">{data.total_pieces_in_stock} pcs</span>
          </div>
          <div className="card-body">
            {data.product_stock_breakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-state-text">No active products found</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.product_stock_breakdown.map(prod => (
                  <div key={prod.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--c-border)', paddingBottom: 6 }}>
                    <span style={{ fontWeight: 500, color: 'var(--c-text)' }}>{prod.product_name}</span>
                    <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
                      {prod.pieces_in_stock} pcs <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 400 }}>({prod.boxes_in_stock.toFixed(1)} boxes)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><ShoppingCart size={16} /> Recent Orders</span>
          </div>
          <div>
            {data.recent_orders.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-state-text">No orders yet</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map(o => (
                    <tr key={o.id}>
                      <td className="text-gold font-bold">{o.order_number}</td>
                      <td>{o.customer_name}</td>
                      <td className="font-bold">{fmtJD(o.total_amount)}</td>
                      <td><span className={`badge ${STATUS_COLORS[o.status] || 'badge-neutral'}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
