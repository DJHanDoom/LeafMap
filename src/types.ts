export type LatLng = { lat: number; lng: number }
export type LifeForm = 'árvore' | 'arbusto' | 'erva' | 'trepadeira' | 'cipó' | 'epífita' | 'palmeira' | 'samambaia'

export type PhotoRef = { url: string; name?: string; caption?: string }

export type Morphology = {
  formaVida?: LifeForm | string
  flores?: string
  flores_desc?: string
  frutos?: string
  frutos_desc?: string
  saude?: string

  folha__tipo?: string
  folha__margem?: string
  folha__filotaxia?: string
  folha__nervacao?: string
  estipulas?: string
  indumento?: string
  casca?: string

  cap_cm?: number
  altura_m?: number
  obs?: string

  custom?: string
}

export type TreeRecord = {
  id: string
  position: LatLng
  commonName?: string
  scientificName?: string
  family?: string
  morphology?: Morphology
  photos?: PhotoRef[]
  createdAt: string
  updatedAt: string
}
