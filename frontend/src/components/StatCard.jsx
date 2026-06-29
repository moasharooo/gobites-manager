export default function StatCard({ label, value, sub, accent = '', icon: Icon }) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {Icon && (
        <div className="stat-icon">
          <Icon size={48} />
        </div>
      )}
    </div>
  )
}
