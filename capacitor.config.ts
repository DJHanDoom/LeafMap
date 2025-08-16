import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.diogo.nervura',     // seu pacote Android (pode manter esse)
  appName: 'NervuraColetora',        // nome exibido no celular
  webDir: 'dist',                    // gerado pelo vite build
  bundledWebRuntime: false
};

export default config;
