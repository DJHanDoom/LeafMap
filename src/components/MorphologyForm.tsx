import type { Morphology } from '../types'

const opt = (arr:string[]) => arr.map(v => <option key={v} value={v}>{v}</option>)

export default function MorphologyForm({ value, onChange }: {
  value: Morphology
  onChange: (m: Morphology) => void
}) {
  const up = (k: keyof Morphology) => (e:any) => onChange({ ...value, [k]: e.target.value })
  const upNum = (k: keyof Morphology) => (e:any) => {
    const v = e.target.value
    onChange({ ...value, [k]: v === '' ? undefined : Number(v) })
  }

  return (
    <div className="form-grid">
      <div className="form-field">
        <label>Forma de vida</label>
        <select value={value.formaVida || ''} onChange={up('formaVida')}>
          <option value="">—</option>
          {opt(['árvore','arbusto','erva','trepadeira','cipó','epífita','palmeira','samambaia'])}
        </select>
      </div>

      <div className="form-field">
        <label>Flores</label>
        <select value={value.flores || ''} onChange={up('flores')}>
          <option value="">—</option>
          {opt(['ausentes','brotos','abertas','murchas'])}
        </select>
        <input placeholder="Descrição/cor/estágio" value={value.flores_desc||''} onChange={up('flores_desc')} />
      </div>

      <div className="form-field">
        <label>Frutos</label>
        <select value={value.frutos || ''} onChange={up('frutos')}>
          <option value="">—</option>
          {opt(['ausentes','imaturos','maduros','secos'])}
        </select>
        <input placeholder="Descrição/estágio" value={value.frutos_desc||''} onChange={up('frutos_desc')} />
      </div>

      <div className="form-field">
        <label>Saúde</label>
        <select value={value.saude || ''} onChange={up('saude')}>
          <option value="">—</option>
          {opt(['boa','regular','ruim'])}
        </select>
      </div>

      {/* Botânica detalhada */}
      <div className="form-field">
        <label>Folha — tipo</label>
        <select value={value.folha__tipo || ''} onChange={up('folha__tipo')}>
          <option value="">—</option>
          {opt(['simples','composta pinada','composta palmada','bifurcada','acicular','escamosa'])}
        </select>
      </div>

      <div className="form-field">
        <label>Folha — margem</label>
        <select value={value.folha__margem || ''} onChange={up('folha__margem')}>
          <option value="">—</option>
          {opt(['inteira','serrada','denteada','ondulada','lobada','crenada'])}
        </select>
      </div>

      <div className="form-field">
        <label>Folha — filotaxia</label>
        <select value={value.folha__filotaxia || ''} onChange={up('folha__filotaxia')}>
          <option value="">—</option>
          {opt(['alterna','oposta','verticilada','basal'])}
        </select>
      </div>

      <div className="form-field">
        <label>Folha — nervação</label>
        <select value={value.folha__nervacao || ''} onChange={up('folha__nervacao')}>
          <option value="">—</option>
          {opt(['pinnada','palmada','paralela','reticulada'])}
        </select>
      </div>

      <div className="form-field">
        <label>Estípulas</label>
        <select value={value.estipulas || ''} onChange={up('estipulas')}>
          <option value="">—</option>
          {opt(['ausentes','presentes caducas','presentes persistentes'])}
        </select>
      </div>

      <div className="form-field">
        <label>Indumento</label>
        <select value={value.indumento || ''} onChange={up('indumento')}>
          <option value="">—</option>
          {opt(['glabra','pubescente','tomentosa','hirsuta'])}
        </select>
      </div>

      <div className="form-field">
        <label>Casca</label>
        <select value={value.casca || ''} onChange={up('casca')}>
          <option value="">—</option>
          {opt(['lisa','fissurada','escamosa','corticosa'])}
        </select>
      </div>

      <div className="form-field">
        <label>CAP (cm)</label>
        <input type="number" inputMode="numeric" placeholder="ex.: 45" value={value.cap_cm ?? ''}
               onChange={upNum('cap_cm')} />
      </div>

      <div className="form-field">
        <label>Altura (m)</label>
        <input type="number" inputMode="numeric" placeholder="ex.: 8" value={value.altura_m ?? ''}
               onChange={upNum('altura_m')} />
      </div>

      <div className="form-field full">
        <label>Observações</label>
        <textarea placeholder="Anotações adicionais" value={value.obs || ''} onChange={up('obs')} />
      </div>

      {/* Campos personalizados (pares simples nome:valor) */}
      <div className="form-field full">
        <label>Campo personalizado</label>
        <input
          placeholder="nome: valor (ex.: látex: leitoso)"
          value={value.custom || ''}
          onChange={up('custom')}
        />
      </div>
    </div>
  )
}
