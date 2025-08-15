import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { LatLng, LifeForm } from '../types'

function iconFor(life?: LifeForm) {
  // variação sutil por forma de vida (tons de verde), com dourado no contorno
  const tone =
    life === 'arvore' ? '#198754' :
    life === 'arbusto' ? '#22C55E' :
    life === 'erva' ? '#34D399' :
    life === 'palmeira' ? '#16A34A' :
    life === 'epifita' ? '#059669' :
    life === 'cipo' ? '#0EA5E9' : '#198754'
  const html = `
  <div style="transform:translate(-12px,-12px)">
    <svg width="28" height="36" viewBox="0 0 56 72" xmlns="http://www.w3.org/2000/svg">
      <g>
        <rect x="26" y="44" width="4" height="22" rx="2" fill="#C9A227"/>
        <path d="M28 10c15 0 26 12 26 26c0 16-14 30-26 42C16 66 2 52 2 36C2 22 13 10 28 10z"
              fill="${tone}" stroke="#14532D" stroke-width="3"/>
        <path d="M28 18c0 10 0 22 0 34" stroke="#14532D" stroke-width="3" stroke-linecap="round"/>
        <path d="M28 24c8 5 13 11 15 17" stroke="#14532D" stroke-width="2" stroke-linecap="round" opacity=".9"/>
        <path d="M28 24c-8 5 -13 11 -15 17" stroke="#14532D" stroke-width="2" stroke-linecap="round" opacity=".9"/>
      </g>
    </svg>
  </div>`
  return L.divIcon({ html, className: 'life-pin', iconSize: [28, 36], iconAnchor: [14, 18] })
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click(e){ onClick({ lat:e.latlng.lat, lng:e.latlng.lng }) } })
  return null
}

export default function MapView({ center, lifeForm, onMoveMarker }: { center: LatLng; lifeForm?: LifeForm; onMoveMarker: (p: LatLng) => void }) {
  return (
    <div className="card">
      <label>Posição no mapa (toque para mover / arraste o marcador)</label>
      <div style={{ height: 320, borderRadius: 12, overflow: 'hidden', border:'1px solid var(--gold)' }}>
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
