import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import type { TreeRecord, LifeForm, LatLng } from '../types'

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
  <div style="transform:translate(-12px,-12px)">
    <svg width="28" height="36" viewBox="0 0 56 72" xmlns="http://www.w3.org/2000/svg">
      <rect x="26" y="44" width="4" height="22" rx="2" fill="${COLORS.gold}"/>
      <path d="M28 10c15 0 26 12 26 26c0 16-14 30-26 42C16 66 2 52 2 36C2 22 13 10 28 10z"
            fill="${fill}" stroke="${COLORS.greenDark}" stroke-width="3"/>
      <path d="M28 18c0 10 0 22 0 34" stroke="${COLORS.greenDark}" stroke-width="3" stroke-linecap="round"/>
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
  return L.divIcon({ html: leafPinSVG(fill), className: 'life-pin', iconSize: [28, 36], iconAnchor: [14, 18] })
}

function FlyTo({ focus }: { focus?: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) {
      const z = Math.max(map.getZoom(), 17)
      map.flyTo([focus.lat, focus.lng], z, { duration: 0.6 })
    }
  }, [focus, map])
  return null
}

export default function RecordsMap({
  records,
  center,
  onOpenRecord,
  focus
}: {
  records: TreeRecord[]
  center: LatLng
  onOpenRecord: (r: TreeRecord) => void
  focus?: LatLng | null
}) {
  return (
    <div style={{ height: 360, borderRadius: 12, overflow: 'hidden', border:'1px solid var(--gold)' }}>
      <MapContainer center={[center.lat, center.lng]} zoom={16} style={{ height: '100%' }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FlyTo focus={focus} />
        {records.map(r => (
          <Marker key={r.id} position={[r.position.lat, r.position.lng]} icon={iconFor(r.morphology?.formaVida as LifeForm)}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div><b>{r.commonName ?? '—'}</b></div>
                <div><i>{r.scientificName ?? '—'}</i></div>
                {r.family ? <div>Família: {r.family}</div> : null}
                {r.morphology?.formaVida ? <div>Forma de vida: {r.morphology.formaVida}</div> : null}
                <div style={{ marginTop: 6 }}>
                  <button className="gold" onClick={() => onOpenRecord(r)}>Ver fotos</button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
