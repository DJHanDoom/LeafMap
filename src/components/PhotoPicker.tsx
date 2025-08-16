export default function PhotoPicker({
  onCamera, onGallery
}: {
  onCamera: (file: File) => void
  onGallery: (files: File[]) => void
}) {
  return (
    <div className="row gap">
      {/* câmera */}
      <label className="btn primary">
        Abrir Câmera
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onCamera(f)
            e.currentTarget.value = ''
          }}
        />
      </label>

      {/* galeria */}
      <label className="btn primary soft">
        Escolher da Galeria
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const fs = e.target.files ? Array.from(e.target.files) : []
            if (fs.length) onGallery(fs)
            e.currentTarget.value = ''
          }}
        />
      </label>
    </div>
  )
}
