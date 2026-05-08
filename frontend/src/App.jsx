import { useState, useEffect, useCallback } from 'react'
import './index.css'
import StatsBar from './components/StatsBar'
import MapView from './components/MapView'
import WarningFeed from './components/WarningFeed'
import AssetDetail from './components/AssetDetail'
import Predictor from './components/Predictor'
import Chatbot from './components/Chatbot'
import LocationSearch from './components/LocationSearch'

const API = 'http://172.16.6.3:5000/api'

export default function App() {
  const [assets, setAssets] = useState([])
  const [warnings, setWarnings] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [locationName, setLocationName] = useState('Detecting location…')
  const [mapKey, setMapKey] = useState(0) // force map re-render on location change

  // Reverse geocode to get city name from coordinates
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      const city = data.address?.city || data.address?.town || data.address?.state_district || data.address?.state || ''
      const country = data.address?.country || ''
      setLocationName(city ? `${city}, ${country}` : country || 'Your Area')
    } catch {
      setLocationName('Your Area')
    }
  }, [])

  // Fetch assets from API with optional location
  const fetchData = useCallback(async (lat, lng) => {
    try {
      const qs = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : ''
      const [a, w] = await Promise.all([
        fetch(`${API}/assets${qs}`).then(r => r.json()),
        fetch(`${API}/warnings${qs}`).then(r => r.json()),
      ])
      setAssets(a)
      setWarnings(w)
    } catch (err) {
      console.error('API fetch failed:', err)
    }
    setLoading(false)
  }, [])

  // Navigate to a new location — called from LocationSearch
  const navigateToLocation = useCallback((lat, lng) => {
    setSelected(null)
    setUserLocation([lat, lng])
    setMapKey(k => k + 1) // force map to re-center
    reverseGeocode(lat, lng)
    fetchData(lat, lng)
  }, [reverseGeocode, fetchData])

  // Initial geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationName('Location unavailable')
      fetchData()
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserLocation([latitude, longitude])
        reverseGeocode(latitude, longitude)
        fetchData(latitude, longitude)
      },
      (err) => {
        console.warn('Geolocation denied:', err.message)
        setLocationName('Location denied — showing default')
        fetchData()
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [fetchData, reverseGeocode])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span style={{ color: 'var(--text-secondary)' }}>Detecting location & loading data…</span>
      </div>
    )
  }

  const counts = {
    total: assets.length,
    critical: assets.filter(a => a.status === 'critical').length,
    watch: assets.filter(a => a.status === 'watch').length,
    stable: assets.filter(a => a.status === 'stable').length,
  }

  return (
    <>
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">⬡</div>
          InfraWatch
        </div>
        <LocationSearch
          currentLocation={userLocation}
          locationName={locationName}
          onLocationChange={navigateToLocation}
        />
      </header>

      <StatsBar counts={counts} />

      <div className="main-layout">
        <MapView
          key={mapKey}
          assets={assets}
          onSelect={setSelected}
          selected={selected}
          userLocation={userLocation}
        />

        <div className="right-panel">
          {selected ? (
            <AssetDetail asset={selected} onClose={() => setSelected(null)} />
          ) : (
            <Predictor />
          )}

          <div className="panel-section warning-feed">
            <div className="panel-title">
              <span className="icon">🔔</span> Early Warning Feed
            </div>
            <WarningFeed warnings={warnings} onSelect={(w) => {
              const asset = assets.find(a => a.id === w.id)
              if (asset) setSelected(asset)
            }} />
          </div>
        </div>
      </div>

      <Chatbot />
    </>
  )
}
