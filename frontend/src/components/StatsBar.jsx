export default function StatsBar({ counts }) {
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-icon total">🏗️</div>
        <div>
          <div className="stat-value">{counts.total}</div>
          <div className="stat-label">Total Assets</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon critical">⚠️</div>
        <div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{counts.critical}</div>
          <div className="stat-label">Critical</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon watch">👁️</div>
        <div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{counts.watch}</div>
          <div className="stat-label">Watch</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon stable">✅</div>
        <div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{counts.stable}</div>
          <div className="stat-label">Stable</div>
        </div>
      </div>
    </div>
  )
}
