import { useState, useRef, useEffect, useCallback } from 'react'
import '../index.css'

const API = 'http://172.16.6.3:5000/api'

export default function ReportModal({ lat, lng, onClose, onSubmitted }) {
  const [description, setDescription] = useState('')
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // Start camera on mount
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        setCameraError('Camera access denied or unavailable.')
      }
    }
    startCamera()

    return () => {
      // Stop camera on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setImage(canvas.toDataURL('image/jpeg', 0.8))
    
    // Stop stream after capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  const retakePhoto = useCallback(() => {
    setImage(null)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setCameraError('Camera access denied.'))
  }, [])

  const submitReport = async () => {
    if (!description.trim()) return alert('Please enter a description.')
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          description,
          image,
          timestamp: new Date().toLocaleString()
        })
      })
      if (res.ok) {
        const newReport = await res.json()
        onSubmitted(newReport)
      } else {
        alert('Failed to submit report.')
      }
    } catch (e) {
      alert('Error connecting to server.')
    }
    setSubmitting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Report a Problem</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <p className="location-text">
            📍 Location: {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>

          <div className="camera-section">
            {cameraError ? (
              <div className="camera-error">{cameraError}</div>
            ) : image ? (
              <div className="image-preview-container">
                <img src={image} alt="Captured problem" className="image-preview" />
                <button className="btn secondary" onClick={retakePhoto}>Retake Photo</button>
              </div>
            ) : (
              <div className="video-container">
                <video ref={videoRef} autoPlay playsInline muted />
                <button className="btn primary capture-btn" onClick={capturePhoto}>📸 Capture Photo</button>
              </div>
            )}
            {/* Hidden canvas for image extraction */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          <textarea
            className="report-textarea"
            placeholder="Describe the problem (e.g., Pothole, Broken Pipe, Crack in Bridge...)"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <button 
            className="btn primary submit-btn" 
            onClick={submitReport}
            disabled={submitting || !description.trim()}
          >
            {submitting ? 'Submitting...' : 'Upload Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
