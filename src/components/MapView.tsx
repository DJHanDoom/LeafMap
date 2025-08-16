import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import type { LatLng, LifeForm } from '../types'
import 'leaflet/dist/leaflet.css'

function LeafDrag({ onMove }: { onMove: (pos:{lat:number;lng:number})=>void }) {
  useMapEvents({
    click(e){ onMove({ lat:e.latlng.lat, lng:e.latlng.lng }) }
  })
  return null
}

const leafIcon = (life?: LifeForm) => L.divIcon({
  className: 'leaf-pin',
  html: `<div class="leaf-pin-inner ${life || 'tree'}"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30]
})

export default function MapView({
  center,
  marker,
  lifeForm,
  onMoveMarker,
  height = 260
}: {
  center: LatLng
  marker: LatLng
  lifeForm?: LifeForm
  onMoveMarker: (pos:LatLng)=>void
  height?: number
}) {
  // corrige tiles quebrados no container dentro de cards
  useEffect(() => { setTimeout(()=>window.dispatchEvent(new Event('resize')), 50) }, [center])

  return (
    <div className="map-shell" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={17} style={{ height:'100%', width:'100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafDrag onMove={onMoveMarker} />
        <Marker
          position={[marker.lat, marker.lng]}
          draggable
          eventHandlers={{
            dragend: (e:any) => {
              const p = e.target.getLatLng()
              onMoveMarker({ lat: p.lat, lng: p.lng })
            }
          }}
          icon={leafIcon(lifeForm)}
        />
      </MapContainer>
    </div>
  )
}
