type Props = {
  onCamera: (file: File) => void
  onGallery: (files: File[]) => void
}

export default function PhotoPicker({ onCamera, onGallery }: Props) {
  return (
    <div className="card">
      <label>Fotos</label>
      <div className="row">
        <div>
          <button
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.capture = 'environment'
              input.onchange = e => {
                const f = (e.target as HTMLInputElement).files?.[0]
                if (f) onCamera(f)
              }
              input.click()
            }}
          >
            Tirar foto (Câmera)
          </button>
        </div>
        <div>
          <button
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.multiple = true
              input.onchange = e => {
                const fs = Array.from((e.target as HTMLInputElement).files ?? [])
                if (fs.length) onGallery(fs)
              }
              input.click()
            }}
          >
            Escolher da Galeria
          </button>
        </div>
      </div>
      <small>Dica: use a câmera para capturar EXIF/GPS quando disponível.</small>
    </div>
  )
}
