export default function WarningFeed({ warnings, onSelect }) {
  return (
    <div className="warning-list">
      {warnings.map((w, i) => {
        const pct = Math.max(5, Math.min(100, w.riskScore * 100))
        return (
          <div key={w.id} className="warning-item" onClick={() => onSelect(w)}>
            <div className="warning-item-header">
              <span className="warning-asset-name">{w.name}</span>
              <span className={`warning-badge ${w.status}`}>{w.status}</span>
            </div>
            <div className="warning-explanation">{w.explanation}</div>
            <div className="warning-rul">
              <span style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                RUL {w.rulMonths}mo
              </span>
              <div className="rul-bar-track">
                <div
                  className={`rul-bar-fill ${w.status}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                Risk {Math.round(w.riskScore * 100)}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
