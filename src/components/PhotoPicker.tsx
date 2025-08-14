type Props = {
  onFirstPhoto: (file: File) => void
  onMorePhotos: (files: File[]) => void
}

export default function PhotoPicker({ onFirstPhoto, onMorePhotos }: Props) {
  return (
    <div className="card">
      <div>
        <label>Foto inicial</label>
        <input type="file" accept="image/*" capture="environment"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onFirstPhoto(f)
          }} />
      </div>
      <div>
        <label>Fotos adicionais</label>
        <input type="file" accept="image/*" multiple
          onChange={e => {
            const fs = Array.from(e.target.files ?? [])
            if (fs.length) onMorePhotos(fs)
          }} />
      </div>
    </div>
  )
}
