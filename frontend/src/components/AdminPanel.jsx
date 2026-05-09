import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../admin.css'

const API = '/api'

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: '🔴', color: 'var(--red)', bg: 'var(--red-dim)' },
  in_progress: { label: 'In Progress', icon: '🟡', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  resolved: { label: 'Resolved', icon: '🟢', color: 'var(--green)', bg: 'var(--green-dim)' },
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState(null)

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/reports`)
      if (res.ok) {
        const data = await res.json()
        setReports(data)
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleDelete = async (reportId) => {
    try {
      const res = await fetch(`${API}/admin/reports/${reportId}`, { method: 'DELETE' })
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== reportId))
        showToast('Report deleted successfully')
        setShowDeleteConfirm(null)
      } else {
        showToast('Failed to delete report', 'error')
      }
    } catch (err) {
      showToast('Error deleting report', 'error')
    }
  }

  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      const res = await fetch(`${API}/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        const updated = await res.json()
        setReports(prev => prev.map(r => r.id === reportId ? updated : r))
        showToast(`Report marked as "${newStatus.replace('_', ' ')}"`)
      }
    } catch (err) {
      showToast('Error updating status', 'error')
    }
  }

  const handleEditSave = async (reportId, updates) => {
    try {
      const res = await fetch(`${API}/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (res.ok) {
        const updated = await res.json()
        setReports(prev => prev.map(r => r.id === reportId ? updated : r))
        setShowEditModal(false)
        showToast('Report updated successfully')
      }
    } catch (err) {
      showToast('Error updating report', 'error')
    }
  }

  const handleResolutionSubmit = async (reportId, formData) => {
    try {
      const res = await fetch(`${API}/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        const updated = await res.json()
        setReports(prev => prev.map(r => r.id === reportId ? updated : r))
        setShowConfirmModal(false)
        setSelectedReport(null)
        showToast('Report marked as resolved with verification! ✅')
      }
    } catch (err) {
      showToast('Error submitting resolution', 'error')
    }
  }

  const filteredReports = reports.filter(r => {
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus
    const matchesSearch = !searchQuery ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const counts = {
    all: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <span>Loading reports…</span>
      </div>
    )
  }

  return (
    <div className="admin-wrapper">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="admin-back-btn" onClick={() => navigate('/')}>
            ← Dashboard
          </button>
          <div className="admin-logo">
            <div className="admin-logo-icon">🛡️</div>
            <div>
              <div className="admin-logo-text">Admin Panel</div>
              <div className="admin-logo-sub">InfraWatch Report Management</div>
            </div>
          </div>
        </div>
        <div className="admin-header-right">
          <div className="admin-time">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="admin-stats">
        {[
          { key: 'all', label: 'Total Reports', icon: '📋', color: 'var(--cyan)', bg: 'var(--cyan-dim)' },
          { key: 'pending', label: 'Pending', icon: '🔴', color: 'var(--red)', bg: 'var(--red-dim)' },
          { key: 'in_progress', label: 'In Progress', icon: '🟡', color: 'var(--amber)', bg: 'var(--amber-dim)' },
          { key: 'resolved', label: 'Resolved', icon: '🟢', color: 'var(--green)', bg: 'var(--green-dim)' },
        ].map(s => (
          <button
            key={s.key}
            className={`admin-stat-card ${filterStatus === s.key ? 'active' : ''}`}
            onClick={() => setFilterStatus(s.key)}
            style={{ '--card-color': s.color, '--card-bg': s.bg }}
          >
            <div className="admin-stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div>
              <div className="admin-stat-value">{counts[s.key]}</div>
              <div className="admin-stat-label">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="admin-toolbar">
        <div className="admin-search">
          <span className="admin-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search reports by ID or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="admin-report-count">
          Showing {filteredReports.length} of {reports.length} reports
        </div>
      </div>

      {/* Reports Table */}
      <div className="admin-table-container">
        {filteredReports.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">📭</div>
            <h3>No reports found</h3>
            <p>
              {filterStatus !== 'all'
                ? `No ${filterStatus.replace('_', ' ')} reports available.`
                : 'No reports have been submitted yet.'}
            </p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Description</th>
                <th>Location</th>
                <th>Reported</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report, i) => (
                <tr
                  key={report.id}
                  className="admin-row"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <td>
                    <span className="admin-report-id">{report.id}</span>
                  </td>
                  <td>
                    <div className="admin-desc">
                      {report.image && (
                        <img
                          src={report.image}
                          alt=""
                          className="admin-thumb"
                          onClick={() => setSelectedReport(report)}
                        />
                      )}
                      <span className="admin-desc-text">{report.description}</span>
                    </div>
                  </td>
                  <td>
                    <span className="admin-coords">
                      {report.lat?.toFixed(4)}, {report.lng?.toFixed(4)}
                    </span>
                  </td>
                  <td>
                    <span className="admin-timestamp">{report.timestamp}</span>
                  </td>
                  <td>
                    <span
                      className={`admin-status-badge ${report.status || 'pending'}`}
                      style={{
                        background: STATUS_CONFIG[report.status || 'pending'].bg,
                        color: STATUS_CONFIG[report.status || 'pending'].color,
                      }}
                    >
                      {STATUS_CONFIG[report.status || 'pending'].icon}{' '}
                      {STATUS_CONFIG[report.status || 'pending'].label}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="admin-action-btn view"
                        title="View Details"
                        onClick={() => setSelectedReport(report)}
                      >👁️</button>
                      <button
                        className="admin-action-btn edit"
                        title="Edit Report"
                        onClick={() => { setSelectedReport(report); setShowEditModal(true) }}
                      >✏️</button>
                      <button
                        className="admin-action-btn resolve"
                        title="Confirm Resolution"
                        onClick={() => { setSelectedReport(report); setShowConfirmModal(true) }}
                      >✅</button>
                      <button
                        className="admin-action-btn delete"
                        title="Delete Report"
                        onClick={() => setShowDeleteConfirm(report.id)}
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View Detail Modal */}
      {selectedReport && !showConfirmModal && !showEditModal && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onStatusChange={handleStatusUpdate}
          onConfirmResolve={() => setShowConfirmModal(true)}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedReport && (
        <EditReportModal
          report={selectedReport}
          onClose={() => { setShowEditModal(false); setSelectedReport(null) }}
          onSave={handleEditSave}
        />
      )}

      {/* Resolution Confirmation Modal */}
      {showConfirmModal && selectedReport && (
        <ResolutionConfirmModal
          report={selectedReport}
          onClose={() => { setShowConfirmModal(false); setSelectedReport(null) }}
          onSubmit={handleResolutionSubmit}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="admin-delete-dialog" onClick={e => e.stopPropagation()}>
            <div className="admin-delete-icon">⚠️</div>
            <h3>Delete Report?</h3>
            <p>This action cannot be undone. The report <strong>{showDeleteConfirm}</strong> will be permanently removed.</p>
            <div className="admin-delete-actions">
              <button className="btn secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="btn danger" onClick={() => handleDelete(showDeleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}
    </div>
  )
}


/* ── Report Detail Modal ── */
function ReportDetailModal({ report, onClose, onStatusChange, onConfirmResolve }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📄 Report Details</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="admin-detail-body">
          {report.image && (
            <div className="admin-detail-image-wrap">
              <img src={report.image} alt="Report" className="admin-detail-image" />
            </div>
          )}

          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Report ID</span>
              <span className="admin-detail-value id">{report.id}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Status</span>
              <span
                className={`admin-status-badge ${report.status || 'pending'}`}
                style={{
                  background: STATUS_CONFIG[report.status || 'pending'].bg,
                  color: STATUS_CONFIG[report.status || 'pending'].color,
                }}
              >
                {STATUS_CONFIG[report.status || 'pending'].icon}{' '}
                {STATUS_CONFIG[report.status || 'pending'].label}
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Location</span>
              <span className="admin-detail-value">{report.lat?.toFixed(4)}, {report.lng?.toFixed(4)}</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Reported On</span>
              <span className="admin-detail-value">{report.timestamp}</span>
            </div>
          </div>

          <div className="admin-detail-description">
            <span className="admin-detail-label">Description</span>
            <p>{report.description}</p>
          </div>

          {/* Resolution Info if resolved */}
          {report.resolution && (
            <div className="admin-resolution-info">
              <h4>✅ Resolution Verification</h4>
              <div className="admin-resolution-answers">
                {report.resolution.answers && Object.entries(report.resolution.answers).map(([q, a]) => (
                  <div key={q} className="admin-resolution-qa">
                    <span className="admin-qa-q">{q}</span>
                    <span className="admin-qa-a">{a}</span>
                  </div>
                ))}
              </div>
              {report.resolution.images && report.resolution.images.length > 0 && (
                <div className="admin-resolution-images">
                  <span className="admin-detail-label">Verification Photos</span>
                  <div className="admin-image-grid">
                    {report.resolution.images.map((img, i) => (
                      <img key={i} src={img} alt={`Verification ${i + 1}`} />
                    ))}
                  </div>
                </div>
              )}
              {report.resolution.notes && (
                <div className="admin-resolution-notes">
                  <span className="admin-detail-label">Admin Notes</span>
                  <p>{report.resolution.notes}</p>
                </div>
              )}
            </div>
          )}

          <div className="admin-detail-actions">
            <select
              className="admin-status-select"
              value={report.status || 'pending'}
              onChange={e => onStatusChange(report.id, e.target.value)}
            >
              <option value="pending">🔴 Pending</option>
              <option value="in_progress">🟡 In Progress</option>
              <option value="resolved">🟢 Resolved</option>
            </select>
            <button className="btn primary" onClick={onConfirmResolve}>
              ✅ Confirm Resolution
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


/* ── Edit Report Modal ── */
function EditReportModal({ report, onClose, onSave }) {
  const [description, setDescription] = useState(report.description || '')
  const [status, setStatus] = useState(report.status || 'pending')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(report.id, { description, status })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Report — {report.id}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="admin-edit-body">
          <div className="admin-form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="admin-form-group">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="admin-edit-actions">
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


/* ── Resolution Confirmation Modal ── */
function ResolutionConfirmModal({ report, onClose, onSubmit }) {
  const [images, setImages] = useState([])
  const [answers, setAnswers] = useState({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const QUESTIONS = [
    { id: 'visited', question: 'Have you physically visited and inspected the site?', type: 'select', options: ['Yes', 'No'] },
    { id: 'issue_fixed', question: 'Has the reported infrastructure issue been fully repaired/fixed?', type: 'select', options: ['Yes, fully fixed', 'Partially fixed', 'No, not fixed yet'] },
    { id: 'safety', question: 'Is the area now safe for public use?', type: 'select', options: ['Yes, completely safe', 'Safe with caution', 'Still unsafe'] },
    { id: 'quality', question: 'Rate the quality of repair work (1-5)', type: 'select', options: ['5 - Excellent', '4 - Good', '3 - Average', '2 - Below Average', '1 - Poor'] },
    { id: 'follow_up', question: 'Is any follow-up maintenance required?', type: 'select', options: ['No follow-up needed', 'Minor follow-up needed', 'Major follow-up needed'] },
    { id: 'timeline', question: 'When was the repair completed?', type: 'text', placeholder: 'e.g., May 8, 2026' },
  ]

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxW = 800
          const scale = Math.min(1, maxW / img.width)
          canvas.width = img.width * scale
          canvas.height = img.height * scale
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          setImages(prev => [...prev, canvas.toDataURL('image/jpeg', 0.7)])
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    // Validation
    const unanswered = QUESTIONS.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      alert(`Please answer all verification questions. Missing: ${unanswered.map(q => q.question).join(', ')}`)
      return
    }
    if (images.length < 2) {
      alert('Please upload at least 2 verification photos of the resolved issue.')
      return
    }

    setSubmitting(true)
    const formData = {
      images,
      answers: {},
      notes,
    }
    // Map answers with question text as keys
    QUESTIONS.forEach(q => {
      formData.answers[q.question] = answers[q.id]
    })
    await onSubmit(report.id, formData)
    setSubmitting(false)
  }

  const allAnswered = QUESTIONS.every(q => answers[q.id])
  const canSubmit = allAnswered && images.length >= 2 && !submitting

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-resolve-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header resolve-header">
          <div>
            <h2>✅ Confirm Resolution</h2>
            <p className="resolve-subtitle">Report: {report.id} — {report.description?.slice(0, 60)}</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="admin-resolve-body">
          {/* Image Upload Section */}
          <div className="resolve-section">
            <div className="resolve-section-header">
              <span className="resolve-section-icon">📸</span>
              <div>
                <h3>Verification Photos</h3>
                <p>Upload at least 2 photos showing the resolved infrastructure issue</p>
              </div>
            </div>

            <div className="resolve-image-grid">
              {images.map((img, i) => (
                <div key={i} className="resolve-image-item">
                  <img src={img} alt={`Verification ${i + 1}`} />
                  <button className="resolve-image-remove" onClick={() => removeImage(i)}>✕</button>
                  <span className="resolve-image-num">{i + 1}</span>
                </div>
              ))}
              <button className="resolve-image-add" onClick={() => fileInputRef.current?.click()}>
                <span className="resolve-add-icon">+</span>
                <span className="resolve-add-text">Add Photo</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <div className="resolve-image-hint">
              {images.length < 2
                ? `⚠️ ${2 - images.length} more photo(s) required`
                : `✅ ${images.length} photo(s) uploaded`}
            </div>
          </div>

          {/* Verification Questions */}
          <div className="resolve-section">
            <div className="resolve-section-header">
              <span className="resolve-section-icon">📝</span>
              <div>
                <h3>Verification Questions</h3>
                <p>Answer all questions to confirm the resolution</p>
              </div>
            </div>

            <div className="resolve-questions">
              {QUESTIONS.map((q, i) => (
                <div key={q.id} className={`resolve-question ${answers[q.id] ? 'answered' : ''}`}>
                  <label>
                    <span className="resolve-q-num">{i + 1}</span>
                    {q.question}
                  </label>
                  {q.type === 'select' ? (
                    <select
                      value={answers[q.id] || ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    >
                      <option value="">Select an answer...</option>
                      {q.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={q.placeholder}
                      value={answers[q.id] || ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Admin Notes */}
          <div className="resolve-section">
            <div className="resolve-section-header">
              <span className="resolve-section-icon">💬</span>
              <div>
                <h3>Admin Notes</h3>
                <p>Optional additional notes about the resolution</p>
              </div>
            </div>
            <textarea
              className="resolve-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any additional observations, recommendations, or notes..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="resolve-footer">
            <div className="resolve-progress">
              <div className="resolve-progress-bar">
                <div
                  className="resolve-progress-fill"
                  style={{
                    width: `${((Object.keys(answers).filter(k => answers[k]).length / QUESTIONS.length) * 0.6 + (Math.min(images.length, 2) / 2) * 0.4) * 100}%`
                  }}
                />
              </div>
              <span className="resolve-progress-text">
                {Math.round(((Object.keys(answers).filter(k => answers[k]).length / QUESTIONS.length) * 0.6 + (Math.min(images.length, 2) / 2) * 0.4) * 100)}% complete
              </span>
            </div>
            <div className="resolve-submit-actions">
              <button className="btn secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn primary resolve-submit-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <>Submitting…</>
                ) : (
                  <>🛡️ Confirm Resolution</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
