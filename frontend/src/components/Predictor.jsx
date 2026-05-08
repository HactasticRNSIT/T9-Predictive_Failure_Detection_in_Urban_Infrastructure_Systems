import { useState } from 'react'

const API = 'http://localhost:5000/api'

export default function Predictor() {
  const [form, setForm] = useState({ age: '', maxAge: '', load: '', inspectionScore: '', lastMaintenance: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handlePredict = async () => {
    const body = {}
    for (const [k, v] of Object.entries(form)) {
      const n = parseFloat(v)
      if (isNaN(n) || n < 0) return
      body[k] = n
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  return (
    <div className="panel-section">
      <div className="panel-title">
        <span className="icon">🧮</span> RUL Predictor
      </div>
      <div className="predictor-section">
        <div className="predictor-title">⚙️ Custom Asset Analysis</div>
        <div className="predictor-grid">
          <div className="predictor-field">
            <label>Age (years)</label>
            <input type="number" value={form.age} onChange={e => update('age', e.target.value)} placeholder="e.g. 45" />
          </div>
          <div className="predictor-field">
            <label>Max Age (years)</label>
            <input type="number" value={form.maxAge} onChange={e => update('maxAge', e.target.value)} placeholder="e.g. 100" />
          </div>
          <div className="predictor-field">
            <label>Load (%)</label>
            <input type="number" value={form.load} onChange={e => update('load', e.target.value)} placeholder="e.g. 75" />
          </div>
          <div className="predictor-field">
            <label>Inspection Score</label>
            <input type="number" value={form.inspectionScore} onChange={e => update('inspectionScore', e.target.value)} placeholder="0–100" />
          </div>
          <div className="predictor-field">
            <label>Last Maint (yrs)</label>
            <input type="number" value={form.lastMaintenance} onChange={e => update('lastMaintenance', e.target.value)} placeholder="e.g. 3" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="predictor-btn" onClick={handlePredict} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Analyzing…' : 'Predict RUL'}
            </button>
          </div>
          {result && (
            <div className="predictor-result">
              <div className="predictor-result-item">
                <div className="val" style={{ color: result.status === 'critical' ? 'var(--red)' : result.status === 'watch' ? 'var(--amber)' : 'var(--green)' }}>
                  {result.rulMonths} mo
                </div>
                <div className="lbl">Est. RUL</div>
              </div>
              <div className="predictor-result-item">
                <div className="val" style={{ color: result.status === 'critical' ? 'var(--red)' : result.status === 'watch' ? 'var(--amber)' : 'var(--green)' }}>
                  {Math.round(result.riskScore * 100)}%
                </div>
                <div className="lbl">Risk</div>
              </div>
              <div className="predictor-result-item">
                <div className="val" style={{ color: result.anomaly ? 'var(--red)' : 'var(--green)' }}>
                  {result.anomaly ? '⚡ YES' : '✓ NO'}
                </div>
                <div className="lbl">Anomaly</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
