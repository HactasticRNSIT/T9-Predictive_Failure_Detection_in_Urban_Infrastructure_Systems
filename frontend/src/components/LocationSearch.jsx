import { useState, useRef } from 'react'

export default function LocationSearch({ currentLocation, locationName, onLocationChange }) {
  const [expanded, setExpanded] = useState(false)
  const [lat, setLat] = useState(currentLocation ? String(currentLocation[0]) : '')
  const [lng, setLng] = useState(currentLocation ? String(currentLocation[1]) : '')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)

  // Sync lat/lng fields when location changes externally
  const syncFields = (newLat, newLng) => {
    setLat(String(newLat.toFixed(5)))
    setLng(String(newLng.toFixed(5)))
  }

  // Apply manual lat/lng
  const applyCoords = () => {
    const la = parseFloat(lat)
    const ln = parseFloat(lng)
    if (isNaN(la) || isNaN(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) return
    onLocationChange(la, ln)
    setExpanded(false)
    setResults([])
  }

  // Search places via Nominatim
  const handleSearch = (query) => {
    setSearch(query)
    clearTimeout(debounce.current)
    if (query.length < 3) { setResults([]); return }

    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        setResults(data.map(d => ({
          name: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        })))
      } catch { setResults([]) }
      setSearching(false)
    }, 400)
  }

  // Select a place from results
  const selectPlace = (place) => {
    syncFields(place.lat, place.lng)
    setSearch('')
    setResults([])
    onLocationChange(place.lat, place.lng)
    setExpanded(false)
  }

  // Use current device GPS
  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        syncFields(latitude, longitude)
        onLocationChange(latitude, longitude)
        setExpanded(false)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div className="loc-search">
      <button className="loc-trigger" onClick={() => setExpanded(!expanded)}>
        <div className="pulse-dot" />
        <span className="loc-name">{locationName}</span>
        <span className="loc-coords">
          {currentLocation ? `${currentLocation[0].toFixed(4)}, ${currentLocation[1].toFixed(4)}` : 'No coords'}
        </span>
        <span className="loc-edit-icon">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="loc-dropdown">
          {/* Place search */}
          <div className="loc-section">
            <label>Search Location</label>
            <input
              type="text"
              className="loc-input"
              placeholder="City, address, or landmark..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              autoFocus
            />
            {searching && <div className="loc-hint">Searching…</div>}
            {results.length > 0 && (
              <div className="loc-results">
                {results.map((r, i) => (
                  <button key={i} className="loc-result-item" onClick={() => selectPlace(r)}>
                    <span className="loc-result-icon">📍</span>
                    <span className="loc-result-name">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual lat/lng */}
          <div className="loc-section">
            <label>Manual Coordinates</label>
            <div className="loc-coord-row">
              <div className="loc-coord-field">
                <span className="loc-coord-label">LAT</span>
                <input
                  type="number"
                  step="any"
                  className="loc-input loc-coord-input"
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                  placeholder="e.g. 28.6139"
                />
              </div>
              <div className="loc-coord-field">
                <span className="loc-coord-label">LNG</span>
                <input
                  type="number"
                  step="any"
                  className="loc-input loc-coord-input"
                  value={lng}
                  onChange={e => setLng(e.target.value)}
                  placeholder="e.g. 77.2090"
                />
              </div>
              <button className="loc-go-btn" onClick={applyCoords}>Go</button>
            </div>
          </div>

          {/* Quick action */}
          <button className="loc-gps-btn" onClick={useMyLocation}>
            📡 Use My Live Location
          </button>
        </div>
      )}
    </div>
  )
}
