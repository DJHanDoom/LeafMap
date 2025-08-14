import type { Morphology } from '../types'

type Props = {
  value: Morphology
  onChange: (m: Morphology) => void
}

export default function MorphologyForm({ value, onChange }: Props) {
  const set = <K extends keyof Morphology>(k: K, v: Morphology[K]) =>
    onChange({ ...value, [k]: v })

  return (
    <div className="card">
      <label>Características morfológicas (campos controlados)</label>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <div>
          <label>Filotaxia</label>
          <select value={value.filotaxia ?? ''} onChange={e => set('filotaxia', e.target.value as any)}>
            <option value="">—</option>
            <option value="alternas">Alternas</option>
            <option value="opostas">Opostas</option>
            <option value="subopostas">Subopostas</option>
            <option value="verticiladas">Verticiladas</option>
          </select>
        </div>
        <div>
          <label>Tipo foliar</label>
          <select value={value.tipoFoliar ?? ''} onChange={e => set('tipoFoliar', e.target.value as any)}>
            <option value="">—</option>
            <option value="simples">Simples</option>
            <option value="imparipinada">Imparipinada</option>
            <option value="paripinada">Paripinada</option>
            <option value="trifoliolada">Trifoliolada</option>
            <option value="unifoliolada">Unifoliolada</option>
          </select>
        </div>
        <div>
          <label>Margem</label>
          <select value={value.margem ?? ''} onChange={e => set('margem', e.target.value as any)}>
            <option value="">—</option>
            <option value="inteira">Inteira</option>
            <option value="serrada">Serrada</option>
            <option value="dentada">Dentada</option>
            <option value="lobada">Lobada</option>
            <option value="ondulada">Ondulada</option>
            <option value="crenada">Crenada</option>
          </select>
        </div>
        <div>
          <label>Venação</label>
          <select value={value.venacao ?? ''} onChange={e => set('venacao', e.target.value as any)}>
            <option value="">—</option>
            <option value="pinnada">Pinnada</option>
            <option value="palmada">Palmada</option>
            <option value="broquidodroma">Broquidódroma</option>
            <option value="campilodroma">Campilódroma</option>
            <option value="eucamptodroma">Eucamptódroma</option>
          </select>
        </div>
        <div>
          <label>Estípulas</label>
          <select value={value.estipulas ?? ''} onChange={e => set('estipulas', e.target.value as any)}>
            <option value="">—</option>
            <option value="ausentes">Ausentes</option>
            <option value="presentes">Presentes</option>
            <option value="espinescentes">Espinescentes</option>
            <option value="caducas">Caducas</option>
            <option value="persistentes">Persistentes</option>
          </select>
        </div>
        <div>
          <label>Armadura do ramo</label>
          <select value={value.armaduraRamo ?? ''} onChange={e => set('armaduraRamo', e.target.value as any)}>
            <option value="">—</option>
            <option value="ausente">Ausente</option>
            <option value="aculeos">Acúleos</option>
            <option value="espinhos">Espinhos</option>
            <option value="estípulas-espinescentes">Estípulas espinescentes</option>
          </select>
        </div>
        <div>
          <label>Casca</label>
          <select value={value.casca ?? ''} onChange={e => set('casca', e.target.value as any)}>
            <option value="">—</option>
            <option value="lisa">Lisa</option>
            <option value="fissurada">Fissurada</option>
            <option value="escamosa">Escamosa</option>
            <option value="descamante">Descamante</option>
            <option value="reticulada">Reticulada</option>
          </select>
        </div>
        <div>
          <label>Exsudato</label>
          <select value={value.exsudato ?? ''} onChange={e => set('exsudato', e.target.value as any)}>
            <option value="">—</option>
            <option value="ausente">Ausente</option>
            <option value="leitoso">Leitoso</option>
            <option value="resinoso">Resinoso</option>
            <option value="aquoso">Aquoso</option>
          </select>
        </div>
      </div>
      <div>
        <label>Observações (livre)</label>
        <textarea
          rows={3}
          value={value.observacoesLivres ?? ''}
          onChange={e => set('observacoesLivres', e.target.value)}
        />
      </div>
    </div>
  )
}
