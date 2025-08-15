import { useState } from 'react'
import type { PhotoRef } from '../types'

const CAPTIONS = ['folha','flor','fruto','casca','hábito','ramo','tronco','copa','semente','detalhe']

export default function Gallery({ photos, onChange }: { photos: PhotoRef[]; onChange: (p: PhotoRef[]) => void }) {
  const [zoom, setZoom] = useState<PhotoRef | null>(null)
  const setCaption = (i: number, caption: string) => {
    const clone = [...photos]; clone[i] = { ...clone[i], caption }; onChange(clone)
  }
  const removeAt = (i: number) => onChange(photos.slice(0, i).concat(photos.slice(i + 1)))

  return (
    <div className="card">
      <label>Fotos do indivíduo</label>
      {photos.length === 0 ? <div>Nenhuma foto adicionada.</div> : null}
      <div className="thumbs">
        {photos.map((p, i) => (
          <div key={i} className="thumb">
            <img
              src={p.url}
              alt={p.name ?? `photo-${i}`}
              onClick={() => setZoom(p)}
              title="Toque para ampliar"
            />
            <div className="row" style={{ marginTop: 6 }}>
              <select
                value={p.caption ?? ''}
                onChange={e => setCaption(i, e.target.value)}
              >
                <option value="">Legenda…</option>
                {CAPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="danger" onClick={() => removeAt(i)}>Apagar</button>
            </div>
          </div>
        ))}
      </div>

      {zoom ? (
        <div className="modal" onClick={() => setZoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <img src={zoom.url} style={{ maxWidth: '100%', maxHeight: '80vh' }} />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setZoom(null)}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
