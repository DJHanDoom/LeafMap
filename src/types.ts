export type LatLng = { lat: number; lng: number }

export type LifeForm =
  | 'arvore'
  | 'arbusto'
  | 'erva'
  | 'cipo'
  | 'epifita'
  | 'palmeira'
  | 'liana'
  | 'outra'

export type PhotoRef = {
  url: string
  name?: string
  caption?: string
}

export type Morphology = {
  formaVida?: LifeForm | string
  floresPresenca?: boolean
  floresDescricao?: string
  frutosPresenca?: boolean
  frutosDescricao?: string
  saude?: 'saudavel' | 'regular' | 'debilitado' | 'morto' | string
  cap_cm?: number
  altura_m?: number
  camposPersonalizaveis?: Record<string, string>
  observacoesLivres?: string
}

export type TreeRecord = {
  id: string
  position: LatLng
  commonName?: string
  scientificName?: string
  family?: string
  morphology: Morphology
  photos: PhotoRef[]
  createdAt: string
  updatedAt: string
}
