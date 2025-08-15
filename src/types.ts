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
  caption?: string // legenda básica
}

export type Morphology = {
  filotaxia?: 'alternas' | 'opostas' | 'verticiladas' | 'subopostas'
  tipoFoliar?: 'simples' | 'imparipinada' | 'paripinada' | 'trifoliolada' | 'unifoliolada'
  margem?: 'inteira' | 'serrada' | 'dentada' | 'lobada' | 'ondulada' | 'crenada'
  venacao?: 'pinnada' | 'palmada' | 'broquidodroma' | 'campilodroma' | 'eucamptodroma'
  estipulas?: 'ausentes' | 'presentes' | 'espinescentes' | 'caducas' | 'persistentes'
  armaduraRamo?: 'ausente' | 'aculeos' | 'espinhos' | 'estípulas-espinescentes'
  casca?: 'lisa' | 'fissurada' | 'escamosa' | 'descamante' | 'reticulada'
  exsudato?: 'ausente' | 'leitoso' | 'resinoso' | 'aquoso'
  // novos:
  formaVida?: LifeForm
  flores?: { presenca?: 'nao' | 'sim' | 'ind' ; descricao?: string }
  frutos?: { presenca?: 'nao' | 'sim' | 'ind' ; descricao?: string }
  saude?: 'boa' | 'regular' | 'ruim' | 'ind'
  cap_cm?: number | null   // CAP em cm
  altura_m?: number | null // altura em m
  camposPersonalizados?: Array<{ rotulo: string; valor: string }>
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
