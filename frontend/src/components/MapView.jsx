import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

const STATUS_COLORS = {
  critical: '#ff4757',
  watch: '#ffb830',
  stable: '#34d399',
}

function FlyTo({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 14, { duration: 0.8 })
  }, [lat, lng, map])
  return null
}

function FitToAssets({ assets, userLocation }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current) return
    if (userLocation) {
      map.setView(userLocation, 13)
      fitted.current = true
    } else if (assets.length > 0) {
      const bounds = L.latLngBounds(assets.map(a => [a.lat, a.lng]))
      map.fitBounds(bounds.pad(0.15))
      fitted.current = true
    }
  }, [assets, userLocation, map])
  return null
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      // Ignore clicks on markers (handled by propagation stopping, or just trigger it anyway)
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
  })
  return null
}

export default function MapView({ assets, reports, onSelect, selected, userLocation, onMapClick }) {
  return (
    <div className="map-container">
      <MapContainer
        center={[40.745, -73.95]}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToAssets assets={assets} userLocation={userLocation} />

        {selected && <FlyTo lat={selected.lat} lng={selected.lng} />}

        {/* User location pulsing marker */}
        {userLocation && (
          <>
            <Circle
              center={userLocation}
              radius={200}
              pathOptions={{
                color: '#00d4ff',
                fillColor: '#00d4ff',
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: '6 4',
              }}
            />
            <CircleMarker
              center={userLocation}
              radius={8}
              pathOptions={{
                color: '#fff',
                fillColor: '#00d4ff',
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                <div className="popup-title">📍 Your Location</div>
                <div className="popup-type">Live GPS Position</div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Infrastructure asset markers */}
        {assets.map(asset => (
          <CircleMarker
            key={asset.id}
            center={[asset.lat, asset.lng]}
            radius={asset.status === 'critical' ? 12 : asset.status === 'watch' ? 9 : 7}
            pathOptions={{
              color: STATUS_COLORS[asset.status],
              fillColor: STATUS_COLORS[asset.status],
              fillOpacity: asset.status === 'critical' ? 0.7 : 0.5,
              weight: selected?.id === asset.id ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(asset) }}
          >
            <Popup>
              <div className="popup-title">{asset.name}</div>
              <div className="popup-type">{asset.type} — {asset.id}</div>
              <div className="popup-meta">
                <span>Age: {asset.age} yrs / {asset.maxAge} max</span>
                <span>Load: {asset.load}%</span>
                <span>Inspection: {asset.inspectionScore}/100</span>
                <span>Last Maint: {asset.lastMaintenance} yrs ago</span>
              </div>
              <div className={`popup-rul ${asset.status}`}>
                RUL: ~{asset.rulMonths} months
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* User Problem Reports */}
        {reports?.map(report => (
          <CircleMarker
            key={report.id}
            center={[report.lat, report.lng]}
            radius={8}
            pathOptions={{
              color: '#fff',
              fillColor: '#9333ea', // purple for user reports
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <div className="popup-title">⚠️ User Report</div>
              <div className="popup-meta" style={{ marginTop: '5px' }}>
                <p><strong>Desc:</strong> {report.description}</p>
                <p><strong>Time:</strong> {report.timestamp}</p>
                {report.image && (
                  <img 
                    src={report.image} 
                    alt="Report" 
                    style={{ width: '100%', borderRadius: '4px', marginTop: '8px' }} 
                  />
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        <MapClickHandler onMapClick={onMapClick} />
      </MapContainer>
    </div>
  )
}
