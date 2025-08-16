import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L, { LatLngBounds, LatLngExpression } from 'leaflet'
import type { TreeRecord, LifeForm, LatLng } from '../types'

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
    width:30px;height:30px;border-radius:50%;
    background:${color}; color:#fff; font-size:16px;
    box-shadow:0 1px 6px rgba(0,0,0,.4);
  ">${emoji}</div>`
  return L.divIcon({
    className: 'lf-marker',
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  })
}

function FitOnData({
  records,
  focus,
  centerFallback,
}: {
  records: TreeRecord[]
  focus?: LatLng | null
  centerFallback: LatLng
}) {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 60)
    setTimeout(() => map.invalidateSize(), 260)
  }, [map])

  useEffect(() => {
    const pts = records.map((r) => [r.position.lat, r.position.lng] as [number, number])
    if (focus) {
      map.setView([focus.lat, focus.lng], 18, { animate: true })
      return
    }
    if (pts.length >= 2) {
      const b = new LatLngBounds(pts)
      map.fitBounds(b.pad(0.2))
    } else if (pts.length === 1) {
      map.setView(pts[0], 18)
    } else {
      map.setView([centerFallback.lat, centerFallback.lng], 5)
    }
  }, [records, focus, centerFallback, map])
  return null
}

export default function RecordsMap(props: {
  records: TreeRecord[]
  center: LatLng
  focus?: LatLng | null
  onOpenRecord?: (r: TreeRecord) => void
  height?: number
}) {
  const { records, center, focus, onOpenRecord, height = 360 } = props
  const icons = useMemo(
    () =>
      Object.fromEntries(
        ['árvore', 'arbusto', 'erva', 'cipó', 'epífita', 'palmeira', ''].map((k) => [k, lifeFormIcon(k as LifeForm)]),
      ) as Record<string, L.DivIcon>,
    [],
  )

  return (
    <div style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer
        center={[center.lat, center.lng] as LatLngExpression}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <FitOnData records={records} focus={focus} centerFallback={center} />
        {records.map((r) => (
          <Marker
            key={r.id}
            position={[r.position.lat, r.position.lng]}
            icon={icons[(r.morphology?.formaVida as any) || ''] || icons['']}
            eventHandlers={{
              click: () => onOpenRecord?.(r),
            }}
          />
        ))}
      </MapContainer>
    </div>
  )
}
