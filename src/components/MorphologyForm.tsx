import type { Morphology, LifeForm } from '../types'

const VIDA: LifeForm[] = ['arvore','arbusto','erva','cipo','epifita','palmeira','liana','outra']

export default function MorphologyForm({ value, onChange }: { value: Morphology; onChange: (m: Morphology) => void }) {
  const v = value || {}
  const set = <K extends keyof Morphology>(k: K, val: Morphology[K]) => onChange({ ...v, [k]: val })

  return (
    <div className="card">
      <label>Características morfológicas</label>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <div>
          <label>Forma de vida</label>
          <select value={(v.formaVida as string) ?? ''} onChange={e => set('formaVida', e.target.value)}>
            <option value="">—</option>
            {VIDA.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div>
          <label>Flores</label>
          <select
            value={v.floresPresenca ? 'sim' : (v.floresPresenca === false ? 'nao' : '')}
            onChange={e => set('floresPresenca', e.target.value === 'sim')}
          >
            <option value="">—</option>
            <option value="sim">Presente</option>
            <option value="nao">Ausente</option>
          </select>
          <input
            placeholder="Descrição/cor/estágio"
            value={v.floresDescricao ?? ''}
            onChange={e => set('floresDescricao', e.target.value)}
          />
        </div>

        <div>
          <label>Frutos</label>
          <select
            value={v.frutosPresenca ? 'sim' : (v.frutosPresenca === false ? 'nao' : '')}
            onChange={e => set('frutosPresenca', e.target.value === 'sim')}
          >
            <option value="">—</option>
            <option value="sim">Presente</option>
            <option value="nao">Ausente</option>
          </select>
          <input
            placeholder="Descrição/estágio"
            value={v.frutosDescricao ?? ''}
            onChange={e => set('frutosDescricao', e.target.value)}
          />
        </div>

        <div>
          <label>Saúde</label>
          <select value={v.saude ?? ''} onChange={e => set('saude', e.target.value)}>
            <option value="">—</option>
            <option value="saudavel">Saudável</option>
            <option value="regular">Regular</option>
            <option value="debilitado">Debilitado</option>
            <option value="morto">Morto</option>
          </select>
        </div>

        <div>
          <label>CAP (cm)</label>
          <input
            inputMode="decimal"
            placeholder="ex.: 45"
            value={v.cap_cm ?? ''}
            onChange={e => set('cap_cm', Number(e.target.value || 0))}
          />
        </div>

        <div>
          <label>Altura (m)</label>
          <input
            inputMode="decimal"
            placeholder="ex.: 8"
            value={v.altura_m ?? ''}
            onChange={e => set('altura_m', Number(e.target.value || 0))}
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label>Observações</label>
          <textarea
            rows={3}
            placeholder="Anotações adicionais"
            value={v.observacoesLivres ?? ''}
            onChange={e => set('observacoesLivres', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
