import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mapeak',
  appName: 'Mapeak',
  webDir: 'www',
  server: {
    errorPath: "/"
  },
  plugins: {
    SystemBars: {
      insetsHandling: "disable"
    }
  },
  ios: {
    preferredContentMode: "mobile"
  },
  android: {}
};

export default config;
