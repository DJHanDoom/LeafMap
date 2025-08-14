import { get, set } from 'idb-keyval'
import type { TreeRecord } from './types'

const KEY = 'tree-registry:v1'

export async function loadAll(): Promise<TreeRecord[]> {
  return (await get<TreeRecord[]>(KEY)) ?? []
}

export async function saveOne(rec: TreeRecord) {
  const all = await loadAll()
  const idx = all.findIndex(r => r.id === rec.id)
  if (idx >= 0) all[idx] = rec
  else all.push(rec)
  await set(KEY, all)
}

export async function wipeAll() {
  await set(KEY, [])
}
