import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import PhotoPicker from './components/PhotoPicker'
import MorphologyForm from './components/MorphologyForm'
import Gallery from './components/Gallery'
import RecordsMap from './components/RecordsMap'
import { extractGpsFromFile, extractDateFromFile } from './utils/exif'
import { loadAll, saveOne, wipeAll } from './storage'
import type { LatLng, Morphology, TreeRecord, LifeForm, PhotoRef } from './types'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** Posição fallback */
const DEFAULT_POS: LatLng = { lat: -23.55052, lng: -46.633308 }

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
  const [zoomPhoto, setZoomPhoto] = useState<PhotoRef | null>(null)
  const [highlightFamily, setHighlightFamily] = useState<string>('')
  const [focusCoord, setFocusCoord] = useState<LatLng | null>(null)

  // export UI (apenas em REGISTROS)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportOpts, setExportOpts] = useState<{json:boolean; geojson:boolean; csv:boolean; gpx:boolean; xlsx:boolean}>({
    json: true, geojson: true, csv: false, gpx: false, xlsx: true
  })

  // taxonomia (gênero -> família)
  const [genus2family, setGenus2family] = useState<Record<string, string>>(SEED_GENUS2FAMILY)

  // carrega JSON público (mapeamentos)
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

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  // Confirmar 1ª foto (aplicar EXIF/GPS)
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

  // RESET para novo registro
  function resetForm() {
    setPhotos([])
    setFirstCandidate(null)
    setCommonName('')
    setScientificName('')
    setFamily(undefined)
    setMorph({})
    setFirstPhotoISO(undefined)
  }

  // Salvar cumulativo
  async function saveRecord() {
    const now = new Date().toISOString()
    const newId = uuid() // novo id a cada save (não substitui)
    const rec: TreeRecord = {
      id: newId,
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
    resetForm()               // zera UI para próximo
    setMode('registros')      // vai à aba de registros para visualização
    setFocusCoord(rec.position)
  }

  // ————————————— EXPORTS —————————————

  function buildJSON(all: TreeRecord[]) {
    // inclui um cabeçalho com análise e comentários
    const analysis = summarize(all)
    return JSON.stringify({
      meta: {
        app: 'NervuraColetora',
        exportedAt: new Date().toISOString(),
        total: all.length,
        analysis
      },
      records: all
    }, null, 2)
  }

  function buildGeoJSON(all: TreeRecord[]) {
    const fc = {
      type: 'FeatureCollection',
      features: all.map(r => ({
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
    return JSON.stringify(fc, null, 2)
  }

  function buildCSV(all: TreeRecord[]) {
    const head = ['id','lat','lng','commonName','scientificName','family','formaVida','cap_cm','altura_m','createdAt']
    const rows = all.map(r => [
      r.id, r.position.lat, r.position.lng,
      q(r.commonName), q(r.scientificName), q(r.family),
      r.morphology?.formaVida ?? '', r.morphology?.cap_cm ?? '', r.morphology?.altura_m ?? '',
      r.createdAt
    ].join(','))
    return [head.join(','), ...rows].join('\n')
    function q(v?: string){ return v ? `"${String(v).replace(/"/g,'""')}"` : '' }
  }

  function buildKML(all: TreeRecord[]) {
    const placemarks = all.map(r => `
      <Placemark>
        <name>${xml(r.commonName ?? r.scientificName ?? r.id)}</name>
        <description>${xml(r.family ?? '')}</description>
        <Point><coordinates>${r.position.lng},${r.position.lat},0</coordinates></Point>
      </Placemark>`).join('\n')
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks}</Document></kml>`.trim()
    function xml(s:string){ return s.replace(/[<&>]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m] as string)) }
  }

  function buildGPX(all: TreeRecord[]) {
    const wpts = all.map(r => `
  <wpt lat="${r.position.lat}" lon="${r.position.lng}">
    <name>${xml(r.commonName ?? r.scientificName ?? r.id)}</name>
    <time>${r.createdAt}</time>
  </wpt>`).join('\n')
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NervuraColetora" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
</gpx>`.trim()
    function xml(s:string){ return s.replace(/[<&>]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m] as string)) }
  }

  async function buildXLSXBlob(all: TreeRecord[]) {
    // @ts-ignore
    let XLSX: any
    try { XLSX = await import('xlsx/xlsx.mjs') } catch { XLSX = await import('xlsx') }
    const rows = all.map(r => ({
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
    return new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  async function exportNow() {
    if (!saved || saved.length === 0) { showToast('Nada para exportar'); return }
    const ts = new Date().toISOString().slice(0,19)
    const tasks: {name:string; mime:string; ext:string; builder:()=>Promise<Blob>|Blob}[] = []

    if (exportOpts.json)    tasks.push({ name:`nervura-${ts}.json`,    mime:'application/json',                      ext:'json',    builder:()=>new Blob([buildJSON(saved)],{type:'application/json'}) })
    if (exportOpts.geojson) tasks.push({ name:`nervura-${ts}.geojson`, mime:'application/geo+json',                  ext:'geojson', builder:()=>new Blob([buildGeoJSON(saved)],{type:'application/geo+json'}) })
    if (exportOpts.csv)     tasks.push({ name:`nervura-${ts}.csv`,     mime:'text/csv',                              ext:'csv',     builder:()=>new Blob([buildCSV(saved)],{type:'text/csv'}) })
    if (exportOpts.gpx)     tasks.push({ name:`nervura-${ts}.gpx`,     mime:'application/gpx+xml',                   ext:'gpx',     builder:()=>new Blob([buildGPX(saved)],{type:'application/gpx+xml'}) })
    if (exportOpts.xlsx)    tasks.push({ name:`nervura-${ts}.xlsx`,    mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext:'xlsx', builder:()=>buildXLSXBlob(saved) })

    const isNative = Capacitor.isNativePlatform?.() ?? false

    if (!isNative) {
      // navegador: baixa com <a>
      for (const t of tasks) {
        const blob = await t.builder()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = t.name
        a.click()
        URL.revokeObjectURL(a.href)
      }
      showToast('Arquivos exportados')
      setExportOpen(false)
      return
    }

    // Android (Capacitor): grava e abre Share
    const fileUris: string[] = []
    for (const t of tasks) {
      const blob = await t.builder()
      const arr = await blob.arrayBuffer()
      // salvar em CACHE para compartilhar
      await Filesystem.writeFile({
        path: t.name,
        data: b64fromArr(arr),
        directory: Directory.Cache,
        encoding: Encoding.BASE64
      })
      const uri = (await Filesystem.getUri({ path: t.name, directory: Directory.Cache })).uri
      fileUris.push(uri)
    }

    await Share.share({
      title: 'Exportar registros — NervuraColetora',
      text: `Exportados ${saved.length} registro(s) em ${tasks.map(t=>t.ext.toUpperCase()).join(', ')}`,
      files: fileUris,
      dialogTitle: 'Compartilhar exportações'
    })
    showToast('Exportações prontas para compartilhar')
    setExportOpen(false)
  }

  function b64fromArr(buf:ArrayBuffer){
    let binary = ''; const bytes = new Uint8Array(buf)
    const len = bytes.byteLength
    for (let i=0;i<len;i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

  // —————————— SHARE de um registro (fotos + texto) ——————————
  async function shareRecord(r: TreeRecord) {
    const isNative = Capacitor.isNativePlatform?.() ?? false
    const texto = [
      `Registro de planta — NervuraColetora`,
      r.commonName ? `Popular: ${r.commonName}` : null,
      r.scientificName ? `Científico: ${r.scientificName}` : null,
      r.family ? `Família: ${r.family}` : null,
      r.morphology?.formaVida ? `Forma de vida: ${r.morphology.formaVida}` : null,
      `Local: ${r.position.lat.toFixed(6)}, ${r.position.lng.toFixed(6)}`,
      `Data: ${r.createdAt}`
    ].filter(Boolean).join('\n')

    if (!isNative) {
      await navigator.clipboard?.writeText(texto)
      showToast('Texto de compartilhamento copiado (abra o Facebook e cole)')
      return
    }

    const files: string[] = []
    // baixar as fotos em cache para anexar
    for (let i=0; i<(r.photos?.length ?? 0); i++) {
      const p = r.photos![i]
      try {
        const blob = await fetch(p.url).then(res=>res.blob())
        const arr = await blob.arrayBuffer()
        const name = `registro-${r.id}-${i}.jpg`
        await Filesystem.writeFile({
          path: name,
          data: b64fromArr(arr),
          directory: Directory.Cache,
          encoding: Encoding.BASE64
        })
        const uri = (await Filesystem.getUri({ path: name, directory: Directory.Cache })).uri
        files.push(uri)
      } catch {}
    }

    await Share.share({
      title: r.commonName ?? r.scientificName ?? 'Registro de planta',
      text: texto,
      files,
      dialogTitle: 'Compartilhar registro'
    })
  }

  // análise simples
  function summarize(all: TreeRecord[]) {
    const byFam = new Map<string, number>(), byLife = new Map<string, number>()
    let capSum=0, capN=0, hSum=0, hN=0
    all.forEach(r => {
      if (r.family) byFam.set(r.family, (byFam.get(r.family) ?? 0)+1)
      const lf = r.morphology?.formaVida ?? ''
      if (lf) byLife.set(lf, (byLife.get(lf) ?? 0)+1)
      if (typeof r.morphology?.cap_cm === 'number') { capSum += r.morphology.cap_cm; capN++ }
      if (typeof r.morphology?.altura_m === 'number') { hSum += r.morphology.altura_m; hN++ }
    })
    const sort = (m:Map<string,number>) => Array.from(m.entries()).sort((a,b)=>b[1]-a[1])
    return {
      porFamilia: sort(byFam).map(([f,n])=>({familia:f, n})),
      porFormaDeVida: sort(byLife).map(([f,n])=>({formaDeVida:f, n})),
      mediaCAP_cm: capN? Number((capSum/capN).toFixed(1)) : null,
      mediaAltura_m: hN? Number((hSum/hN).toFixed(1)) : null,
      comentario: "Dados agregados automaticamente pelo aplicativo no momento da exportação."
    }
  }

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
          {/* Morfologia visível na coleta */}
          <MorphologyForm value={morph} onChange={setMorph} />
          <Gallery photos={photos} onChange={setPhotos} />
          
          <div className="card">
            <div className="row">
              <button onClick={saveRecord}>Salvar registro</button>
              <button className="danger" onClick={async () => { await wipeAll(); setSaved([]); showToast('Tudo apagado') }}>Apagar tudo</button>
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

            {/* Botão único de Exportar (abre seletor) */}
            <div className="row" style={{ gap: 6 }}>
              <button onClick={()=>setExportOpen(v=>!v)}>Exportar ▾</button>
            </div>
          </div>

          {/* Painel de opções de exportação */}
          {exportOpen ? (
            <div className="card" style={{ marginTop: 8 }}>
              <div className="row" style={{ flexWrap:'wrap', gap: 16 }}>
                {[
                  ['json','JSON'], ['geojson','GeoJSON'], ['csv','CSV'], ['gpx','GPX'], ['xlsx','XLSX']
                ].map(([k,label]) => (
                  <label key={k} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input
                      type="checkbox"
                      checked={(exportOpts as any)[k]}
                      onChange={()=>setExportOpts(o=>({ ...o, [k]: !(o as any)[k] }))}
                    />
                    {label}
                  </label>
                ))}
                <span style={{ flex:1 }} />
                <button className="gold" onClick={exportNow}>Gerar e compartilhar</button>
              </div>
            </div>
          ) : null}

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
            {saved && saved.length ? (
              <>
                <div>Registros: {saved.length}</div>
                <div>Por família: {
                  summarize(saved).porFamilia.map(x => `${x.familia} (${x.n})`).join(' · ')
                }</div>
                <div>Por forma de vida: {
                  summarize(saved).porFormaDeVida.map(x => `${x.formaDeVida} (${x.n})`).join(' · ')
                }</div>
                <div>Média CAP: {
                  summarize(saved).mediaCAP_cm ?? '—'
                } cm · Média altura: {
                  summarize(saved).mediaAltura_m ?? '—'
                } m</div>
              </>
            ) : <div>—</div>}
          </div>
        </div>
      )}

      {/* Modal de registro com possibilidade de ampliar fotos e compartilhar */}
      {recordModal ? (
        <div className="modal" onClick={() => setRecordModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <div>
                <div><b>{recordModal.commonName ?? '—'}</b></div>
                <div><i>{recordModal.scientificName ?? '—'}</i></div>
                {recordModal.family ? <div>Família: {recordModal.family}</div> : null}
                {recordModal.morphology?.formaVida ? <div>Forma de vida: {recordModal.morphology.formaVida}</div> : null}
                <div>Local: {recordModal.position.lat.toFixed(6)}, {recordModal.position.lng.toFixed(6)}</div>
                <div>Data: {recordModal.createdAt}</div>
              </div>
              <div className="row" style={{ gap:8 }}>
                <button onClick={() => shareRecord(recordModal!)}>Compartilhar</button>
                <button onClick={() => setRecordModal(null)}>Fechar</button>
              </div>
            </div>
            <div className="thumbs" style={{ marginTop: 8 }}>
              {recordModal.photos?.map((p,i) => (
                <div key={i} className="thumb">
                  <img
                    src={p.url}
                    alt={p.name ?? `photo-${i}`}
                    onClick={()=>setZoomPhoto(p)}
                    title="Toque para ampliar"
                  />
                  {p.caption ? <small style={{opacity:.75}}>{p.caption}</small> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Zoom de foto (qualquer origem) */}
      {zoomPhoto ? (
        <div className="modal" onClick={() => setZoomPhoto(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <img src={zoomPhoto.url} style={{ maxWidth: '100%', maxHeight: '80vh' }} />
            <div className="row" style={{ justifyContent:'flex-end', marginTop: 8 }}>
              <button onClick={() => setZoomPhoto(null)}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast text={toast} /> : null}
    </div>
  )
}
