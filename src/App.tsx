import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import PhotoPicker from './components/PhotoPicker'
import MorphologyForm from './components/MorphologyForm'
import Gallery from './components/Gallery'
import RecordsMap from './components/RecordsMap'
import { extractGpsFromFile, extractDateFromFile } from './utils/exif'
import { loadAll, saveOne, wipeAll } from './storage'
import type { LatLng, Morphology, TreeRecord, LifeForm, PhotoRef } from './types'

const DEFAULT_POS: LatLng = { lat: -23.55052, lng: -46.633308 } // fallback

/** Seed local (fallback). O arquivo /genus2family.json amplia a cobertura em runtime. */
const SEED_GENUS2FAMILY: Record<string, string> = {
  // Myrtaceae
  eugenia: 'Myrtaceae', psidium: 'Myrtaceae', myrcia: 'Myrtaceae', myrciaria: 'Myrtaceae',
  calyptranthes: 'Myrtaceae', campomanesia: 'Myrtaceae', syzygium: 'Myrtaceae', plinia: 'Myrtaceae',
  // Fabaceae
  inga: 'Fabaceae', swartzia: 'Fabaceae', machaerium: 'Fabaceae', dalbergia: 'Fabaceae', copaifera: 'Fabaceae',
  hymenaea: 'Fabaceae', senna: 'Fabaceae', andira: 'Fabaceae',
  // Bignoniaceae
  handroanthus: 'Bignoniaceae', tabebuia: 'Bignoniaceae', jacaranda: 'Bignoniaceae',
  // Lauraceae
  ocotea: 'Lauraceae', nectandra: 'Lauraceae', persea: 'Lauraceae', cinnamomum: 'Lauraceae', aniba: 'Lauraceae',
  // Apocynaceae
  aspidosperma: 'Apocynaceae', himatanthus: 'Apocynaceae',
  // Anacardiaceae
  schinus: 'Anacardiaceae', astronium: 'Anacardiaceae', anacardium: 'Anacardiaceae',
  // Urticaceae / Moraceae
  cecropia: 'Urticaceae', pourouma: 'Urticaceae', ficus: 'Moraceae'
}

const uuid = () =>
  'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)

type Mode = 'coleta' | 'registros'
const Toast = ({ text }: { text: string }) => <div className="toast">{text}</div>

const Brand = () => (
  <div className="brand">
    {/* Mostra /brand.png; coloque sua arte em public/brand.png */}
    <img src="/brand.png" alt="brand" width={32} height={32} />
  </div>
)

export default function App() {
  const [mode, setMode] = useState<Mode>('coleta')

  // coleta
  const [position, setPosition] = useState<LatLng>(DEFAULT_POS)
  const [photos, setPhotos] = useState<PhotoRef[]>([])
  const [firstCandidate, setFirstCandidate] = useState<{ url: string; file: File } | null>(null)
  const [commonName, setCommonName] = useState('')
  const [scientificName, setScientificName] = useState('')
  const [family, setFamily] = useState<string | undefined>(undefined)
  const [morph, setMorph] = useState<Morphology>({})
  const [firstPhotoISO, setFirstPhotoISO] = useState<string | undefined>(undefined)

  // registros
  const [saved, setSaved] = useState<TreeRecord[] | null>(null)

  // UI
  const [toast, setToast] = useState<string | null>(null)
  const [recordModal, setRecordModal] = useState<TreeRecord | null>(null)
  const [highlightFamily, setHighlightFamily] = useState<string>('')
  const [focusCoord, setFocusCoord] = useState<LatLng | null>(null)

  // taxonomia (gênero -> família)
  const [genus2family, setGenus2family] = useState<Record<string, string>>(SEED_GENUS2FAMILY)

  // carrega JSON público (amplia a base de mapeamento)
  useEffect(() => {
    fetch('/genus2family.json', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((remote: Record<string, string> | null) => {
        if (!remote) return
        const norm: Record<string, string> = {}
        for (const k of Object.keys(remote)) norm[k.trim().toLowerCase()] = remote[k]
        setGenus2family(prev => ({ ...prev, ...norm }))
      })
      .catch(() => {})
  }, [])

  // geolocalização inicial + watch
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    )
    const watch = navigator.geolocation.watchPosition(
      p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [])

  useEffect(() => { loadAll().then(setSaved) }, [])

  function predictFamily(scientific?: string) {
    if (!scientific) return undefined
    const genus = scientific.trim().split(/\s+/)[0]?.toLowerCase()
    if (!genus) return undefined
    return genus2family[genus]
  }

  useEffect(() => {
    const fam = predictFamily(scientificName)
    if (fam) setFamily(fam)
  }, [scientificName, genus2family])

  const recordId = useMemo(() => uuid(), [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  // —— Confirmar 1ª foto para aplicar EXIF no mapa ——
  async function confirmFirstPhoto() {
    if (!firstCandidate) return
    const { file, url } = firstCandidate
    setPhotos(p => [{ url, name: file.name, caption: 'hábito' }, ...p])
    const gps = await extractGpsFromFile(file)
    if (gps) setPosition(gps)
    const dt = await extractDateFromFile(file)
    if (dt) setFirstPhotoISO(dt.toISOString())
    setFirstCandidate(null)
    showToast('📍 Posição atualizada pela foto (EXIF)')
  }

  async function onCamera(file: File) {
    const url = URL.createObjectURL(file)
    setFirstCandidate({ url, file })
    showToast('📸 Foto capturada — confirme para definir a posição')
  }

  function onGallery(fs: File[]) {
    if (!photos.length && !firstCandidate && fs.length > 0) {
      const [primeira, ...resto] = fs
      const url = URL.createObjectURL(primeira)
      setFirstCandidate({ url, file: primeira })
      if (resto.length) {
        const extras = resto.map(f => ({ url: URL.createObjectURL(f), name: f.name }))
        setPhotos(p => [...extras, ...p])
      }
      showToast('🖼️ Selecione “Confirmar 1ª foto” para aplicar EXIF/GPS')
    } else {
      const extras = fs.map(f => ({ url: URL.createObjectURL(f), name: f.name }))
      setPhotos(p => [...extras, ...p])
      showToast('🖼️ Foto(s) adicionada(s)')
    }
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

  // —— Exportações ——
  function exportJSON() {
    if (!saved) return
    downloadText('application/json', 'json', JSON.stringify(saved, null, 2))
  }

  function exportGeoJSON() {
    if (!saved) return
    const fc = {
      type: 'FeatureCollection',
      features: (saved).map(r => ({
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
    downloadText('application/geo+json', 'geojson', JSON.stringify(fc, null, 2))
  }

  function exportCSV() {
    if (!saved) return
    const head = ['id','lat','lng','commonName','scientificName','family','formaVida','cap_cm','altura_m','createdAt']
    const rows = saved.map(r => [
      r.id, r.position.lat, r.position.lng,
      q(r.commonName), q(r.scientificName), q(r.family),
      r.morphology?.formaVida ?? '', r.morphology?.cap_cm ?? '', r.morphology?.altura_m ?? '',
      r.createdAt
    ].join(','))
    downloadText('text/csv', 'csv', [head.join(','), ...rows].join('\n'))
    function q(v?: string){ return v ? `"${String(v).replace(/"/g,'""')}"` : '' }
  }

  function exportKML() {
    if (!saved) return
    const placemarks = (saved).map(r => `
      <Placemark>
        <name>${xml(r.commonName ?? r.scientificName ?? r.id)}</name>
        <description>${xml(r.family ?? '')}</description>
        <Point><coordinates>${r.position.lng},${r.position.lat},0</coordinates></Point>
      </Placemark>`).join('\n')
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks}</Document></kml>`
    downloadText('application/vnd.google-earth.kml+xml', 'kml', kml.trim())
    function xml(s:string){ return s.replace(/[<&>]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m] as string)) }
  }

  function exportGPX() {
    if (!saved) return
    const wpts = (saved).map(r => `
    <wpt lat="${r.position.lat}" lon="${r.position.lng}">
      <name>${xml(r.commonName ?? r.scientificName ?? r.id)}</name>
      <time>${r.createdAt}</time>
    </wpt>`).join('\n')
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NervuraColetora" xmlns="http://www.topografix.com/GPX/1/1">
  ${wpts}
</gpx>`
    downloadText('application/gpx+xml', 'gpx', gpx.trim())
    function xml(s:string){ return s.replace(/[<&>]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m] as string)) }
  }

  // ⬇️ CORRIGIDO: usa build ESM do SheetJS (xlsx) para evitar erro de resolução do Vite/Rollup
  async function exportXLSX() {
  if (!saved) return
  try {
    // build ESM do SheetJS — caminho correto nesta versão
    // @ts-ignore (tipos via shim em src/types/xlsx-mjs.d.ts)
    const XLSX = await import('xlsx/xlsx.mjs')
    const rows = saved.map(r => ({
      id:r.id, lat:r.position.lat, lng:r.position.lng,
      commonName:r.commonName ?? '', scientificName:r.scientificName ?? '',
      family:r.family ?? '', formaVida:r.morphology?.formaVida ?? '',
      cap_cm:r.morphology?.cap_cm ?? '', altura_m:r.morphology?.altura_m ?? '',
      createdAt:r.createdAt
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Registros')
    const out = XLSX.write(wb, { bookType:'xlsx', type:'array' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    a.download = `nervura-${new Date().toISOString().slice(0,19)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (err) {
    try {
      // fallback: deixar Vite resolver a entrada padrão
      // @ts-ignore
      const XLSX = await import('xlsx')
      const rows = saved.map(r => ({
        id:r.id, lat:r.position.lat, lng:r.position.lng,
        commonName:r.commonName ?? '', scientificName:r.scientificName ?? '',
        family:r.family ?? '', formaVida:r.morphology?.formaVida ?? '',
        cap_cm:r.morphology?.cap_cm ?? '', altura_m:r.morphology?.altura_m ?? '',
        createdAt:r.createdAt
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Registros')
      const out = XLSX.write(wb, { bookType:'xlsx', type:'array' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = `nervura-${new Date().toISOString().slice(0,19)}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      // se ainda assim falhar, cai para CSV
      exportCSV()
    }
  }
}

  function downloadText(mime: string, ext: string, txt: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt], { type: mime }))
    a.download = `nervura-${new Date().toISOString().slice(0,19)}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // análise simples
  const analysis = (() => {
    const byFam = new Map<string, number>(), byLife = new Map<string, number>()
    let capSum=0, capN=0, hSum=0, hN=0
    ;(saved ?? []).forEach(r => {
      if (r.family) byFam.set(r.family, (byFam.get(r.family) ?? 0)+1)
      const lf = r.morphology?.formaVida ?? ''
      if (lf) byLife.set(lf, (byLife.get(lf) ?? 0)+1)
      if (typeof r.morphology?.cap_cm === 'number') { capSum += r.morphology.cap_cm; capN++ }
      if (typeof r.morphology?.altura_m === 'number') { hSum += r.morphology.altura_m; hN++ }
    })
    const sort = (m:Map<string,number>) => Array.from(m.entries()).sort((a,b)=>b[1]-a[1])
    return { byFam: sort(byFam), byLife: sort(byLife), capAvg: capN? capSum/capN : null, hAvg: hN? hSum/hN : null }
  })()

  return (
    <div className="wrap app-bg">
      <div className="header">
        <Brand />
        <div className="title">NervuraColetora</div>
        <div className="tabs">
          <button className={mode==='coleta'?'tab active':'tab'} onClick={()=>setMode('coleta')}>Coletar</button>
          <button className={mode==='registros'?'tab active':'tab'} onClick={()=>setMode('registros')}>Registros</button>
        </div>
      </div>

      {mode === 'coleta' ? (
        <>
          {firstCandidate ? (
            <div className="card gold">
              <label>Confirmar 1ª foto do registro</label>
              <div className="row">
                <img src={firstCandidate.url} style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8 }} />
                <button className="gold" onClick={confirmFirstPhoto}>Confirmar 1ª foto (aplicar EXIF/GPS)</button>
                <button className="secondary" onClick={()=>setFirstCandidate(null)}>Descartar</button>
              </div>
              <small>Ao confirmar, a posição do mapa será atualizada pelo EXIF, se disponível.</small>
            </div>
          ) : null}

          <div className="card">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <div>
                <label>Nome popular</label>
                <input value={commonName} onChange={e => setCommonName(e.target.value)} placeholder="ex.: Ipê-amarelo" />
              </div>
              <div>
                <label>Nome científico</label>
                <input value={scientificName} onChange={e => setScientificName(e.target.value)} placeholder="ex.: Handroanthus albus" autoCapitalize="none" />
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
              <button onClick={exportCSV}>Exportar CSV</button>
              <button onClick={exportGPX}>Exportar GPX</button>
              <button onClick={exportXLSX}>Exportar XLSX</button>
              <button className="danger" onClick={async () => { await wipeAll(); setSaved([]) }}>Apagar tudo</button>
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
                {Array.from(new Set((saved ?? []).map(r => r.family).filter(Boolean))).map(f => <option key={f as string} value={f as string}>{f as string}</option>)}
              </select>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button onClick={exportJSON}>JSON</button>
              <button onClick={exportGeoJSON}>GeoJSON</button>
              <button onClick={exportCSV}>CSV</button>
              <button onClick={exportGPX}>GPX</button>
              <button onClick={exportXLSX}>XLSX</button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <RecordsMap
              records={(saved ?? []).filter(r => (highlightFamily ? r.family === highlightFamily : true))}
              center={(saved && saved[0]?.position) || position}
              onOpenRecord={r => { setRecordModal(r); setFocusCoord(r.position) }}
              focus={focusCoord}
            />
          </div>

          <div className="card" style={{ marginTop: 8 }}>
            <label>Análise rápida</label>
            <div>Por família: {analysis.byFam.map(([f,n]) => `${f} (${n})`).join(' · ') || '—'}</div>
            <div>Por forma de vida: {analysis.byLife.map(([f,n]) => `${f} (${n})`).join(' · ') || '—'}</div>
            <div>Média CAP: {analysis.capAvg ? analysis.capAvg.toFixed(1)+' cm' : '—'} · Média altura: {analysis.hAvg ? analysis.hAvg.toFixed(1)+' m' : '—'}</div>
          </div>
        </div>
      )}

      {recordModal ? (
        <div className="modal" onClick={() => setRecordModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <div>
                <div><b>{recordModal.commonName ?? '—'}</b></div>
                <div><i>{recordModal.scientificName ?? '—'}</i></div>
                {recordModal.family ? <div>Família: {recordModal.family}</div> : null}
                {recordModal.morphology?.formaVida ? <div>Forma de vida: {recordModal.morphology.formaVida}</div> : null}
              </div>
              <button onClick={() => setRecordModal(null)}>Fechar</button>
            </div>
            <div className="thumbs" style={{ marginTop: 8 }}>
              {recordModal.photos?.map((p,i) => (
                <div key={i} className="thumb"><img src={p.url} alt={p.name ?? `photo-${i}`} />{p.caption ? <small style={{opacity:.75}}>{p.caption}</small> : null}</div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast text={toast} /> : null}
    </div>
  )
}
