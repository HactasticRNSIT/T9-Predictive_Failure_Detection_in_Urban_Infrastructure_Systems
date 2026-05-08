import { useState, useRef, useEffect, useCallback } from 'react'
import '../index.css'

const API = 'http://172.16.6.3:5000/api'

export default function ReportModal({ lat, lng, onClose, onSubmitted }) {
  const [description, setDescription] = useState('')
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Start camera
  const startCamera = useCallback(async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      setCameraActive(true)
      // Wait for the video element to render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 100)
    } catch (err) {
      setCameraError('Camera not available. Use "Choose File" instead.')
      setCameraActive(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setImage(canvas.toDataURL('image/jpeg', 0.7))
    stopCamera()
  }, [stopCamera])

  // Handle file upload from gallery
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (ev) => {
      // Resize the image to keep it manageable
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas')
        const maxW = 800
        const scale = Math.min(1, maxW / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setImage(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
        const err = await res.json()
        alert('Failed: ' + (err.error || 'Unknown error'))
      }
    } catch (e) {
      alert('Error connecting to server. Is Flask running?')
    }
    setSubmitting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚠️ Report a Problem</h2>
          <button className="close-btn" onClick={() => { stopCamera(); onClose() }}>✕</button>
        </div>
        
        <div className="modal-body">
          <p className="location-text">
            📍 Location: {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>

          {/* Image section */}
          <div className="camera-section">
            {image ? (
              <div className="image-preview-container">
                <img src={image} alt="Captured" className="image-preview" />
                <button className="btn secondary" onClick={clearImage} style={{ marginTop: '8px' }}>
                  Remove & Retake
                </button>
              </div>
            ) : cameraActive ? (
              <div className="video-container">
                <video ref={videoRef} autoPlay playsInline muted />
                <button className="btn primary capture-btn" onClick={capturePhoto}>
                  📸 Capture Photo
                </button>
                <button className="btn secondary" onClick={stopCamera} style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                  Cancel Camera
                </button>
              </div>
            ) : (
              <div className="upload-options">
                {cameraError && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: '0 0 10px 0' }}>{cameraError}</p>}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={startCamera} style={{ flex: 1 }}>
                    📷 Open Camera
                  </button>
                  <button className="btn secondary" onClick={() => fileInputRef.current?.click()} style={{ flex: 1 }}>
                    📁 Choose File
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>
                  Photo is optional — you can submit with just a description
                </p>
              </div>
            )}
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
            {submitting ? 'Submitting...' : '📤 Upload Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
