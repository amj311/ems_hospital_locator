import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.simplyoliveapps.beacon',
  appName: 'Beacon',
  webDir: 'dist',
  server: {
    androidScheme: "http"
  }
};

export default config;
