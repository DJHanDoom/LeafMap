import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import type { LatLng, TreeRecord } from '../types'

const icon = L.divIcon({
  className: 'leaf-pin small',
  html: `<div class="leaf-pin-inner tree"></div>`,
  iconSize: [28,28],
  iconAnchor: [14,26]
})

export default function RecordsMap({
  records, center, focus, onOpenRecord, height=300
}: {
  records: TreeRecord[]
  center: LatLng
  focus?: LatLng | null
  onOpenRecord: (r:TreeRecord)=>void
  height?: number
}) {
  // garantir reflow
  useEffect(()=>{ setTimeout(()=>window.dispatchEvent(new Event('resize')),50) },[center, focus])

  return (
    <div className="map-shell" style={{ height }}>
      <MapContainer key={`${center.lat},${center.lng}`} center={[center.lat, center.lng]} zoom={15} style={{ height:'100%', width:'100%' }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {records.map(r => (
          <Marker key={r.id} position={[r.position.lat, r.position.lng]} icon={icon} eventHandlers={{ click:()=>onOpenRecord(r) }}>
            <Popup>{r.commonName || r.scientificName || r.id}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
