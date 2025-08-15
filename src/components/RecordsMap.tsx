import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import type { TreeRecord, LifeForm, LatLng } from '../types'

function iconFor(life?: LifeForm) {
  const emoji =
    life === 'arvore' ? '🌳' :
    life === 'arbusto' ? '🌿' :
    life === 'erva' ? '🍀' :
    life === 'cipo' ? '🪢' :
    life === 'epifita' ? '🪴' :
    life === 'palmeira' ? '🌴' :
    life === 'liana' ? '🧵' : '📍'
  return L.divIcon({ html:`<div style="font-size:22px;line-height:22px">${emoji}</div>`, className:'life-pin', iconSize:[22,22], iconAnchor:[11,11] })
}

function FlyTo({ focus }: { focus?: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 17), { duration: 0.6 })
  }, [focus, map])
  return null
}

export default function RecordsMap({
  records, center, onOpenRecord, focus
}: {
  records: TreeRecord[]
  center: LatLng
  onOpenRecord: (r: TreeRecord) => void
  focus?: LatLng | null
}) {
  return (
    <div style={{ height: 360, borderRadius: 12, overflow: 'hidden' }}>
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
                  <button onClick={() => onOpenRecord(r)}>Ver fotos</button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
