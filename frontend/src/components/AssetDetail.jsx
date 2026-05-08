import DegradationChart from './DegradationChart'

export default function AssetDetail({ asset, onClose }) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  return (
    <div className="panel-section">
      <div className="panel-title">
        <span className="icon">📊</span> Asset Detail
      </div>
      <div className="asset-detail">
        <div className="detail-header">
          <div>
            <div className="detail-name">{asset.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {asset.type} — {asset.id}
            </div>
          </div>
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>

        <div className="detail-grid">
          <div className="detail-metric">
            <div className="detail-metric-label">Age</div>
            <div className="detail-metric-value">{asset.age}<span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}> / {asset.maxAge} yr</span></div>
          </div>
          <div className="detail-metric">
            <div className="detail-metric-label">Load</div>
            <div className={`detail-metric-value ${asset.load > 75 ? 'critical' : asset.load > 50 ? 'watch' : 'stable'}`}>{asset.load}%</div>
          </div>
          <div className="detail-metric">
            <div className="detail-metric-label">Inspection</div>
            <div className={`detail-metric-value ${asset.inspectionScore < 40 ? 'critical' : asset.inspectionScore < 60 ? 'watch' : 'stable'}`}>{asset.inspectionScore}/100</div>
          </div>
          <div className="detail-metric">
            <div className="detail-metric-label">Last Maintenance</div>
            <div className={`detail-metric-value ${asset.lastMaintenance > 4 ? 'critical' : asset.lastMaintenance > 2 ? 'watch' : 'stable'}`}>{asset.lastMaintenance} yr</div>
          </div>
          <div className="detail-metric">
            <div className="detail-metric-label">Risk Score</div>
            <div className={`detail-metric-value ${asset.status}`}>{Math.round(asset.riskScore * 100)}%</div>
          </div>
          <div className="detail-metric">
            <div className="detail-metric-label">Est. RUL</div>
            <div className={`detail-metric-value ${asset.status}`}>{asset.rulMonths} mo</div>
          </div>
        </div>

        <div className={`anomaly-flag ${asset.anomaly ? 'active' : 'inactive'}`}>
          {asset.anomaly ? '⚡ Anomaly Detected' : '✓ No Anomaly'}
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.7 }}>
            {asset.anomaly ? 'Immediate attention required' : 'Within normal parameters'}
          </span>
        </div>

        <div className="detail-chart">
          <div className="detail-chart-title">Inspection Score — 12 Month Trend</div>
          <DegradationChart history={asset.history} status={asset.status} labels={months} />
        </div>
      </div>
    </div>
  )
}
