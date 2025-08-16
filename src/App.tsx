import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import RecordsMap from './components/RecordsMap'
import PhotoPicker from './components/PhotoPicker'
import MorphologyForm from './components/MorphologyForm'
import Gallery from './components/Gallery'
import { extractGpsFromFile, extractDateFromFile } from './utils/exif'
import { loadAll, saveOne, wipeAll } from './storage'
import type { LatLng, LifeForm, Morphology, PhotoRef, TreeRecord } from './types'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Geolocation } from '@capacitor/geolocation'
import './theme.css'

/** UFRRJ (fallback se GPS negado) */
const UFRRJ: LatLng = { lat: -22.745, lng: -43.701 }
/** Se GPS concedido mas indisponível, um centro genérico do Brasil */
const BR_CENTER: LatLng = { lat: -15.78, lng: -47.93 }

const uuid = () =>
  'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)

type Mode = 'coleta' | 'registros'

const Brand = () => (
  <div className="brand">
    <img src="/brand.png" alt="brand" width={28} height={28} />
    <span>NervuraColetora</span>
  </div>
)

const Section = ({ title, children }: { title: string; children: any }) => (
  <section className="card">
    <h3>{title}</h3>
    {children}
  </section>
)

const Toast = ({ text }: { text: string }) => <div className="toast">{text}</div>

export default function App() {
  const [mode, setMode] = useState<Mode>('coleta')

  // Coleta
  const [center, setCenter] = useState<LatLng>(BR_CENTER)
  const [marker, setMarker] = useState<LatLng | null>(null)
  const [photos, setPhotos] = useState<PhotoRef[]>([])
  const [firstCandidate, setFirstCandidate] = useState<{ url: string; file: File } | null>(null)

  const [commonName, setCommon] = useState('')
  const [scientificName, setScientific] = useState('')
  const [family, setFamily] = useState('')
  const [morph, setMorph] = useState<Morphology>({})
  const [firstISO, setFirstISO] = useState<string | undefined>(undefined)

  // Registros
  const [all, setAll] = useState<TreeRecord[]>([])
  const [filterFamily, setFilterFamily] = useState<string>('')
  const [focus, setFocus] = useState<LatLng | null>(null)
  const [openRecord, setOpenRecord] = useState<TreeRecord | null>(null)

  // Export UI
  const [exportOpen, setExportOpen] = useState(false)
  const [exportSel, setExportSel] = useState({ json: true, geojson: true, csv: false, gpx: false, xlsx: true })

  // UI util
  const [toast, setToast] = useState<string | null>(null)
  const isNative = useMemo(() => (Capacitor.getPlatform?.() ?? 'web') !== 'web', [])

  /** ————— GPS: 1ª execução pede permissão; se negar, UFRRJ; senão, centra e dá watch ————— */
  useEffect(() => {
    (async () => {
      try {
        const asked = localStorage.getItem('geoAsked')
        if (!asked) {
          await Geolocation.requestPermissions()
          localStorage.setItem('geoAsked', '1')
        }
        const current = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 6000 })
        const here = { lat: current.coords.latitude, lng: current.coords.longitude }
        setCenter(here); setMarker(here)
      } catch {
        // fallback UFRRJ
        setCenter(UFRRJ); setMarker(UFRRJ)
      }
      // watch
      try {
        const id = await Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 5000 }, pos => {
          if (pos && pos.coords) {
            const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            setCenter(prev => prev ?? here)
          }
        })
        // Capacitor 6 retorna string / number; ignorar unwatch no webview
        void id
      } catch {}
    })()
  }, [])

  /** Carrega registros */
  useEffect(() => {
    loadAll().then(r => setAll(r ?? []))
  }, [])

  /** Inputs não “sumirem” com o teclado */
  function bringIntoView(e: React.FocusEvent<HTMLElement>) {
    try { e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}
  }

  /** 1ª foto => aplica EXIF, sem abrir zoom */
  async function confirmFirstPhoto() {
    if (!firstCandidate) return
    const { file, url } = firstCandidate
    setPhotos(p => [{ url, name: file.name, caption: 'hábito' }, ...p])
    const gps = await extractGpsFromFile(file)
    if (gps) { setCenter(gps); setMarker(gps) }
    const dt = await extractDateFromFile(file)
    if (dt) setFirstISO(dt.toISOString())
    setFirstCandidate(null)
    toastMsg('📍 Posição atualizada (EXIF)')
  }

  function onGallery(files: File[]) {
    if (!files?.length) return
    // se ainda não há 1ª foto confirmada, considere a 1ª como candidata
    if (!photos.length && !firstCandidate) {
      const [first, ...rest] = files
      setFirstCandidate({ url: URL.createObjectURL(first), file: first })
      if (rest.length) {
        const extras = rest.map(f => ({ url: URL.createObjectURL(f), name: f.name }))
        setPhotos(prev => [...extras, ...prev])
      }
    } else {
      const extras = files.map(f => ({ url: URL.createObjectURL(f), name: f.name }))
      setPhotos(prev => [...extras, ...prev])
    }
    toastMsg('🖼️ Foto(s) adicionada(s)')
  }

  async function onCamera(file: File) {
    setFirstCandidate({ url: URL.createObjectURL(file), file })
    toastMsg('📸 Confirme para aplicar EXIF/GPS')
  }

  function toastMsg(t: string) { setToast(t); setTimeout(() => setToast(null), 1800) }

  /** Reset da coleta */
  function resetForm() {
    setPhotos([]); setFirstCandidate(null)
    setCommon(''); setScientific(''); setFamily(''); setMorph({})
    setFirstISO(undefined)
  }

  /** Salvar (cumulativo) + ir para Registros e focar o novo pin */
  async function saveRecord() {
    const pos = marker ?? center
    const now = new Date().toISOString()
    const rec: TreeRecord = {
      id: uuid(),
      position: pos,
      commonName: commonName || undefined,
      scientificName: scientificName || undefined,
      family: family || undefined,
      morphology: morph,
      photos,
      createdAt: firstISO ?? now,
      updatedAt: now
    }
    await saveOne(rec)
    const allNow = await loadAll()
    setAll(allNow)
    resetForm()
    setMode('registros')
    setFocus(rec.position)
    toastMsg('✅ Registro salvo')
  }

  /** ———————— EXPORT (dados) ———————— */
  function scopeRecords(): TreeRecord[] {
    const subset = filterFamily ? all.filter(r => r.family === filterFamily) : all
    return subset
  }

  function makeJSON(rs: TreeRecord[]) {
    return JSON.stringify({
      meta: { app: 'NervuraColetora', exportedAt: new Date().toISOString(), total: rs.length },
      analysis: summarize(rs),
      records: rs
    }, null, 2)
  }

  function makeGeoJSON(rs: TreeRecord[]) {
    const fc = {
      type: 'FeatureCollection',
      features: rs.map(r => ({
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

  function makeCSV(rs: TreeRecord[]) {
    const head = ['id','lat','lng','commonName','scientificName','family','formaVida','cap_cm','altura_m','createdAt']
    const rows = rs.map(r => [
      r.id, r.position.lat, r.position.lng,
      q(r.commonName), q(r.scientificName), q(r.family),
      r.morphology?.formaVida ?? '', r.morphology?.cap_cm ?? '', r.morphology?.altura_m ?? '',
      r.createdAt
    ].join(','))
    return [head.join(','), ...rows].join('\n')
    function q(v?: string){ return v ? `"${String(v).replace(/"/g,'""')}"` : '' }
  }

  function makeGPX(rs: TreeRecord[]) {
    const wpts = rs.map(r => `
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

  async function makeXLSXBlob(rs: TreeRecord[]) {
    // @ts-ignore
    let XLSX: any
    try { XLSX = await import('xlsx/xlsx.mjs') } catch { XLSX = await import('xlsx') }
    const rows = rs.map(r => ({
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

  async function doExport() {
    const rs = scopeRecords()
    if (!rs.length) { toastMsg('Nada para exportar'); return }
    const ts = new Date().toISOString().slice(0,19)
    const tasks: {name:string; mime:string; blob: Promise<Blob>}[] = []
    if (exportSel.json)    tasks.push({ name:`nervura-${ts}.json`,    mime:'application/json',                      blob: Promise.resolve(new Blob([makeJSON(rs)],{type:'application/json'})) })
    if (exportSel.geojson) tasks.push({ name:`nervura-${ts}.geojson`, mime:'application/geo+json',                  blob: Promise.resolve(new Blob([makeGeoJSON(rs)],{type:'application/geo+json'})) })
    if (exportSel.csv)     tasks.push({ name:`nervura-${ts}.csv`,     mime:'text/csv',                              blob: Promise.resolve(new Blob([makeCSV(rs)],{type:'text/csv'})) })
    if (exportSel.gpx)     tasks.push({ name:`nervura-${ts}.gpx`,     mime:'application/gpx+xml',                   blob: Promise.resolve(new Blob([makeGPX(rs)],{type:'application/gpx+xml'})) })
    if (exportSel.xlsx)    tasks.push({ name:`nervura-${ts}.xlsx`,    mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', blob: makeXLSXBlob(rs) })

    if (!isNative) {
      // web: baixa
      for (const t of tasks) {
        const b = await t.blob
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = t.name
        a.click(); URL.revokeObjectURL(a.href)
      }
      setExportOpen(false); toastMsg('Exportado')
      return
    }

    // Android: grava e compartilha
    const fileUris: string[] = []
    for (const t of tasks) {
      const b = await t.blob
      const arr = await b.arrayBuffer()
      await Filesystem.writeFile({
        path: t.name,
        data: b64(arr),
        directory: Directory.Cache,
        encoding: Encoding.BASE64
      })
      const uri = (await Filesystem.getUri({ path: t.name, directory: Directory.Cache })).uri
      fileUris.push(uri)
    }

    try {
      await Share.share({
        title: 'Exportar dados — NervuraColetora',
        text: `Exportados ${rs.length} registro(s).`,
        files: fileUris,
        dialogTitle: 'Compartilhar exportações'
      })
      toastMsg('Exportado')
    } catch {
      toastMsg('Compartilhamento não disponível')
    }
    setExportOpen(false)
  }

  function b64(buf:ArrayBuffer){ let s=''; const b=new Uint8Array(buf); for (let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s) }

  /** ———————— Compartilhar 1 registro (texto + fotos) ———————— */
  async function shareRecord(r: TreeRecord) {
    const texto = [
      'Registro botânico — NervuraColetora',
      r.commonName ? `Nome popular: ${r.commonName}` : null,
      r.scientificName ? `Nome científico: ${r.scientificName}` : null,
      r.family ? `Família: ${r.family}` : null,
      r.morphology?.formaVida ? `Forma de vida: ${r.morphology.formaVida}` : null,
      r.createdAt ? `Data: ${r.createdAt}` : null,
      `Local: ${r.position.lat.toFixed(6)}, ${r.position.lng.toFixed(6)}`,
      r.morphology ? `Notas morfológicas: ${summMorph(r.morphology)}` : null
    ].filter(Boolean).join('\n')

    if (!isNative) {
      await navigator.clipboard?.writeText(texto)
      toastMsg('Texto copiado — cole no Facebook')
      return
    }
    const files: string[] = []
    for (let i=0; i<(r.photos?.length ?? 0); i++) {
      const p = r.photos![i]
      try {
        const blob = await fetch(p.url).then(x=>x.blob())
        const buf = await blob.arrayBuffer()
        const name = `registro-${r.id}-${i}.jpg`
        await Filesystem.writeFile({ path:name, data:b64(buf), directory: Directory.Cache, encoding: Encoding.BASE64 })
        const uri = (await Filesystem.getUri({ path:name, directory: Directory.Cache })).uri
        files.push(uri)
      } catch {}
    }
    try {
      await Share.share({
        title: r.commonName ?? r.scientificName ?? 'Registro botânico',
        text: texto,
        files,
        dialogTitle: 'Compartilhar registro'
      })
    } catch {}
  }

  function summMorph(m: Morphology) {
    const parts: string[] = []
    if (m.formaVida) parts.push(`Forma de vida: ${m.formaVida}`)
    if (m.folha__tipo) parts.push(`Folha: ${m.folha__tipo}`)
    if (m.folha__margem) parts.push(`Margem: ${m.folha__margem}`)
    if (m.folha__filotaxia) parts.push(`Filotaxia: ${m.folha__filotaxia}`)
    if (m.folha__nervacao) parts.push(`Nervação: ${m.folha__nervacao}`)
    if (m.estipulas) parts.push(`Estípulas: ${m.estipulas}`)
    if (m.indumento) parts.push(`Indumento: ${m.indumento}`)
    if (m.casca) parts.push(`Casca: ${m.casca}`)
    if (typeof m.cap_cm === 'number') parts.push(`CAP: ${m.cap_cm} cm`)
    if (typeof m.altura_m === 'number') parts.push(`Altura: ${m.altura_m} m`)
    if (m.obs) parts.push(`Obs: ${m.obs}`)
    return parts.join(' · ')
  }

  /** Análise simples */
  function summarize(rs: TreeRecord[]) {
    const byFam = new Map<string, number>(), byLife = new Map<string, number>()
    rs.forEach(r => {
      if (r.family) byFam.set(r.family, (byFam.get(r.family) ?? 0)+1)
      const lf = r.morphology?.formaVida; if (lf) byLife.set(lf, (byLife.get(lf) ?? 0)+1)
    })
    const enr = (m:Map<string,number>) => Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).map(([k,n])=>({k,n}))
    return { porFamilia: enr(byFam), porFormaDeVida: enr(byLife) }
  }

  // ———————— UI ————————
  return (
    <div className="app-root">
      <header className="app-header">
        <Brand />
        <div className="tabs">
          <button className={mode==='coleta'?'tab active':'tab'} onClick={()=>setMode('coleta')}>Coletar</button>
          <button className={mode==='registros'?'tab active':'tab'} onClick={()=>setMode('registros')}>Registros</button>
        </div>
      </header>

      {mode === 'coleta' ? (
        <main className="content">
          {/* fotos */}
          <Section title="Fotos">
            <div className="row">
              <PhotoPicker onCamera={onCamera} onGallery={onGallery} />
            </div>
            <small className="hint">Dica: use a câmera para capturar EXIF/GPS quando disponível.</small>

            {firstCandidate && (
              <div className="confirm-first">
                <img src={firstCandidate.url} className="thumb-first" />
                <div className="row">
                  <button className="btn gold" onClick={confirmFirstPhoto}>Confirmar 1ª foto (aplicar EXIF/GPS)</button>
                  <button className="btn ghost" onClick={()=>setFirstCandidate(null)}>Descartar</button>
                </div>
              </div>
            )}
          </Section>

          {/* identificação */}
          <Section title="Identificação">
            <div className="form-grid">
              <div className="form-field">
                <label>Nome popular</label>
                <input value={commonName} onChange={e=>setCommon(e.target.value)} onFocus={bringIntoView}
                       placeholder="ex.: Ipê-amarelo" />
              </div>
              <div className="form-field">
                <label>Nome científico</label>
                <input value={scientificName} onChange={e=>setScientific(e.target.value)} onFocus={bringIntoView}
                       placeholder="ex.: Handroanthus albus" autoCapitalize="none" />
              </div>
              <div className="form-field">
                <label>Família (auto)</label>
                <input value={family} onChange={e=>setFamily(e.target.value)} onFocus={bringIntoView}
                       placeholder="ex.: Bignoniaceae" />
              </div>
            </div>
          </Section>

          {/* mapa coleta */}
          <Section title="Posição no mapa (toque para mover / arraste o marcador)">
            <div className="map-frame">
              <MapView
                center={center}
                marker={marker ?? center}
                lifeForm={morph.formaVida as LifeForm}
                onMoveMarker={pos => { setMarker(pos) }}
                height={260}
              />
            </div>
          </Section>

          {/* morfologia completa */}
          <Section title="Características morfológicas">
            <MorphologyForm value={morph} onChange={setMorph} />
          </Section>

          {/* galeria */}
          <Section title="Fotos do indivíduo">
            <Gallery photos={photos} onChange={setPhotos} />
          </Section>

          <div className="footer-actions">
            <button className="btn primary" onClick={saveRecord}>Salvar registro</button>
            <button className="btn danger" onClick={async () => { await wipeAll(); setAll([]); toastMsg('Tudo apagado') }}>Apagar tudo</button>
          </div>
        </main>
      ) : (
        <main className="content">
          <Section title="Registros">
            <div className="row gap">
              <div className="form-field" style={{flex:1}}>
                <label>Filtrar por família</label>
                <select value={filterFamily} onChange={e=>setFilterFamily(e.target.value)}>
                  <option value="">Todas</option>
                  {Array.from(new Set(all.map(r=>r.family).filter(Boolean) as string[])).map(f =>
                    <option key={f} value={f}>{f}</option>
                  )}
                </select>
              </div>

              <div className="export-box">
                <button className="btn" onClick={()=>setExportOpen(v=>!v)}>Exportar ▾</button>
                {exportOpen && (
                  <div className="export-panel">
                    {([['json','JSON'],['geojson','GeoJSON'],['csv','CSV'],['gpx','GPX'],['xlsx','XLSX']] as const).map(([k,label]) => (
                      <label key={k} className="check">
                        <input type="checkbox" checked={(exportSel as any)[k]} onChange={()=>setExportSel(o=>({...o,[k]:!(o as any)[k]}))}/>
                        <span>{label}</span>
                      </label>
                    ))}
                    <button className="btn gold small" onClick={doExport}>Gerar & compartilhar</button>
                  </div>
                )}
              </div>
            </div>

            <div className="map-frame" style={{marginTop:12}}>
              <RecordsMap
                records={scopeRecords()}
                center={focus ?? (scopeRecords()[0]?.position || center)}
                focus={focus}
                onOpenRecord={r => { setOpenRecord(r); setFocus(r.position) }}
                height={300}
              />
            </div>

            {/* lista cumulativa */}
            <div className="list">
              {scopeRecords().map(r => (
                <button key={r.id} className="list-item" onClick={()=>{ setOpenRecord(r); setFocus(r.position) }}>
                  <div className="title">{r.commonName || r.scientificName || r.id}</div>
                  <div className="subtitle">{r.scientificName || '—'} · {r.family || '—'}</div>
                  <div className="meta">{r.position.lat.toFixed(5)}, {r.position.lng.toFixed(5)} · {new Date(r.createdAt).toLocaleString()}</div>
                </button>
              ))}
              {!scopeRecords().length && <div className="empty">Nenhum registro no filtro atual.</div>}
            </div>
          </Section>
        </main>
      )}

      {/* Modal registro */}
      {openRecord && (
        <div className="modal" onClick={()=>setOpenRecord(null)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="title">{openRecord.commonName || '—'}</div>
                <div className="subtitle"><i>{openRecord.scientificName || '—'}</i></div>
                {openRecord.family && <div className="meta">Família: {openRecord.family}</div>}
                <div className="meta">Local: {openRecord.position.lat.toFixed(6)}, {openRecord.position.lng.toFixed(6)}</div>
                <div className="meta">Data: {openRecord.createdAt}</div>
              </div>
              <div className="row gap">
                <button className="btn" onClick={()=>shareRecord(openRecord)}>Compartilhar</button>
                <button className="btn ghost" onClick={()=>setOpenRecord(null)}>Fechar</button>
              </div>
            </div>

            <div className="thumbs">
              {(openRecord.photos || []).map((p,i)=>(
                <figure key={i} className="thumb">
                  <img src={p.url} alt={p.name ?? `photo-${i}`} />
                  {p.caption && <figcaption>{p.caption}</figcaption>}
                </figure>
              ))}
              {!openRecord.photos?.length && <div className="empty">Sem fotos.</div>}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast text={toast} />}
    </div>
  )
}
