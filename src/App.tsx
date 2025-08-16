// src/App.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet'
import L, { LatLngExpression, Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import genus2family from '../public/genus2family.json' assert { type: 'json' }

// Storage simples (padrão IDB + fallback em memória)
import { loadAll, saveOne, wipeAll, removeOne, getOne } from './storage'

// Tipos
type LifeForm = 'árvore' | 'arbusto' | 'erva' | 'cipó' | 'epífita' | 'palmeira' | 'outra'
type PhotoRef = { id: string; name?: string; caption?: string; uri?: string; blobUrl?: string }
type Morphology = {
  lifeForm?: LifeForm
  flowers?: string
  fruits?: string
  health?: string
  leafType?: string
  leafMargin?: string
  phyllotaxy?: string
  venation?: string
  bark?: string
  capCm?: number | ''
  heightM?: number | ''
}
type TreeRecord = {
  id: string
  popular?: string
  scientific?: string
  family?: string
  lat?: number
  lng?: number
  dateISO?: string
  notes?: string
  morphology?: Morphology
  photos?: PhotoRef[]
}

// --------- util de ícone por forma de vida
const lifeIcon = (life?: LifeForm) => {
  const emoji =
    life === 'árvore' ? '🌳' :
    life === 'arbusto' ? '🌿' :
    life === 'erva' ? '🍃' :
    life === 'cipó' ? '🪴' :
    life === 'epífita' ? '🌱' :
    life === 'palmeira' ? '🌴' : '📍'
  return new Icon({
    iconUrl:
      `data:image/svg+xml;charset=utf8,` +
      encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">
  <circle cx="22" cy="22" r="22" fill="#134E4A"/>
  <text x="50%" y="54%" text-anchor="middle" font-size="22"> ${emoji}</text>
</svg>`),
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44]
  })
}

// --------- hook: corrigir “mapa quebrado” quando container aparece
const UseFixSize: React.FC<{ deps: any[] }> = ({ deps }) => {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 60)
  }, deps) // eslint-disable-line
  return null
}

// --------- helpers
const toCapPath = (uri: string) => Capacitor.convertFileSrc ? Capacitor.convertFileSrc(uri) : uri

const guessFamily = (scientific?: string): string | undefined => {
  if (!scientific) return undefined
  const genus = scientific.trim().split(/\s+/)[0]?.toLowerCase()
  if (!genus) return undefined
  // @ts-ignore – arquivo JSON é um dicionário {genus: family}
  const fam = (genus2family as Record<string, string>)[genus]
  return fam || undefined
}

const fmt = (n?: number) => (typeof n === 'number' ? n.toFixed(6) : '')

const ensureBlobUrl = async (p: PhotoRef): Promise<string | undefined> => {
  if (p.blobUrl) return p.blobUrl
  if (p.uri && p.uri.startsWith('file://')) {
    return toCapPath(p.uri)
  }
  return p.uri
}

// ------- exportadores
const toCSV = (rows: any[]) => {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: any) =>
    v == null ? '' : `"${String(v).replace(/"/g, '""')}"`
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => escape(r[h])).join(','))
  return lines.join('\n')
}

const toGeoJSON = (records: TreeRecord) => {
  // não usado — exporta lista abaixo
  return {}
}

const toGeoJSONList = (recs: TreeRecord[]) => ({
  type: 'FeatureCollection',
  features: recs
    .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number')
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        popular: r.popular,
        scientific: r.scientific,
        family: r.family,
        dateISO: r.dateISO,
        lifeForm: r.morphology?.lifeForm,
        notes: r.notes
      }
    }))
})

const downloadBlob = async (name: string, data: Blob | string, mime: string) => {
  if (Capacitor.getPlatform() === 'android') {
    // salva arquivo na pasta de dados do app e abre share sheet
    const content = data instanceof Blob ? await data.text() : data
    await Filesystem.writeFile({
      path: `exports/${name}`,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    })
    const uri = (await Filesystem.getUri({ path: `exports/${name}`, directory: Directory.Documents })).uri
    await Share.share({ title: name, text: `Exportado por NervuraColetora: ${name}`, url: uri })
  } else {
    const a = document.createElement('a')
    const href =
      data instanceof Blob ? URL.createObjectURL(data) :
      `data:${mime};charset=utf-8,` + encodeURIComponent(data)
    a.href = href
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (data instanceof Blob) URL.revokeObjectURL(href)
  }
}

// --------- Componente principal
const App: React.FC = () => {
  // UI
  const [tabCollect, setTabCollect] = useState<'identidade'|'mapa'|'morfologia'|'fotos'>('identidade')
  const [tabRecords, setTabRecords] = useState<'lista'|'mapa'|'exportar'>('lista')
  const [fixKeyCollectMap, setFixKeyCollectMap] = useState(0)
  const [fixKeyRecordsMap, setFixKeyRecordsMap] = useState(0)

  // Coleta
  const [popular, setPopular] = useState<string>('')
  const [scientific, setScientific] = useState<string>('')
  const [family, setFamily] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [morph, setMorph] = useState<Morphology>({})
  const [lat, setLat] = useState<number | undefined>()
  const [lng, setLng] = useState<number | undefined>()
  const [photos, setPhotos] = useState<PhotoRef[]>([])
  const [dateISO, setDateISO] = useState<string | undefined>()

  // Registros
  const [saved, setSaved] = useState<TreeRecord[]>([])
  const [filterFamily, setFilterFamily] = useState<string>('Todas')
  const [filterLife, setFilterLife] = useState<LifeForm | 'Todas'>('Todas')
  const [q, setQ] = useState('')

  // carregar registros
  useEffect(() => {
    (async () => {
      const all = await loadAll()
      setSaved(all)
    })()
  }, [])

  // GPS inicial
  useEffect(() => {
    (async () => {
      try {
        const perm = await Geolocation.requestPermissions()
        const pos = await Geolocation.getCurrentPosition()
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
      } catch {
        // fallback UFRRJ Seropédica
        setLat(-22.7603)
        setLng(-43.6804)
      }
    })()
  }, [])

  // família sugerida
  useEffect(() => {
    const fam = guessFamily(scientific)
    if (fam && !family) setFamily(fam)
  }, [scientific]) // eslint-disable-line

  // abas -> corrigir mapa
  useEffect(() => { setFixKeyCollectMap(k => k + 1) }, [tabCollect])
  useEffect(() => { setFixKeyRecordsMap(k => k + 1) }, [tabRecords])

  // adicionar fotos (galeria)
  const onPickFiles = async (files: FileList | null) => {
    if (!files) return
    const list: PhotoRef[] = []
    for (const f of Array.from(files)) {
      const url = URL.createObjectURL(f)
      list.push({ id: crypto.randomUUID(), name: f.name, blobUrl: url })
    }
    setPhotos(p => [...p, ...list])
  }

  // salvar registro
  const saveRecord = async () => {
    const rec: TreeRecord = {
      id: crypto.randomUUID(),
      popular, scientific, family,
      lat, lng, dateISO: dateISO || new Date().toISOString(),
      notes,
      morphology: { ...morph },
      photos
    }
    await saveOne(rec)
    setSaved(await loadAll())
    // limpar form (mantém lat/lng)
    setPopular(''); setScientific(''); setFamily(''); setNotes(''); setMorph({}); setPhotos([]); setDateISO(undefined)
    setTabCollect('identidade')
  }

  // excluir registro
  const delRecord = async (id: string) => {
    await removeOne(id)
    setSaved(await loadAll())
  }

  // compartilhar 1 registro
  const shareRecord = async (rec: TreeRecord) => {
    try {
      const lines = [
        rec.popular ? `Nome popular: ${rec.popular}` : '',
        rec.scientific ? `Nome científico: ${rec.scientific}` : '',
        rec.family ? `Família: ${rec.family}` : '',
        (typeof rec.lat === 'number' && typeof rec.lng === 'number') ? `Local: ${fmt(rec.lat)}, ${fmt(rec.lng)}` : '',
        rec.dateISO ? `Data: ${rec.dateISO}` : '',
        rec.morphology?.lifeForm ? `Forma de vida: ${rec.morphology.lifeForm}` : '',
        rec.notes ? `Anotações: ${rec.notes}` : ''
      ].filter(Boolean)
      const text = `Registro botânico (NervuraColetora)\n\n` + lines.join('\n')

      let url: string | undefined
      const first = rec.photos?.[0]
      if (first?.uri) url = toCapPath(first.uri)
      else if (first?.blobUrl) url = first.blobUrl

      await Share.share({
        title: rec.popular || rec.scientific || 'Registro botânico',
        text,
        url
      })
    } catch (e) {
      alert('Não foi possível compartilhar agora.')
    }
  }

  // filtros
  const filtered = useMemo(() => {
    let arr = [...saved]
    if (filterFamily !== 'Todas') arr = arr.filter(r => (r.family || '').toLowerCase() === filterFamily.toLowerCase())
    if (filterLife !== 'Todas') arr = arr.filter(r => r.morphology?.lifeForm === filterLife)
    if (q.trim()) {
      const t = q.toLowerCase()
      arr = arr.filter(r =>
        (r.popular || '').toLowerCase().includes(t) ||
        (r.scientific || '').toLowerCase().includes(t) ||
        (r.family || '').toLowerCase().includes(t))
    }
    return arr
  }, [saved, filterFamily, filterLife, q])

  // exportar (planilha mínima garantida)
  const exportXLSX = async () => {
    const rows = filtered.map(r => ({
      id: r.id,
      popular: r.popular || '',
      scientific: r.scientific || '',
      family: r.family || '',
      lifeForm: r.morphology?.lifeForm || '',
      lat: r.lat ?? '',
      lng: r.lng ?? '',
      dateISO: r.dateISO || '',
      notes: r.notes || ''
    }))
    const csv = toCSV(rows)
    // CSV -> XLSX simples via Excel (Excel abre CSV perfeitamente). Se quiser SheetJS depois a gente troca.
    await downloadBlob(`registros_${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv')
  }

  const exportJSON = async () => {
    await downloadBlob('registros.json', JSON.stringify(filtered, null, 2), 'application/json')
  }

  const exportGeoJSON = async () => {
    const gj = toGeoJSONList(filtered)
    await downloadBlob('registros.geojson', JSON.stringify(gj), 'application/geo+json')
  }

  const exportCSV = async () => {
    const rows = filtered.map(r => ({
      id: r.id,
      popular: r.popular || '',
      scientific: r.scientific || '',
      family: r.family || '',
      lifeForm: r.morphology?.lifeForm || '',
      lat: r.lat ?? '',
      lng: r.lng ?? '',
      dateISO: r.dateISO || '',
      notes: r.notes || ''
    }))
    await downloadBlob('registros.csv', toCSV(rows), 'text/csv')
  }

  const exportGPX = async () => {
    const pts = filtered
      .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number')
      .map(r => `
  <wpt lat="${r.lat}" lon="${r.lng}">
    <name>${(r.popular || r.scientific || r.id).replace(/[&<>]/g, '')}</name>
    <time>${r.dateISO || ''}</time>
  </wpt>`).join('\n')
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NervuraColetora" xmlns="http://www.topografix.com/GPX/1/1">
${pts}
</gpx>`
    await downloadBlob('registros.gpx', gpx, 'application/gpx+xml')
  }

  // ------- UI básicos
  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{
      background: '#111', border: '1px solid #222', borderRadius: 16, padding: 16, margin: '16px 0',
      boxShadow: '0 0 0 1px #1f2937 inset'
    }}>
      <h2 style={{color:'#EAD8B1', fontSize:18, margin:'0 0 12px'}}>{title}</h2>
      {children}
    </div>
  )

  const TabBar: React.FC<{ items: {key:string; label:string}[], value:string, onChange:(k:any)=>void }> =
  ({ items, value, onChange }) => (
    <div style={{
      display:'flex', gap:8, overflowX:'auto', padding:'8px 0', position:'sticky', top:56, background:'#0B0B0B', zIndex:10
    }}>
      {items.map(it => (
        <button key={it.key}
          onClick={() => onChange(it.key)}
          style={{
            whiteSpace:'nowrap',
            padding:'8px 12px',
            borderRadius:20,
            border:'1px solid #1f2937',
            background: value===it.key ? '#14532d' : '#111',
            color:'#e5e7eb'
          }}>
          {it.label}
        </button>
      ))}
    </div>
  )

  // ------- componentes de mapa
  const CollectMap: React.FC = () => {
    const position: LatLngExpression = [lat ?? 0, lng ?? 0]
    return (
      <div style={{borderRadius:16, overflow:'hidden', border:'1px solid #222'}}>
        <MapContainer key={fixKeyCollectMap} center={position} zoom={17} style={{height:320}}>
          <UseFixSize deps={[fixKeyCollectMap]}/>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {typeof lat === 'number' && typeof lng === 'number' &&
            <Marker
              position={[lat, lng]}
              draggable
              icon={lifeIcon(morph.lifeForm)}
              eventHandlers={{
                dragend: (e) => {
                  const p = (e.target as any).getLatLng()
                  setLat(p.lat); setLng(p.lng)
                }
              }}
            >
              <Popup>Marcador: {fmt(lat)}, {fmt(lng)}</Popup>
            </Marker>}
        </MapContainer>
      </div>
    )
  }

  const RecordsMap: React.FC = () => {
    const first = filtered.find(r => typeof r.lat === 'number' && typeof r.lng === 'number')
    const center: LatLngExpression = first ? [first.lat!, first.lng!] : [(lat ?? -22.7603), (lng ?? -43.6804)]
    return (
      <div style={{borderRadius:16, overflow:'hidden', border:'1px solid #222'}}>
        <MapContainer key={fixKeyRecordsMap} center={center} zoom={13} style={{height:360}}>
          <UseFixSize deps={[fixKeyRecordsMap, filtered.length]}/>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filtered.map(r => (typeof r.lat==='number' && typeof r.lng==='number') && (
            <Marker key={r.id} position={[r.lat, r.lng]} icon={lifeIcon(r.morphology?.lifeForm)}>
              <Popup>
                <div style={{minWidth:160}}>
                  <div style={{fontWeight:700}}>{r.popular || r.scientific || 'Registro'}</div>
                  {r.scientific && <div style={{fontStyle:'italic'}}>{r.scientific}</div>}
                  {r.family && <div>Família: {r.family}</div>}
                  {(r.lat!=null && r.lng!=null) && <div>{fmt(r.lat)}, {fmt(r.lng)}</div>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    )
  }

  return (
    <div style={{background:'#0B0B0B', minHeight:'100vh', color:'#e5e7eb'}}>
      {/* topo */}
      <div style={{
        position:'sticky', top:0, zIndex:20, background:'#0B0B0B',
        display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:'1px solid #1f2937'
      }}>
        <img src="/brand.png" width={30} height={30} style={{borderRadius:6}}/>
        <div style={{fontWeight:800}}>NervuraColetora</div>
        <div style={{flex:1}}/>
        <button onClick={()=>setTabCollect('identidade')}
          style={{padding:'6px 12px', borderRadius:16, border:'1px solid #1f2937', background:'#14532d', color:'#fff'}}>Coletar</button>
        <button onClick={()=>setTabRecords('lista')}
          style={{padding:'6px 12px', borderRadius:16, border:'1px solid #1f2937', background:'#0f172a', color:'#fff'}}>Registros</button>
      </div>

      <div style={{padding:'12px 14px 90px'}}>
        {/* COLHER */}
        <Section title="Coleta">
          <TabBar
            items={[
              {key:'identidade', label:'Identidade'},
              {key:'mapa', label:'Mapa'},
              {key:'morfologia', label:'Morfologia'},
              {key:'fotos', label:'Fotos'},
            ]}
            value={tabCollect}
            onChange={setTabCollect}
          />

          {tabCollect==='identidade' &&
            <div style={{display:'grid', gap:12}}>
              <label>Nome popular
                <input value={popular} onChange={e=>setPopular(e.target.value)}
                  placeholder="ex.: ipê-amarelo"
                  style={{width:'100%', marginTop:6}}/>
              </label>
              <label>Nome científico
                <input value={scientific} onChange={e=>setScientific(e.target.value)}
                  placeholder="ex.: Handroanthus albus"
                  style={{width:'100%', marginTop:6}}/>
              </label>
              <label>Família (auto)
                <input value={family} onChange={e=>setFamily(e.target.value)}
                  placeholder="ex.: Bignoniaceae"
                  style={{width:'100%', marginTop:6}}/>
              </label>
              <label>Observações
                <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                  placeholder="Anotações adicionais" style={{width:'100%', marginTop:6}}/>
              </label>
            </div>}

          {tabCollect==='mapa' && <div>
            <div style={{marginBottom:8, color:'#cbd5e1'}}>Posição no mapa (toque/arraste o marcador)</div>
            <CollectMap/>
            <div style={{marginTop:8}}>Marcador: {fmt(lat)}, {fmt(lng)}</div>
          </div>}

          {tabCollect==='morfologia' &&
            <div style={{display:'grid', gap:12}}>
              <label>Forma de vida
                <select value={morph.lifeForm || ''} onChange={e=>setMorph(m => ({...m, lifeForm: (e.target.value || undefined) as any}))}
                  style={{width:'100%', marginTop:6}}>
                  <option value=""></option>
                  {['árvore','arbusto','erva','cipó','epífita','palmeira','outra'].map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label>Flores
                <input value={morph.flowers || ''} onChange={e=>setMorph(m=>({...m, flowers:e.target.value}))}
                  placeholder="Descrição/cor/estágio" style={{width:'100%', marginTop:6}}/>
              </label>
              <label>Frutos
                <input value={morph.fruits || ''} onChange={e=>setMorph(m=>({...m, fruits:e.target.value}))}
                  placeholder="Descrição/estágio" style={{width:'100%', marginTop:6}}/>
              </label>
              <label>Saúde
                <input value={morph.health || ''} onChange={e=>setMorph(m=>({...m, health:e.target.value}))}
                  placeholder="sadio/lesões/pragas" style={{width:'100%', marginTop:6}}/>
              </label>
              <label>CAP (cm)
                <input type="number" value={morph.capCm as any || ''} onChange={e=>setMorph(m=>({...m, capCm: e.target.value ? Number(e.target.value) : ''}))}
                  placeholder="ex.: 45" style={{width:'100%', marginTop:6}}/>
              </label>
              <label>Altura (m)
                <input type="number" value={morph.heightM as any || ''} onChange={e=>setMorph(m=>({...m, heightM: e.target.value ? Number(e.target.value) : ''}))}
                  placeholder="ex.: 8" style={{width:'100%', marginTop:6}}/>
              </label>
            </div>
          }

          {tabCollect==='fotos' &&
            <div>
              <input type="file" multiple accept="image/*" onChange={e=>onPickFiles(e.target.files)} />
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginTop:12}}>
                {photos.length===0 && <div style={{opacity:.7}}>Nenhuma foto adicionada.</div>}
                {photos.map(p=><div key={p.id} style={{border:'1px solid #222', borderRadius:8, padding:6}}>
                  <img src={p.blobUrl || (p.uri ? toCapPath(p.uri) : undefined)} style={{width:'100%', height:92, objectFit:'cover', borderRadius:6}}/>
                  <select value={p.caption || ''} onChange={e=>setPhotos(list => list.map(x => x.id===p.id ? {...x, caption: e.target.value} : x))}
                    style={{width:'100%', marginTop:6}}>
                    <option value="">(legenda)</option>
                    <option value="hábito">hábito</option>
                    <option value="folha">folha</option>
                    <option value="flor">flor</option>
                    <option value="fruto">fruto</option>
                    <option value="casca">casca</option>
                    <option value="outra">outra</option>
                  </select>
                </div>)}
              </div>
            </div>
          }

          <div style={{display:'flex', gap:12, marginTop:16, flexWrap:'wrap'}}>
            <button onClick={saveRecord} style={{background:'#14532d', color:'#fff', padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937'}}>Salvar registro</button>
            <button onClick={async ()=>{ await wipeAll(); setSaved([]) }} style={{background:'#7f1d1d', color:'#fff', padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937'}}>Apagar tudo</button>
          </div>
        </Section>

        {/* REGISTROS */}
        <Section title="Registros">
          <TabBar
            items={[
              {key:'lista', label:'Lista'},
              {key:'mapa', label:'Mapa'},
              {key:'exportar', label:'Exportar'},
            ]}
            value={tabRecords}
            onChange={setTabRecords}
          />

          {tabRecords==='lista' &&
            <div style={{display:'grid', gap:12}}>
              <div style={{display:'grid', gap:8}}>
                <label>Família
                  <input value={filterFamily==='Todas' ? '' : filterFamily} onChange={e=>setFilterFamily(e.target.value || 'Todas')} placeholder="Todas" style={{width:'100%', marginTop:6}}/>
                </label>
                <label>Forma de vida
                  <select value={filterLife} onChange={e=>setFilterLife(e.target.value as any)} style={{width:'100%', marginTop:6}}>
                    {['Todas','árvore','arbusto','erva','cipó','epífita','palmeira','outra'].map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label>Buscar
                  <input value={q} onChange={e=>setQ(e.target.value)} placeholder="popular/científico/família" style={{width:'100%', marginTop:6}}/>
                </label>
              </div>

              <div style={{display:'grid', gap:12}}>
                {filtered.map(r => (
                  <div key={r.id} style={{border:'1px solid #222', borderRadius:12, padding:12}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:20}}>{r.morphology?.lifeForm ? (lifeIcon(r.morphology.lifeForm) && '🌿') : '📍'}</span>
                      <div style={{fontWeight:700}}>{r.popular || r.scientific || '(sem nome)'}</div>
                      <div style={{flex:1}} />
                      <button onClick={()=>shareRecord(r)} style={{background:'#14532d', color:'#fff', padding:'6px 10px', borderRadius:8, border:'1px solid #1f2937'}}>Compartilhar</button>
                      <button onClick={()=>delRecord(r.id)} style={{background:'#7f1d1d', color:'#fff', padding:'6px 10px', borderRadius:8, border:'1px solid #1f2937'}}>Excluir</button>
                    </div>
                    <div style={{opacity:.8}}>
                      {r.scientific && <div style={{fontStyle:'italic'}}>{r.scientific}</div>}
                      {r.family && <div>Família: {r.family}</div>}
                      {(r.lat!=null && r.lng!=null) && <div>Local: {fmt(r.lat)}, {fmt(r.lng)}</div>}
                      {r.dateISO && <div>Data: {r.dateISO}</div>}
                    </div>
                    {r.photos?.length ? (
                      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginTop:8}}>
                        {r.photos.map(p => <img key={p.id} src={p.blobUrl || (p.uri ? toCapPath(p.uri) : undefined)} style={{width:'100%', height:90, objectFit:'cover', borderRadius:6}}/>)}
                      </div>
                    ) : <div style={{opacity:.6, marginTop:6}}>Sem fotos.</div>}
                  </div>
                ))}
                {filtered.length===0 && <div style={{opacity:.7}}>Nenhum registro.</div>}
              </div>
            </div>
          }

          {tabRecords==='mapa' && <RecordsMap/>}

          {tabRecords==='exportar' &&
            <div style={{display:'grid', gap:12}}>
              <div style={{opacity:.8}}>Exporta o conjunto filtrado na aba “Lista”.</div>
              <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
                <button onClick={exportXLSX} style={{background:'#14532d', color:'#fff', padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937'}}>Exportar XLSX (CSV)</button>
                <button onClick={exportCSV} style={{background:'#14532d', color:'#fff', padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937'}}>Exportar CSV</button>
                <button onClick={exportJSON} style={{background:'#14532d', color:'#fff', padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937'}}>Exportar JSON</button>
                <button onClick={exportGeoJSON} style={{background:'#14532d', color:'#fff', padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937'}}>Exportar GeoJSON</button>
                <button onClick={exportGPX} style={{background:'#14532d', color:'#fff', padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937'}}>Exportar GPX</button>
              </div>
            </div>
          }
        </Section>
      </div>
    </div>
  )
}

export default App
