import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digimood.app',
  appName: 'DigiMood',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#1e1e1e',
    statusBarStyle: 'TRANSPARENT',
    navigationColor: '#1e1e1e',
  },
};

export default config;
