import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { LatLng, LifeForm } from '../types'

function iconFor(life?: LifeForm) {
  const emoji =
    life === 'arvore' ? '🌳' :
    life === 'arbusto' ? '🌿' :
    life === 'erva' ? '🍀' :
    life === 'cipo' ? '🪢' :
    life === 'epifita' ? '🪴' :
    life === 'palmeira' ? '🌴' :
    life === 'liana' ? '🧵' : '📍'
  return L.divIcon({ html: `<div style="font-size:24px;line-height:24px">${emoji}</div>`, className:'life-pin', iconSize:[24,24], iconAnchor:[12,12] })
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click(e){ onClick({ lat:e.latlng.lat, lng:e.latlng.lng }) } })
  return null
}

export default function MapView({ center, lifeForm, onMoveMarker }: { center: LatLng; lifeForm?: LifeForm; onMoveMarker: (p: LatLng) => void }) {
  return (
    <div className="card">
      <label>Posição no mapa (toque para mover / arraste o marcador)</label>
      <div style={{ height: 320, borderRadius: 12, overflow: 'hidden' }}>
        <MapContainer center={[center.lat, center.lng]} zoom={18} style={{ height: '100%' }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker draggable icon={iconFor(lifeForm)} position={[center.lat, center.lng]}
            eventHandlers={{ dragend(e){ const m = e.target as L.Marker; const p = m.getLatLng(); onMoveMarker({lat:p.lat,lng:p.lng}) }}}
          />
          <ClickHandler onClick={onMoveMarker} />
        </MapContainer>
      </div>
    </div>
  )
}
