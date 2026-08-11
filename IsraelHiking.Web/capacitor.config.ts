import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mapeak',
  appName: 'Mapeak',
  webDir: 'www',
  server: {
    errorPath: "/"
  },
  ios: {
    preferredContentMode: "mobile"
  },
  android: {},
  plugins: {
    CapacitorShareTarget: {
      appGroupId: "group.com.mapeak"
    }
  }
};

export default config;
