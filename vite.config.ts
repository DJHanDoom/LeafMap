import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  optimizeDeps: {
    include: ['xlsx']        // garante pré-bundle no dev e ajuda o resolver
  },
  build: {
    rollupOptions: {
      // nada externo aqui; deixamos o Vite embutir o ESM
    }
  }
})
