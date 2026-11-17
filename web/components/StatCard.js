export default function StatCard({ value, label, tone = 'plum', icon: Icon, delay = 0 }) {
  return (
    <div className={`stat stat-${tone}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-value">{value === null || value === undefined ? '—' : Number(value).toLocaleString()}</div>
      <div className="stat-label">{label}</div>
      {Icon && <Icon className="stat-icon" size={40} strokeWidth={1.4} />}
    </div>
  );
}
