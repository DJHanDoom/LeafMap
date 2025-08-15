import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import PhotoPicker from './components/PhotoPicker'
import MorphologyForm from './components/MorphologyForm'
import Gallery from './components/Gallery'
import { extractGpsFromFile, extractDateFromFile } from './utils/exif'
import { loadAll, saveOne, wipeAll } from './storage'
import type { LatLng, Morphology, TreeRecord, LifeForm, PhotoRef } from './types'

const DEFAULT_POS: LatLng = { lat: -23.55052, lng: -46.633308 } // SP fallback

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

function Toast({ text }: { text: string }) {
  return (
    <div className="toast">
      {text}
    </div>
  )
}

type Mode = 'coleta' | 'registros'

export default function App() {
  const [mode, setMode] = useState<Mode>('coleta')

  // estado do formulário
  const [position, setPosition] = useState<LatLng>(DEFAULT_POS)
  const [photos, setPhotos] = useState<PhotoRef[]>([])
  const [commonName, setCommonName] = useState('')
  const [scientificName, setScientificName] = useState('')
  const [family, setFamily] = useState<string | undefined>(undefined)
  const [morph, setMorph] = useState<Morphology>({})
  const [firstPhotoISO, setFirstPhotoISO] = useState<string | undefined>(undefined)

  // registros salvos
  const [saved, setSaved] = useState<TreeRecord[] | null>(null)

  // UI
  const [toast, setToast] = useState<string | null>(null)

  // geolocalização inicial (default)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      )
      // atualização em “tempo quase-real”
      const watch = navigator.geolocation.watchPosition(
        p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      )
      return () => navigator.geolocation.clearWatch(watch)
    }
  }, [])

  useEffect(() => { loadAll().then(setSaved) }, [])

  useEffect(() => {
    if (scientificName.trim()) {
      const fam = guessFamily(scientificName)
      if (fam) setFamily(fam)
    }
  }, [scientificName])

  const recordId = useMemo(() => uuid(), [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  async function onCamera(file: File) {
    const url = URL.createObjectURL(file)
    setPhotos(p => [{ url, name: file.name, caption: 'hábito' }, ...p]) // primeira foto no topo
    showToast('📸 Foto capturada')

    // Posiciona o mapa pelo EXIF, se existir
    const gps = await extractGpsFromFile(file)
    if (gps) setPosition(gps)

    const dt = await extractDateFromFile(file)
    if (dt) setFirstPhotoISO(dt.toISOString())
  }

  function onGallery(files: File[]) {
    const extras = files.map(f => ({ url: URL.createObjectURL(f), name: f.name }))
    setPhotos(p => [...extras, ...p]) // também no topo
    showToast('🖼️ Foto(s) adicionada(s)')
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
    showToast('✅ Registro salvo')
  }

  function exportJSON() {
    if (!saved) return
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tree-registry-${new Date().toISOString().slice(0, 19)}.json`
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
          id: r.id, commonName: r.commonName, scientificName: r.scientificName, family: r.family,
          morphology: r.morphology, photos: r.photos?.map(p => p.url), createdAt: r.createdAt, updatedAt: r.updatedAt
        }
      }))
    }
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tree-registry-${new Date().toISOString().slice(0, 19)}.geojson`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ---- Tela REGISTROS ----
  const families = Array.from(new Set((saved ?? []).map(r => r.family).filter(Boolean))) as string[]
  const [highlightFamily, setHighlightFamily] = useState<string>('')

  return (
    <div className="wrap app-bg">
      {/* header com “logo passiflora” simples */}
      <div className="header">
        <div className="logo" aria-hidden>✿</div>
        <div className="title">LeafMap — Registro de Árvores</div>
        <div className="tabs">
          <button className={mode === 'coleta' ? 'tab active' : 'tab'} onClick={() => setMode('coleta')}>Coletar</button>
          <button className={mode === 'registros' ? 'tab active' : 'tab'} onClick={() => setMode('registros')}>Registros</button>
        </div>
      </div>

      {mode === 'coleta' ? (
        <>
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
                <label>Família (auto)</label>
                <input value={family ?? ''} onChange={e => setFamily(e.target.value)} placeholder="ex.: Bignoniaceae" />
              </div>
            </div>
          </div>

          <PhotoPicker onCamera={onCamera} onGallery={onGallery} />

          <MapView center={position} lifeForm={morph.formaVida as LifeForm} onMoveMarker={setPosition} />

          <MorphologyForm value={morph} onChange={setMorph} />

          <Gallery photos={photos} onChange={setPhotos} />

          <div className="card">
            <div className="row">
              <button onClick={saveRecord}>Salvar registro</button>
              <button onClick={exportJSON}>Exportar JSON</button>
              <button onClick={exportGeoJSON}>Exportar GeoJSON</button>
              <button
                onClick={async () => { await wipeAll(); setSaved([]) }}
                className="danger"
              >
                Apagar tudo
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Filtrar por família</label>
              <select value={highlightFamily} onChange={e => setHighlightFamily(e.target.value)}>
                <option value="">Todas</option>
                {families.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <button onClick={exportJSON}>Exportar JSON</button>
            </div>
          </div>

          {/* Mapa dos registros */}
          <div style={{ height: 360, borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
            {/* mapa simples com markers (sem react-leaflet aqui para não duplicar lógica):
                Reaproveitaremos MapView renderizando o centro do primeiro, e o usuário pode clicar para explorar */}
            <MapView
              center={(saved && saved[0]?.position) || position}
              lifeForm={undefined}
              onMoveMarker={() => {}}
            />
          </div>

          {/* Lista agrupada por família */}
          <div style={{ marginTop: 8 }}>
            {families.length === 0 ? <div>Sem registros ainda.</div> : null}
            {families
              .filter(f => (highlightFamily ? f === highlightFamily : true))
              .map(fam => {
                const group = (saved ?? []).filter(r => r.family === fam)
                return (
                  <div key={fam} className="group">
                    <h3>{fam} <small>({group.length})</small></h3>
                    <div className="group-list">
                      {group.map(r => (
                        <div key={r.id} className="group-item">
                          <div><b>{r.commonName ?? '—'}</b></div>
                          <div><i>{r.scientificName ?? '—'}</i></div>
                          <div style={{ fontSize: 12 }}>
                            {r.morphology?.formaVida ? `Forma de vida: ${r.morphology.formaVida}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {toast ? <Toast text={toast} /> : null}
    </div>
  )
}
