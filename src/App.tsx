import { useState } from 'react'
import MapView from './components/MapView'
import PhotoPicker from './components/PhotoPicker'
import type { LatLng } from './types'

const DEFAULT_POS: LatLng = { lat: -23.55, lng: -46.63 }

export default function App() {
  const [pos, setPos] = useState<LatLng>(DEFAULT_POS)
  const [photos, setPhotos] = useState<string[]>([])

  return (
    <div className="wrap">
      <h1>Registro de Árvore</h1>
      <PhotoPicker
        onFirstPhoto={f => setPhotos([URL.createObjectURL(f)])}
        onMorePhotos={files => setPhotos(p => [...p, ...files.map(f => URL.createObjectURL(f))])}
      />
      <MapView center={pos} onMoveMarker={setPos} />
      <div className="card">
        Fotos:
        {photos.map((p,i) => <img key={i} src={p} height="80" />)}
      </div>
    </div>
  )
}
