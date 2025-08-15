import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { LatLng, LifeForm } from '../types'

const COLORS = {
  gold: '#C9A227',
  greenDark: '#0F5132',
  arvore: '#198754',
  arbusto: '#22C55E',
  erva: '#34D399',
  palmeira: '#16A34A',
  epifita: '#059669',
  cipo: '#0EA5E9',
  default: '#198754'
}

function leafPinSVG(fill: string) {
  return `
  <div style="transform:translate(-13px,-13px)">
    <svg width="30" height="38" viewBox="0 0 56 72" xmlns="http://www.w3.org/2000/svg">
      <rect x="26" y="44" width="4" height="22" rx="2" fill="${COLORS.gold}"/>
      <path d="M28 10c15 0 26 12 26 26c0 16-14 30-26 42C16 66 2 52 2 36C2 22 13 10 28 10z"
            fill="${fill}" stroke="${COLORS.greenDark}" stroke-width="3"/>
      <path d="M28 18c0 10 0 22 0 34" stroke="${COLORS.greenDark}" stroke-width="3" stroke-linecap="round"/>
      <path d="M28 24c8 5 13 11 15 17" stroke="${COLORS.greenDark}" stroke-width="2" stroke-linecap="round" opacity=".9"/>
      <path d="M28 24c-8 5 -13 11 -15 17" stroke="${COLORS.greenDark}" stroke-width="2" stroke-linecap="round" opacity=".9"/>
    </svg>
  </div>`
}

function iconFor(life?: LifeForm) {
  const fill =
    life === 'arvore' ? COLORS.arvore :
    life === 'arbusto' ? COLORS.arbusto :
    life === 'erva' ? COLORS.erva :
    life === 'palmeira' ? COLORS.palmeira :
    life === 'epifita' ? COLORS.epifita :
    life === 'cipo' ? COLORS.cipo :
    COLORS.default
  return L.divIcon({ html: leafPinSVG(fill), className: 'life-pin', iconSize: [30, 38], iconAnchor: [15, 19] })
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click(e){ onClick({ lat:e.latlng.lat, lng:e.latlng.lng }) } })
  return null
}

export default function MapView({
  center,
  lifeForm,
  onMoveMarker
}: {
  center: LatLng
  lifeForm?: LifeForm
  onMoveMarker: (p: LatLng) => void
}) {
  return (
    <div className="card">
      <label>Posição no mapa (toque para mover / arraste o marcador)</label>
      <div style={{ height: 320, borderRadius: 12, overflow: 'hidden', border:'1px solid var(--gold)' }}>
        <MapContainer center={[center.lat, center.lng]} zoom={18} style={{ height: '100%' }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker
            draggable
            icon={iconFor(lifeForm)}
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
