import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import RecordsMap from './components/RecordsMap'
import PhotoPicker from './components/PhotoPicker'
import MorphologyForm from './components/MorphologyForm'
import Gallery from './components/Gallery'
import { extractGpsFromFile, extractDateFromFile } from './utils/exif'
import { loadAll, saveOne, wipeAll, removeOne, getOne, upsertMany } from './storage'
import type { LatLng, LifeForm, Morphology, PhotoRef, TreeRecord } from './types'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Geolocation } from '@capacitor/geolocation'
import './theme.css'

/** ----------------- Constantes / helpers ----------------- */
const UFRRJ: LatLng = { lat: -22.745, lng: -43.701 }
const BR_CENTER: LatLng = { lat: -15.78, lng: -47.93 }
const uuid = () =>
  ('randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
type Mode = 'coleta' | 'registros'
type ColetaTab = 'id' | 'map' | 'morph' | 'photos'
type RegTab = 'list' | 'map'

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

function pingResize() {
  try {
    window.dispatchEvent(new Event('resize'))
    setTimeout(() => window.dispatchEvent(new Event('resize')), 120)
  } catch {}
}

function lifeFormEmoji(lf?: LifeForm) {
  switch (lf) {
    case 'árvore':
      return '🌳'
    case 'arbusto':
      return '🌿'
    case 'erva':
      return '🍃'
    case 'cipó':
      return '🪢'
    case 'epífita':
      return '🪴'
    case 'palmeira':
      return '🌴'
    default:
      return '📍'
  }
}

/** tenta pegar Município/UF via Nominatim (best-effort) */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pt-BR&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'NervuraColetora/1.0' } },
    )
    if (!resp.ok) return null
    const j = await resp.json()
    const a = j?.address
    if (!a) return null
    const mun = a.city || a.town || a.village || a.municipality || a.suburb
    const uf = a.state || a.region
    return [mun, uf].filter(Boolean).join(' – ')
  } catch {
    return null
  }
}

/** carrega o mapa de Gênero→Família da pasta public */
let GENUS_CACHE: Record<string, string> | null = null
async function loadGenus(): Promise<Record<string, string>> {
  if (GENUS_CACHE) return GENUS_CACHE
  try {
    const r = await fetch('/genus2family.json')
    const j = (await r.json()) as Record<string, string>
    GENUS_CACHE = Object.fromEntries(Object.entries(j).map(([g, f]) => [g.toLowerCase(), f]))
    return GENUS_CACHE
  } catch {
    GENUS_CACHE = {}
    return {}
  }
}

/** ----------------- Componente ----------------- */
export default function App() {
  const [mode, setMode] = useState<Mode>('coleta')
  const [tab, setTab] = useState<ColetaTab>('id')
  const [regTab, setRegTab] = useState<RegTab>('list')

  const headerRef = useRef<HTMLElement | null>(null)
  function measureHeader() {
    const h = headerRef.current?.getBoundingClientRect().height ?? 64
    document.documentElement.style.setProperty('--hdr', `${Math.ceil(h)}px`)
  }
  useEffect(() => {
    measureHeader()
    const onResize = () => measureHeader()
    window.addEventListener('resize', onResize)
    const id = setInterval(measureHeader, 500)
    return () => {
      window.removeEventListener('resize', onResize)
      clearInterval(id)
    }
  }, [])
  useEffect(() => {
    measureHeader()
    pingResize()
  }, [mode, tab, regTab])

  // estado de coleta
  const [center, setCenter] = useState<LatLng>(BR_CENTER)
  const [marker, setMarker] = useState<LatLng | null>(null)
  const [photos, setPhotos] = useState<PhotoRef[]>([])
  const [firstCandidate, setFirstCandidate] = useState<{ url: string; file: File } | null>(null)

  const [commonName, setCommon] = useState('')
  const [scientificName, setScientific] = useState('')
  const [family, setFamily] = useState('')
  const [morph, setMorph] = useState<Morphology>({})
  const [firstISO, setFirstISO] = useState<string | undefined>(undefined)

  // registros
  const [all, setAll] = useState<TreeRecord[]>([])
  const [filterFamily, setFilterFamily] = useState<string>('')
  const [filterLife, setFilterLife] = useState<LifeForm | ''>('')
  const [filterHasPhoto, setFilterHasPhoto] = useState<boolean>(false)
  const [filterText, setFilterText] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [focus, setFocus] = useState<LatLng | null>(null)
  const [openRecord, setOpenRecord] = useState<TreeRecord | null>(null)

  // export
  const [exportOpen, setExportOpen] = useState(false)
  const [exportSel, setExportSel] = useState({ json: true, geojson: true, csv: true, gpx: false, xlsx: true })

  // ui
  const [toast, setToast] = useState<string | null>(null)
  const isNative = useMemo(() => (Capacitor.getPlatform?.() ?? 'web') !== 'web', [])

  function toastMsg(t: string) {
    setToast(t)
    setTimeout(() => setToast(null), 1800)
  }

  /** GPS inicial + watch */
  useEffect(() => {
    ;(async () => {
      try {
        const asked = localStorage.getItem('geoAsked')
        if (!asked) {
          await Geolocation.requestPermissions()
          localStorage.setItem('geoAsked', '1')
        }
        const current = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 6000 })
        const here = { lat: current.coords.latitude, lng: current.coords.longitude }
        setCenter(here)
        setMarker(here)
      } catch {
        setCenter(UFRRJ)
        setMarker(UFRRJ)
      }
      try {
        await Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 5000 }, (pos) => {
          if (pos && pos.coords) {
            const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            setCenter((prev) => prev ?? here)
          }
        })
      } catch {}
    })()
  }, [])

  /** carregar registros */
  useEffect(() => {
    loadAll().then((r) => setAll(r ?? []))
  }, [])

  /** ------------- Fotos ------------- */
  async function confirmFirstPhoto() {
    if (!firstCandidate) return
    const { file, url } = firstCandidate
    setPhotos((p) => [{ url, name: file.name, caption: '' }, ...p])
    const gps = await extractGpsFromFile(file)
    if (gps) {
      setCenter(gps)
      setMarker(gps)
    }
    const dt = await extractDateFromFile(file)
    if (dt) setFirstISO(dt.toISOString())
    setFirstCandidate(null)
    toastMsg('📍 Posição atualizada (EXIF)')
    pingResize()
  }
  function onGallery(files: File[]) {
    if (!files?.length) return
    if (!photos.length && !firstCandidate) {
      const [first, ...rest] = files
      setFirstCandidate({ url: URL.createObjectURL(first), file: first })
      if (rest.length)
        setPhotos((prev) => [...rest.map((f) => ({ url: URL.createObjectURL(f), name: f.name, caption: '' })), ...prev])
    } else {
      setPhotos((prev) => [
        ...files.map((f) => ({ url: URL.createObjectURL(f), name: f.name, caption: '' })),
        ...prev,
      ])
    }
    toastMsg('🖼️ Foto(s) adicionada(s)')
    pingResize()
  }
  async function onCamera(file: File) {
    setFirstCandidate({ url: URL.createObjectURL(file), file })
    toastMsg('📸 Confirme para aplicar EXIF/GPS')
    pingResize()
  }

  /** ------------- Auto-família por gênero ------------- */
  useEffect(() => {
    const id = setTimeout(async () => {
      const gen = (scientificName || '').trim().split(/\s+/)[0]?.toLowerCase()
      if (!gen) return
      if (family) return // usuário já preencheu manualmente
      const map = await loadGenus()
      const fam = map[gen]
      if (fam) setFamily(fam)
    }, 300)
    return () => clearTimeout(id)
  }, [scientificName])

  /** ------------- Salvar / Reset / Editar / Excluir ------------- */
  function resetForm() {
    setPhotos([])
    setFirstCandidate(null)
    setCommon('')
    setScientific('')
    setFamily('')
    setMorph({})
    setFirstISO(undefined)
    setMarker(center)
  }

  async function saveRecord(editId?: string) {
    const pos = (marker ?? center)!
    const now = new Date().toISOString()
    const rec: TreeRecord = {
      id: editId || uuid(),
      position: pos,
      commonName: commonName || undefined,
      scientificName: scientificName || undefined,
      family: family || undefined,
      morphology: morph,
      photos,
      createdAt: firstISO ?? now,
      updatedAt: now,
    }
    if (editId) {
      const next = all.map((r) => (r.id === editId ? rec : r))
      await upsertMany(next)
      setAll(next)
    } else {
      await saveOne(rec)
      const allNow = await loadAll()
      setAll(allNow)
    }
    resetForm()
    setMode('registros')
    setRegTab('list')
    setFocus(rec.position)
    toastMsg('✅ Registro salvo')
  }

  async function startEdit(r: TreeRecord) {
    setMode('coleta')
    setTab('id')
    setCommon(r.commonName || '')
    setScientific(r.scientificName || '')
    setFamily(r.family || '')
    setMorph(r.morphology || {})
    setPhotos(r.photos || [])
    setFirstISO(r.createdAt)
    setMarker(r.position)
    // salvar usará o id antigo
    ;(saveRecord as any)._editing = r.id
  }

  async function deleteRecord(r: TreeRecord) {
    await removeOne(r.id)
    const allNow = await loadAll()
    setAll(allNow)
    setOpenRecord(null)
    toastMsg('Registro removido')
  }

  /** ------------- Exportação ------------- */
  function scoped(): TreeRecord[] {
    let rs = [...all]
    if (filterFamily) rs = rs.filter((r) => r.family === filterFamily)
    if (filterLife) rs = rs.filter((r) => (r.morphology?.formaVida as any) === filterLife)
    if (filterHasPhoto) rs = rs.filter((r) => (r.photos?.length ?? 0) > 0)
    if (filterText) {
      const t = filterText.toLowerCase()
      rs = rs.filter(
        (r) =>
          (r.commonName || '').toLowerCase().includes(t) ||
          (r.scientificName || '').toLowerCase().includes(t) ||
          (r.family || '').toLowerCase().includes(t),
      )
    }
    if (dateFrom) rs = rs.filter((r) => r.createdAt >= dateFrom)
    if (dateTo) rs = rs.filter((r) => r.createdAt <= dateTo + 'T23:59:59')
    return rs
  }

  function makeJSON(rs: TreeRecord[]) {
    return JSON.stringify(
      { meta: { app: 'NervuraColetora', exportedAt: new Date().toISOString(), total: rs.length }, records: rs },
      null,
      2,
    )
  }

  function makeGeoJSON(rs: TreeRecord[]) {
    const fc = {
      type: 'FeatureCollection',
      features: rs.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.position.lng, r.position.lat] },
        properties: {
          id: r.id,
          commonName: r.commonName,
          scientificName: r.scientificName,
          family: r.family,
          morphology: r.morphology,
          photoCount: r.photos?.length ?? 0,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        },
      })),
    }
    return JSON.stringify(fc, null, 2)
  }

  function makeCSV(rs: TreeRecord[]) {
    const head = [
      'id',
      'dataISO',
      'lat',
      'lng',
      'nomePopular',
      'nomeCientifico',
      'familia',
      'formaVida',
      'flores',
      'frutos',
      'saude',
      'folha_tipo',
      'folha_margem',
      'folha_filotaxia',
      'folha_nervacao',
      'cap_cm',
      'altura_m',
      'anotacoes',
      'fotos',
    ]
    const rows = rs.map((r) =>
      [
        r.id,
        r.createdAt,
        r.position.lat,
        r.position.lng,
        q(r.commonName),
        q(r.scientificName),
        q(r.family),
        q(r.morphology?.formaVida as any),
        q(r.morphology?.flores),
        q(r.morphology?.frutos),
        q(r.morphology?.saude),
        q(r.morphology?.folha_tipo),
        q(r.morphology?.folha_margem),
        q(r.morphology?.folha_filotaxia),
        q(r.morphology?.folha_nervacao),
        r.morphology?.cap_cm ?? '',
        r.morphology?.altura_m ?? '',
        q(r.morphology?.obs),
        r.photos?.length ?? 0,
      ].join(','),
    )
    return [head.join(','), ...rows].join('\n')
    function q(v?: any) {
      if (v == null) return ''
      const s = String(v)
      return `"${s.replace(/"/g, '""')}"`
    }
  }

  function makeGPX(rs: TreeRecord[]) {
    const wpts = rs
      .map(
        (r) =>
          `\n  <wpt lat="${r.position.lat}" lon="${r.position.lng}"><name>${xml(
            r.commonName ?? r.scientificName ?? r.id,
          )}</name><time>${r.createdAt}</time></wpt>`,
      )
      .join('')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NervuraColetora" xmlns="http://www.topografix.com/GPX/1/1">${wpts}\n</gpx>`
    function xml(s: string) {
      return s.replace(/[<&>]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m] as string))
    }
  }

  async function makeXLSXBlob(rs: TreeRecord[]) {
    // @ts-ignore
    let XLSX: any
    try {
      XLSX = await import('xlsx/xlsx.mjs')
    } catch {
      XLSX = await import('xlsx')
    }
    const rows = rs.map((r) => ({
      id: r.id,
      dataISO: r.createdAt,
      lat: r.position.lat,
      lng: r.position.lng,
      nomePopular: r.commonName ?? '',
      nomeCientifico: r.scientificName ?? '',
      familia: r.family ?? '',
      formaVida: (r.morphology?.formaVida as any) ?? '',
      flores: r.morphology?.flores ?? '',
      frutos: r.morphology?.frutos ?? '',
      saude: r.morphology?.saude ?? '',
      folha_tipo: r.morphology?.folha_tipo ?? '',
      folha_margem: r.morphology?.folha_margem ?? '',
      folha_filotaxia: r.morphology?.folha_filotaxia ?? '',
      folha_nervacao: r.morphology?.folha_nervacao ?? '',
      cap_cm: r.morphology?.cap_cm ?? '',
      altura_m: r.morphology?.altura_m ?? '',
      anotacoes: r.morphology?.obs ?? '',
      fotos: r.photos?.length ?? 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Registros')
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  function b64(buf: ArrayBuffer) {
    let s = ''
    const b = new Uint8Array(buf)
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
    return btoa(s)
  }

  async function doExport() {
    const rs = scoped()
    if (!rs.length) {
      toastMsg('Nada para exportar')
      return
    }
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const tasks: { name: string; mime: string; blob: Promise<Blob> }[] = []
    if (exportSel.json)
      tasks.push({
        name: `nervura-${ts}.json`,
        mime: 'application/json',
        blob: Promise.resolve(new Blob([makeJSON(rs)], { type: 'application/json' })),
      })
    if (exportSel.geojson)
      tasks.push({
        name: `nervura-${ts}.geojson`,
        mime: 'application/geo+json',
        blob: Promise.resolve(new Blob([makeGeoJSON(rs)], { type: 'application/geo+json' })),
      })
    if (exportSel.csv)
      tasks.push({
        name: `nervura-${ts}.csv`,
        mime: 'text/csv',
        blob: Promise.resolve(new Blob([makeCSV(rs)], { type: 'text/csv' })),
      })
    if (exportSel.gpx)
      tasks.push({
        name: `nervura-${ts}.gpx`,
        mime: 'application/gpx+xml',
        blob: Promise.resolve(new Blob([makeGPX(rs)], { type: 'application/gpx+xml' })),
      })
    if (exportSel.xlsx)
      tasks.push({
        name: `nervura-${ts}.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        blob: makeXLSXBlob(rs),
      })

    if ((Capacitor.getPlatform?.() ?? 'web') === 'web') {
      for (const t of tasks) {
        const b = await t.blob
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = t.name
        a.click()
        URL.revokeObjectURL(a.href)
      }
      setExportOpen(false)
      toastMsg('Exportado')
      return
    }
    const fileUris: string[] = []
    for (const t of tasks) {
      const b = await t.blob
      const ab = await b.arrayBuffer()
      await Filesystem.writeFile({ path: t.name, data: b64(ab), directory: Directory.Cache, encoding: Encoding.BASE64 })
      const uri = (await Filesystem.getUri({ path: t.name, directory: Directory.Cache })).uri
      fileUris.push(uri)
    }
    try {
      await Share.share({
        title: 'Exportar dados — NervuraColetora',
        text: `Exportados ${rs.length} registro(s).`,
        files: fileUris,
        dialogTitle: 'Compartilhar exportações',
      })
    } catch {}
    setExportOpen(false)
    toastMsg('Exportado')
  }

  /** ------------- Compartilhar um registro ------------- */
  async function shareRecord(r: TreeRecord) {
    const where = (await reverseGeocode(r.position.lat, r.position.lng)) || 
      `${r.position.lat.toFixed(5)}, ${r.position.lng.toFixed(5)}`
    const texto = [
      'Registro botânico — NervuraColetora',
      r.commonName ? `Nome popular: ${r.commonName}` : null,
      r.scientificName ? `Nome científico: ${r.scientificName}` : null,
      r.family ? `Família: ${r.family}` : null,
      `Local: ${where}`,
      r.createdAt ? `Data/Hora: ${new Date(r.createdAt).toLocaleString()}` : null,
      r.morphology?.formaVida ? `Forma de vida: ${r.morphology.formaVida}` : null,
      r.morphology?.flores ? `Flores: ${r.morphology.flores}` : null,
      r.morphology?.frutos ? `Frutos: ${r.morphology.frutos}` : null,
      r.morphology?.saude ? `Saúde: ${r.morphology.saude}` : null,
      r.morphology?.folha_tipo ? `Folha – tipo: ${r.morphology.folha_tipo}` : null,
      r.morphology?.folha_margem ? `Folha – margem: ${r.morphology.folha_margem}` : null,
      r.morphology?.folha_filotaxia ? `Folha – filotaxia: ${r.morphology.folha_filotaxia}` : null,
      r.morphology?.folha_nervacao ? `Folha – nervação: ${r.morphology.folha_nervacao}` : null,
      r.morphology?.obs ? `Anotações: ${r.morphology.obs}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    if ((Capacitor.getPlatform?.() ?? 'web') === 'web') {
      await navigator.clipboard?.writeText(texto)
      toastMsg('Texto copiado — cole no Facebook')
      return
    }
    const files: string[] = []
    for (let i = 0; i < (r.photos?.length ?? 0); i++) {
      const p = r.photos![i]
      try {
        const blob = await fetch(p.url).then((x) => x.blob())
        const ab = await blob.arrayBuffer()
        const name = `registro-${r.id}-${i}.jpg`
        await Filesystem.writeFile({ path: name, data: b64(ab), directory: Directory.Cache, encoding: Encoding.BASE64 })
        const uri = (await Filesystem.getUri({ path: name, directory: Directory.Cache })).uri
        files.push(uri)
      } catch {}
    }
    try {
      await Share.share({
        title: r.commonName ?? r.scientificName ?? 'Registro botânico',
        text: texto,
        files,
        dialogTitle: 'Compartilhar registro',
      })
    } catch {}
  }

  /** ----------------- UI ----------------- */
  return (
    <div className="app-root app-shell">
      <header className="app-header" ref={headerRef as any}>
        <div className="topbar">
          <Brand />
          <div className="tabs">
            <button className={mode === 'coleta' ? 'tab active' : 'tab'} onClick={() => setMode('coleta')}>
              Coletar
            </button>
            <button className={mode === 'registros' ? 'tab active' : 'tab'} onClick={() => setMode('registros')}>
              Registros
            </button>
          </div>
        </div>
        {mode === 'coleta' && (
          <div className="subtabs">
            {(['id', 'map', 'morph', 'photos'] as ColetaTab[]).map((t) => (
              <button key={t} className={tab === t ? 'chip active' : 'chip'} onClick={() => { setTab(t); pingResize() }}>
                {t === 'id' ? 'Identificação' : t === 'map' ? 'Mapa' : t === 'morph' ? 'Morfologia' : 'Fotos'}
              </button>
            ))}
          </div>
        )}
        {mode === 'registros' && (
          <div className="subtabs">
            {(['list', 'map'] as RegTab[]).map((t) => (
              <button key={t} className={regTab === t ? 'chip active' : 'chip'} onClick={() => { setRegTab(t); pingResize() }}>
                {t === 'list' ? 'Lista / Exportar' : 'Mapa'}
              </button>
            ))}
          </div>
        )}
      </header>

      {mode === 'coleta' ? (
        <main className="content app-content">
          {tab === 'id' && (
            <>
              <Section title="Identificação">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Nome popular</label>
                    <input value={commonName} onChange={(e) => setCommon(e.target.value)} placeholder="ex.: Ipê-amarelo" />
                  </div>
                  <div className="form-field">
                    <label>Nome científico</label>
                    <input
                      value={scientificName}
                      onChange={(e) => setScientific(e.target.value)}
                      placeholder="ex.: Handroanthus albus"
                      autoCapitalize="none"
                    />
                  </div>
                  <div className="form-field">
                    <label>Família (auto)</label>
                    <input value={family} onChange={(e) => setFamily(e.target.value)} placeholder="ex.: Bignoniaceae" />
                  </div>
                </div>
              </Section>

              <Section title="Fotos">
                <div className="row gap">
                  <PhotoPicker onCamera={onCamera} onGallery={onGallery} />
                </div>
                <small className="hint">Dica: use a câmera para capturar EXIF/GPS quando disponível.</small>
                {firstCandidate && (
                  <div className="confirm-first">
                    <img src={firstCandidate.url} className="thumb-first" />
                    <div className="row">
                      <button className="btn gold" onClick={confirmFirstPhoto}>
                        Confirmar 1ª foto (aplicar EXIF/GPS)
                      </button>
                      <button className="btn ghost" onClick={() => setFirstCandidate(null)}>
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            </>
          )}

          {tab === 'map' && (
            <Section title="Posição no mapa (toque para mover / arraste o marcador)">
              <div className="map-frame" style={{ height: 300 }}>
                <MapView
                  center={center}
                  marker={marker ?? center}
                  lifeForm={morph.formaVida as LifeForm}
                  onMoveMarker={(pos) => setMarker(pos)}
                  height={300}
                />
              </div>
              <div className="meta" style={{ marginTop: 8 }}>
                Marcador: {lifeFormEmoji(morph.formaVida as LifeForm)} · {marker?.lat.toFixed(5)},{' '}
                {marker?.lng.toFixed(5)}
              </div>
            </Section>
          )}

          {tab === 'morph' && (
            <Section title="Características morfológicas">
              <MorphologyForm value={morph} onChange={setMorph} />
            </Section>
          )}

          {tab === 'photos' && (
            <>
              <Section title="Fotos do indivíduo">
                <Gallery photos={photos} onChange={setPhotos} />
              </Section>
              <div className="footer-actions actions">
                <button
                  className="btn primary"
                  onClick={() => saveRecord((saveRecord as any)._editing ? (saveRecord as any)._editing : undefined)}
                >
                  Salvar registro
                </button>
                <button
                  className="btn warn"
                  onClick={async () => {
                    await wipeAll()
                    setAll([])
                    toastMsg('Tudo apagado')
                  }}
                >
                  Apagar tudo
                </button>
              </div>
            </>
          )}
        </main>
      ) : (
        <main className="content app-content">
          {regTab === 'list' && (
            <Section title="Registros">
              <div className="grid-2 gap">
                <div className="form-field">
                  <label>Família</label>
                  <select value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}>
                    <option value="">Todas</option>
                    {Array.from(new Set(all.map((r) => r.family).filter(Boolean) as string[])).map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Forma de vida</label>
                  <select value={filterLife} onChange={(e) => setFilterLife(e.target.value as any)}>
                    <option value="">Todas</option>
                    {['árvore', 'arbusto', 'erva', 'cipó', 'epífita', 'palmeira'].map((lf) => (
                      <option value={lf} key={lf}>
                        {lf}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>De</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Até</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <label className="check" style={{ alignSelf: 'end' }}>
                  <input type="checkbox" checked={filterHasPhoto} onChange={(e) => setFilterHasPhoto(e.target.checked)} />
                  <span>Somente com foto</span>
                </label>
                <div className="form-field">
                  <label>Buscar</label>
                  <input placeholder="popular/científico/família" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
                </div>
              </div>

              <div className="export-box" style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setExportOpen((v) => !v)}>
                  Exportar ▾
                </button>
                {exportOpen && (
                  <div className="export-panel">
                    {(
                      [
                        ['json', 'JSON'],
                        ['geojson', 'GeoJSON'],
                        ['csv', 'CSV'],
                        ['gpx', 'GPX'],
                        ['xlsx', 'XLSX'],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="check">
                        <input
                          type="checkbox"
                          checked={(exportSel as any)[k]}
                          onChange={() => setExportSel((o) => ({ ...o, [k]: !(o as any)[k] }))}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                    <button className="btn gold small" onClick={doExport}>
                      Gerar & compartilhar
                    </button>
                  </div>
                )}
              </div>

              <div className="list" style={{ marginTop: 12 }}>
                {scoped().map((r) => (
                  <div key={r.id} className="list-item row space">
                    <div onClick={() => { setOpenRecord(r); setFocus(r.position) }}>
                      <div className="title">
                        {lifeFormEmoji(r.morphology?.formaVida as any)} {r.commonName || r.scientificName || r.id}
                      </div>
                      <div className="subtitle">
                        <i>{r.scientificName || '—'}</i> · {r.family || '—'}
                      </div>
                      <div className="meta">
                        {r.position.lat.toFixed(5)}, {r.position.lng.toFixed(5)} · {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="row gap">
                      <button className="btn small" onClick={() => shareRecord(r)}>Compartilhar</button>
                      <button className="btn small ghost" onClick={() => startEdit(r)}>Editar</button>
                      <button className="btn small warn" onClick={() => deleteRecord(r)}>Excluir</button>
                    </div>
                  </div>
                ))}
                {!scoped().length && <div className="empty">Nenhum registro no filtro atual.</div>}
              </div>
            </Section>
          )}

          {regTab === 'map' && (
            <Section title="Mapa de registros">
              <div className="map-frame" style={{ height: 360 }}>
                <RecordsMap
                  records={scoped()}
                  center={focus ?? (scoped()[0]?.position || center)}
                  focus={focus}
                  onOpenRecord={(r) => { setOpenRecord(r); setFocus(r.position) }}
                  height={360}
                />
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => setOpenRecord(null)}>Fechar detalhes</button>
                <button className="btn ghost" onClick={() => { pingResize(); }}>
                  Atualizar exibição
                </button>
              </div>
            </Section>
          )}
        </main>
      )}

      {openRecord && (
        <div className="modal" onClick={() => setOpenRecord(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="title">
                  {lifeFormEmoji(openRecord.morphology?.formaVida as any)} {openRecord.commonName || '—'}
                </div>
                <div className="subtitle">
                  <i>{openRecord.scientificName || '—'}</i>
                </div>
                {openRecord.family && <div className="meta">Família: {openRecord.family}</div>}
                <div className="meta">
                  Local: {openRecord.position.lat.toFixed(6)}, {openRecord.position.lng.toFixed(6)}
                </div>
                <div className="meta">Data: {new Date(openRecord.createdAt).toLocaleString()}</div>
              </div>
              <div className="row gap">
                <button className="btn" onClick={() => shareRecord(openRecord)}>Compartilhar</button>
                <button className="btn ghost" onClick={() => setOpenRecord(null)}>Fechar</button>
              </div>
            </div>

            <div className="thumbs">
              {(openRecord.photos || []).map((p, i) => (
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
