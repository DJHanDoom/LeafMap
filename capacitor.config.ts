import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.diogo.trees',            // mantenho o mesmo appId (pacote). Se quiser mudar, me diga.
  appName: 'NervuraColetora',             // <- nome que aparece no celular
  webDir: 'dist',
  bundledWebRuntime: false
};

export default config;
