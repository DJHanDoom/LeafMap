// src/storage.ts
import { get as idbGet, set as idbSet } from 'idb-keyval';

// Mantemos um único array de registros sob uma chave fixa no IndexedDB.
const DB_KEY = 'nervura:records:v1';

export type ID = string;

export interface PhotoRef {
  id: string;
  uri: string;        // caminho/URL da foto
  caption?: string;   // legenda opcional
  exifDate?: string;  // ISO
  exifLat?: number;
  exifLng?: number;
}

export interface Morphology {
  lifeForm?: string;
  flowers?: string;
  flowersNote?: string;
  fruits?: string;
  fruitsNote?: string;
  health?: string;
  leafType?: string;
  leafMargin?: string;
  phyllotaxis?: string;
  venation?: string;
  [k: string]: unknown;
}

export interface TreeRecord {
  id: ID;                    // UUID/string
  createdAt: string;         // ISO
  updatedAt?: string;        // ISO
  popularName?: string;
  sciName?: string;          // Nome científico completo
  family?: string;           // Família (auto)
  lat: number;
  lng: number;
  source?: 'exif' | 'manual';
  photos: PhotoRef[];
  morphology?: Morphology;
  notes?: string;
}

/** Carrega todos os registros (ou [] se vazio) */
export async function loadAll(): Promise<TreeRecord[]> {
  const data = (await idbGet(DB_KEY)) as TreeRecord[] | undefined;
  if (!Array.isArray(data)) return [];
  // Defesa contra dados malformados
  return data.filter(Boolean);
}

/** Salva (insere/substitui) UM registro por id */
export async function saveOne(rec: TreeRecord): Promise<void> {
  const all = await loadAll();
  const i = all.findIndex(r => r.id === rec.id);
  const now = new Date().toISOString();
  if (i >= 0) {
    all[i] = { ...all[i], ...rec, updatedAt: now };
  } else {
    all.push({ ...rec, createdAt: rec.createdAt ?? now, updatedAt: now });
  }
  await idbSet(DB_KEY, all);
}

/** Obtém um registro por id (ou undefined) */
export async function getOne(id: ID): Promise<TreeRecord | undefined> {
  const all = await loadAll();
  return all.find(r => r.id === id);
}

/** Remove um registro por id */
export async function removeOne(id: ID): Promise<void> {
  const all = await loadAll();
  const filtered = all.filter(r => r.id !== id);
  await idbSet(DB_KEY, filtered);
}

/** Limpa TODOS os registros */
export async function wipeAll(): Promise<void> {
  await idbSet(DB_KEY, []);
}

/**
 * upsertMany: insere/atualiza em lote.
 * - Se o id já existir: mescla e atualiza updatedAt.
 * - Se não existir: insere com createdAt/updatedAt.
 * - `preferNewFields`: se true, campos do novo registro
 *   prevalecem sobre os existentes (default = true).
 */
export async function upsertMany(
  incoming: TreeRecord[],
  preferNewFields = true
): Promise<void> {
  if (!Array.isArray(incoming) || incoming.length === 0) return;

  const map = new Map<string, TreeRecord>();
  const existing = await loadAll();
  const now = new Date().toISOString();

  // indexa existentes
  for (const r of existing) {
    if (r && r.id) map.set(r.id, r);
  }

  for (const rec of incoming) {
    if (!rec || !rec.id) continue;

    const prev = map.get(rec.id);
    if (prev) {
      // Mescla raso, preservando arrays/objetos simples
      const merged: TreeRecord = {
        ...prev,
        ...(preferNewFields ? rec : {}),
        // Merge leve de campos compostos quando ambos existem
        morphology: {
          ...(prev.morphology ?? {}),
          ...(rec.morphology ?? {}),
        },
        photos: Array.isArray(rec.photos) && rec.photos.length > 0
          ? rec.photos
          : prev.photos ?? [],
        updatedAt: now,
      };
      map.set(rec.id, merged);
    } else {
      map.set(rec.id, {
        ...rec,
        createdAt: rec.createdAt ?? now,
        updatedAt: now,
      });
    }
  }

  await idbSet(DB_KEY, Array.from(map.values()));
}
