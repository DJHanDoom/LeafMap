import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L, { LatLngExpression } from 'leaflet'
import type { LatLng, LifeForm } from '../types'

/** converte forma de vida em emoji (fallback visual) */
function lifeFormEmoji(lf?: LifeForm) {
  switch (lf) {
    case 'árvore': return '🌳'
    case 'arbusto': return '🌿'
    case 'erva': return '🍃'
    case 'cipó': return '🪢'
    case 'epífita': return '🪴'
    case 'palmeira': return '🌴'
    default: return '📍'
  }
}

/** cria um divIcon com emoji e cor */
function lifeFormIcon(lf?: LifeForm) {
  const emoji = lifeFormEmoji(lf)
  const color = lf === 'árvore' ? '#157347'
    : lf === 'arbusto' ? '#1e7e34'
    : lf === 'erva' ? '#2d6a4f'
    : lf === 'palmeira' ? '#0b5ed7'
    : lf === 'cipó' ? '#6f42c1'
    : lf === 'epífita' ? '#198754'
    : '#6c757d'
  const html = `
  <div style="
    display:flex;align-items:center;justify-content:center;
    width:34px;height:34px;border-radius:50%;
    background:${color}; color:#fff; font-size:18px;
    box-shadow:0 1px 6px rgba(0,0,0,.4);
  ">${emoji}</div>`
  return L.divIcon({
    className: 'lf-marker',
    html,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  })
}

function ResizeOnMount() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 50)
    setTimeout(() => map.invalidateSize(), 250)
  }, [map])
  return null
}

function ClickDrag({
  onMoveMarker,
}: {
  onMoveMarker?: (pos: LatLng) => void
}) {
  useMapEvents({
    click(e) {
      onMoveMarker?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function MapView(props: {
  center: LatLng
  marker: LatLng
  lifeForm?: LifeForm
  onMoveMarker?: (pos: LatLng) => void
  height?: number
}) {
  const { center, marker, lifeForm, onMoveMarker, height = 300 } = props
  const ic = useMemo(() => lifeFormIcon(lifeForm), [lifeForm])

  const position: LatLngExpression = [center.lat, center.lng]
  const markerPos: LatLngExpression = [marker.lat, marker.lng]

  return (
    <div style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer
        center={position}
        zoom={18}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <ResizeOnMount />
        <ClickDrag onMoveMarker={onMoveMarker} />
        <Marker
          position={markerPos}
          icon={ic}
          draggable={!!onMoveMarker}
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as any).getLatLng() as { lat: number; lng: number }
              onMoveMarker?.({ lat: ll.lat, lng: ll.lng })
            },
          }}
        />
      </MapContainer>
    </div>
  )
}
