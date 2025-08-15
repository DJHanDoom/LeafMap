import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import PhotoPicker from './components/PhotoPicker'
import MorphologyForm from './components/MorphologyForm'
import { extractGpsFromFile, extractDateFromFile } from './utils/exif'
import { loadAll, saveOne, wipeAll } from './storage'
import type { LatLng, Morphology, TreeRecord } from './types'

const DEFAULT_POS: LatLng = { lat: -23.55052, lng: -46.633308 } // São Paulo (fallback)

// pequeno dicionário para autocompletar família a partir do gênero
function guessFamily(scientific?: string): string | undefined {
  if (!scientific) return undefined
  const genus = scientific.trim().split(/\s+/)[0]?.toLowerCase()
  const map: Record<string, string> = {
    machaerium: 'Fabaceae',
    swartzia: 'Fabaceae',
    inga: 'Fabaceae',
    handroanthus: 'Bignoniaceae',
    tabebuia: 'Bignoniaceae',
    astronium: 'Anacardiaceae',
    schinus: 'Anacardiaceae',
    alchornea: 'Euphorbiaceae',
    croton: 'Euphorbiaceae',
    eugenia: 'Myrtaceae',
    psidium: 'Myrtaceae',
    myrcia: 'Myrtaceae',
    syzygium: 'Myrtaceae',
    ocotea: 'Lauraceae',
    nectandra: 'Lauraceae',
    cecropia: 'Urticaceae',
    licania: 'Chrysobalanaceae',
    aspidosperma: 'Apocynaceae',
    alseis: 'Rubiaceae'
  }
  return map[genus]
}

function uuid() {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function App() {
  const [position, setPosition] = useState<LatLng>(DEFAULT_POS)
  const [photos, setPhotos] = useState<{ url: string; name?: string }[]>([])
  const [commonName, setCommonName] = useState('')
  const [scientificName, setScientificName] = useState('')
  const [family, setFamily] = useState<string | undefined>(undefined)
  const [morph, setMorph] = useState<Morphology>({})
  const [saved, setSaved] = useState<TreeRecord[] | null>(null)
  const [firstPhotoISO, setFirstPhotoISO] = useState<string | undefined>(undefined)

  useEffect(() => {
    loadAll().then(setSaved)
  }, [])

  // família automática quando o usuário digita o nome científico
  useEffect(() => {
    if (scientificName.trim()) {
      const fam = guessFamily(scientificName)
      if (fam) setFamily(fam)
    }
  }, [scientificName])

  const recordId = useMemo(() => uuid(), [])

  async function handleFirstPhoto(file: File) {
    const url = URL.createObjectURL(file)
    setPhotos(p => (p.length ? [ { url, name: file.name }, ...p ] : [ { url, name: file.name } ]))

    // 1) tenta GPS via EXIF
    const gps = await extractGpsFromFile(file)
    if (gps) setPosition(gps)
    // 2) se não tiver, tenta geolocalização do aparelho
    else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }

    // tenta data/hora da foto
    const dt = await extractDateFromFile(file)
    if (dt) setFirstPhotoISO(dt.toISOString())
  }

  function handleMorePhotos(files: File[]) {
    const extras = files.map(f => ({ url: URL.createObjectURL(f), name: f.name }))
    setPhotos(p => [...p, ...extras])
  }

  async function saveRecord() {
    const now = new Date().toISOString()
    const rec: TreeRecord = {
      id: recordId,
      position,
      commonName: commonName || undefined,
      scientificName: scientificName || undefined,
      family: family || undefined,
      morphology: morph,
      photos,
      createdAt: firstPhotoISO ?? now,
      updatedAt: now
    }
    await saveOne(rec)
    const all = await loadAll()
    setSaved(all)
    alert('Registro salvo localmente!')
  }

  function exportJSON() {
    if (!saved) return
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tree-registry-${new Date().toISOString().slice(0,19)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function exportGeoJSON() {
    if (!saved) return
    const fc = {
      type: 'FeatureCollection',
      features: saved.map(r => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.position.lng, r.position.lat] },
        properties: {
          id: r.id,
          commonName: r.commonName,
          scientificName: r.scientificName,
          family: r.family,
          morphology: r.morphology,
          photos: r.photos?.map(p => p.url),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        }
      }))
    }
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tree-registry-${new Date().toISOString().slice(0,19)}.geojson`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="wrap">
      <h1>Registro de Árvore (foto → EXIF → mapa)</h1>

      <div className="card">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div>
            <label>Nome popular</label>
            <input value={commonName} onChange={e => setCommonName(e.target.value)} placeholder="ex.: Ipê-amarelo" />
          </div>
          <div>
            <label>Nome científico</label>
            <input
              value={scientificName}
              onChange={e => setScientificName(e.target.value)}
              placeholder="ex.: Handroanthus albus"
              autoCapitalize="none"
            />
          </div>
          <div>
            <label>Família (auto a partir do nome científico; editável)</label>
            <input value={family ?? ''} onChange={e => setFamily(e.target.value)} placeholder="ex.: Bignoniaceae" />
          </div>
        </div>
      </div>

      <PhotoPicker onFirstPhoto={handleFirstPhoto} onMorePhotos={handleMorePhotos} />

      <MapView center={position} onMoveMarker={setPosition} />

      <MorphologyForm value={morph} onChange={setMorph} />

      <div className="card">
        <label>Fotos do indivíduo</label>
        <div className="photos">
          {photos.length === 0 ? <div>Nenhuma foto adicionada.</div> : null}
          {photos.map((p, i) => (
            <img key={i} src={p.url} alt={p.name ?? `photo-${i}`} />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row">
          <button onClick={saveRecord}>Salvar registro</button>
          <button onClick={exportJSON}>Exportar JSON</button>
          <button onClick={exportGeoJSON}>Exportar GeoJSON</button>
          <button onClick={async () => { await wipeAll(); setSaved([]); }}>Apagar
</button>
