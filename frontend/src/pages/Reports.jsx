import { useEffect, useState } from 'react'
import api from '../api/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { TrendingUp, ShoppingBag, Users, DollarSign } from 'lucide-react'

const fmtJD = v => `${(+v || 0).toFixed(2)} JD`
const PIE_COLORS = ['#C9A84C','#8B5E3C','#5B9BD5','#4CAF6E','#E05252','#F0A500','#7B68EE','#20B2AA']

export default function Reports() {
  const [monthly, setMonthly] = useState(null)
  const [products, setProducts] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const load = async () => {
    setLoading(true)
    try {
      const [m, p, c] = await Promise.all([
        api.get(`/reports/monthly?month=${month}&year=${year}`),
        api.get('/reports/products'),
        api.get('/reports/customers')
      ])
      setMonthly(m.data)
      setProducts(p.data)
      setTopCustomers(c.data.slice(0, 10))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [month, year])

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ]

  const years = [2024, 2025, 2026, 2027]

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Business intelligence & analytics</p>
        </div>
        <div className="flex gap-2">
          <select id="report-month" className="form-select" value={month} onChange={e => setMonth(+e.target.value)} style={{ width: 'auto' }}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select id="report-year" className="form-select" value={year} onChange={e => setYear(+e.target.value)} style={{ width: 'auto' }}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-page" style={{ height: 200 }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Monthly KPIs */}
          {monthly && (
            <>
              <div className="stats-grid">
                <div className="stat-card gold">
                  <div className="stat-label">Total Sales</div>
                  <div className="stat-value">{fmtJD(monthly.total_sales)}</div>
                  <div className="stat-sub">{monthly.total_orders} delivered orders</div>
                  <div className="stat-icon"><TrendingUp size={48} /></div>
                </div>
                <div className="stat-card red">
                  <div className="stat-label">Total Expenses</div>
                  <div className="stat-value">{fmtJD(monthly.total_expenses)}</div>
                  <div className="stat-sub">This month</div>
                  <div className="stat-icon"><DollarSign size={48} /></div>
                </div>
                <div className={`stat-card ${monthly.net_profit >= 0 ? 'green' : 'red'}`}>
                  <div className="stat-label">Net Profit</div>
                  <div className="stat-value">{fmtJD(monthly.net_profit)}</div>
                  <div className="stat-sub">Sales − Expenses</div>
                  <div className="stat-icon"><ShoppingBag size={48} /></div>
                </div>
                <div className="stat-card blue">
                  <div className="stat-label">Margin</div>
                  <div className="stat-value">{monthly.total_sales > 0 ? ((monthly.net_profit / monthly.total_sales) * 100).toFixed(1) + '%' : '0%'}</div>
                  <div className="stat-sub">Net profit margin</div>
                  <div className="stat-icon"><Users size={48} /></div>
                </div>
              </div>

              {/* Product Breakdown & Expense Breakdown */}
              <div className="chart-grid mb-6">
                <div className="card">
                  <div className="card-header"><span className="card-title"><ShoppingBag size={16} /> Product Revenue</span></div>
                  <div className="card-body" style={{ padding: '16px 8px' }}>
                    {monthly.product_breakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={monthly.product_breakdown.slice(0, 8)} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" stroke="#7A6858" tick={{ fontSize: 10 }} />
                          <YAxis stroke="#7A6858" tick={{ fontSize: 10 }} tickFormatter={v => `${v}JD`} />
                          <Tooltip contentStyle={{ background: '#1E1510', border: '1px solid #2E1E14', borderRadius: '10px', color: '#F0E8DC' }} formatter={v => [`${(+v).toFixed(2)} JD`]} />
                          <Bar dataKey="revenue" fill="#C9A84C" radius={[4, 4, 0, 0]} name="Revenue" />
                          <Bar dataKey="profit"  fill="#4CAF6E" radius={[4, 4, 0, 0]} name="Profit" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-state-text">No sales data</div></div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><span className="card-title"><DollarSign size={16} /> Expenses Breakdown</span></div>
                  <div className="card-body" style={{ padding: '16px 8px' }}>
                    {monthly.expense_breakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={monthly.expense_breakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                            {monthly.expense_breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1E1510', border: '1px solid #2E1E14', borderRadius: '10px', color: '#F0E8DC' }} formatter={v => [`${(+v).toFixed(2)} JD`]} />
                          <Legend formatter={v => <span style={{ color: '#B8A898', fontSize: 11 }}>{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-state-text">No expense data</div></div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Products Profitability Table */}
          <div className="card mb-6" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title"><TrendingUp size={16} /> Product Profitability Ranking</span>
            </div>
            <div className="table-wrapper">
              {products.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px' }}><div className="empty-state-text">No products</div></div>
              ) : (
                <table>
                  <thead><tr><th>#</th><th>Product</th><th>Price</th><th>Cost</th><th>Profit</th><th>Margin</th><th>Units Sold</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.id}>
                        <td className="text-muted">{i + 1}</td>
                        <td className="font-bold" style={{ color: 'var(--c-text)' }}>{p.name}</td>
                        <td>{fmtJD(p.selling_price)}</td>
                        <td>{fmtJD(p.total_cost)}</td>
                        <td className="text-success font-bold">{fmtJD(p.profit)}</td>
                        <td>
                          <span className={`badge ${p.profit_margin >= 30 ? 'badge-success' : p.profit_margin >= 15 ? 'badge-warning' : 'badge-danger'}`}>
                            {(+p.profit_margin || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td>{p.total_sold}</td>
                        <td className="text-gold font-bold">{fmtJD(p.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top Customers */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Users size={16} /> Top Customers</span>
            </div>
            <div className="table-wrapper">
              {topCustomers.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px' }}><div className="empty-state-text">No customers yet</div></div>
              ) : (
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Area</th><th>Type</th><th>Source</th><th>Orders</th><th>Total Spent</th><th>Last Order</th></tr></thead>
                  <tbody>
                    {topCustomers.map((c, i) => (
                      <tr key={c.id}>
                        <td className="text-muted">{i + 1}</td>
                        <td className="font-bold" style={{ color: 'var(--c-text)' }}>{c.name}</td>
                        <td className="text-muted">{c.phone || '—'}</td>
                        <td>{c.area || '—'}</td>
                        <td><span className="badge badge-neutral">{c.customer_type || '—'}</span></td>
                        <td><span className="badge badge-info">{c.source || '—'}</span></td>
                        <td className="font-bold">{c.total_orders}</td>
                        <td className="text-gold font-bold">{fmtJD(c.total_purchases)}</td>
                        <td className="text-muted">{c.last_order_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
