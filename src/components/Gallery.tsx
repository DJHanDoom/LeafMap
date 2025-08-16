import type { PhotoRef } from '../types'

export default function Gallery({
  photos, onChange
}: {
  photos: PhotoRef[]
  onChange: (p: PhotoRef[]) => void
}) {
  function removeAt(i:number){ onChange(photos.filter((_,j)=>j!==i)) }
  function setCaption(i:number, c:string){ onChange(photos.map((p,j)=> j===i? {...p, caption:c } : p)) }

  return (
    <div className="thumbs">
      {!photos.length && <div className="empty">Nenhuma foto adicionada.</div>}
      {photos.map((p,i)=>(
        <figure key={i} className="thumb">
          <img src={p.url} alt={p.name ?? `photo-${i}`} />
          <figcaption>
            <select value={p.caption || ''} onChange={e=>setCaption(i, e.target.value)} className="small">
              <option value="">Legenda</option>
              <option>hábito</option><option>folha</option><option>casca</option>
              <option>flor</option><option>fruto</option><option>semente</option>
              <option>detalhe</option>
            </select>
            <button className="btn tiny danger" onClick={()=>removeAt(i)}>Apagar</button>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
