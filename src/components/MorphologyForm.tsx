import type { Morphology, LifeForm } from '../types'

const lifeOptions: { key: LifeForm; label: string }[] = [
  { key: 'arvore', label: 'Árvore' },
  { key: 'arbusto', label: 'Arbusto' },
  { key: 'erva', label: 'Erva' },
  { key: 'cipo', label: 'Cipó' },
  { key: 'epifita', label: 'Epífita' },
  { key: 'palmeira', label: 'Palmeira' },
  { key: 'liana', label: 'Liana' },
  { key: 'outra', label: 'Outra' }
]

type Props = {
  value: Morphology
  onChange: (m: Morphology) => void
}

export default function MorphologyForm({ value, onChange }: Props) {
  const set = <K extends keyof Morphology>(k: K, v: Morphology[K]) =>
    onChange({ ...value, [k]: v })

  function setCustom(i: number, rotulo: string, valor: string) {
    const list = value.camposPersonalizados ? [...value.camposPersonalizados] : []
    list[i] = { rotulo, valor }
    set('camposPersonalizados', list)
  }

  function addCustom() {
    const list = value.camposPersonalizados ? [...value.camposPersonalizados] : []
    list.push({ rotulo: '', valor: '' })
    set('camposPersonalizados', list)
  }

  function removeCustom(i: number) {
    const list = (value.camposPersonalizados ?? []).slice(0, i).concat((value.camposPersonalizados ?? []).slice(i + 1))
    set('camposPersonalizados', list)
  }

  return (
    <div className="card">
      <label>Características morfológicas</label>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <div>
          <label>Forma de vida</label>
          <select
            value={value.formaVida ?? ''}
            onChange={e => set('formaVida', e.target.value as LifeForm)}
          >
            <option value="">—</option>
            {lifeOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

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

        <div>
          <label>Flores</label>
          <select
            value={value.flores?.presenca ?? ''}
            onChange={e => set('flores', { ...(value.flores ?? {}), presenca: e.target.value as any })}
          >
            <option value="">—</option>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
            <option value="ind">Indeterminado</option>
          </select>
          <input
            placeholder="Características (cor, tipo, posição...)"
            value={value.flores?.descricao ?? ''}
            onChange={e => set('flores', { ...(value.flores ?? {}), descricao: e.target.value })}
          />
        </div>

        <div>
          <label>Frutos</label>
          <select
            value={value.frutos?.presenca ?? ''}
            onChange={e => set('frutos', { ...(value.frutos ?? {}), presenca: e.target.value as any })}
          >
            <option value="">—</option>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
            <option value="ind">Indeterminado</option>
          </select>
          <input
            placeholder="Características (tipo, cor, deiscência...)"
            value={value.frutos?.descricao ?? ''}
            onChange={e => set('frutos', { ...(value.frutos ?? {}), descricao: e.target.value })}
          />
        </div>

        <div>
          <label>Saúde</label>
          <select value={value.saude ?? ''} onChange={e => set('saude', e.target.value as any)}>
            <option value="">—</option>
            <option value="boa">Boa</option>
            <option value="regular">Regular</option>
            <option value="ruim">Ruim</option>
            <option value="ind">Indeterminado</option>
          </select>
        </div>

        <div>
          <label>CAP (cm)</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="ex.: 120"
            value={value.cap_cm ?? ''}
            onChange={e => set('cap_cm', e.target.value ? Number(e.target.value) : null)}
          />
        </div>

        <div>
          <label>Altura (m)</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="ex.: 8.5"
            value={value.altura_m ?? ''}
            onChange={e => set('altura_m', e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label>Campos personalizados</label>
        {(value.camposPersonalizados ?? []).map((c, i) => (
          <div key={i} className="row">
            <input placeholder="Rótulo" value={c.rotulo} onChange={e => setCustom(i, e.target.value, c.valor)} />
            <input placeholder="Valor" value={c.valor} onChange={e => setCustom(i, c.rotulo, e.target.value)} />
            <button className="danger" onClick={() => removeCustom(i)}>Remover</button>
          </div>
        ))}
        <button onClick={addCustom}>+ Adicionar campo</button>
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
