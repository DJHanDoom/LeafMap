import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { LatLng } from '../types'

const pin = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
  })
  return null
}

export default function MapView({ center, onMoveMarker }: { center: LatLng, onMoveMarker: (p: LatLng) => void }) {
  return (
    <div className="card">
      <div style={{ height: 300 }}>
        <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ height: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker
            draggable
            icon={pin}
            position={[center.lat, center.lng]}
            eventHandlers={{
              dragend(e) {
                const m = e.target as L.Marker
                const p = m.getLatLng()
                onMoveMarker({ lat: p.lat, lng: p.lng })
              }
            }}
          />
          <ClickHandler onClick={onMoveMarker} />
        </MapContainer>
      </div>
    </div>
  )
}
