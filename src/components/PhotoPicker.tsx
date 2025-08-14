type Props = {
  onFirstPhoto: (file: File) => void
  onMorePhotos: (files: File[]) => void
}

export default function PhotoPicker({ onFirstPhoto, onMorePhotos }: Props) {
  return (
    <div className="card">
      <div>
        <label>Foto inicial (usa EXIF/GPS)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onFirstPhoto(f)
            if (e.target) (e.target as HTMLInputElement).value = ''
          }}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>Fotos adicionais</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={e => {
            const fs = Array.from(e.target.files ?? [])
            if (fs.length) onMorePhotos(fs)
            if (e.target) (e.target as HTMLInputElement).value = ''
          }}
        />
      </div>
    </div>
  )
}
