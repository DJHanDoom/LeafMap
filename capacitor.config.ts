import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.diogo.trees',
  appName: 'Tree Registry',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' }
}

export default config
