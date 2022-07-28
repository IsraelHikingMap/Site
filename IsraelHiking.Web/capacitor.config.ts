import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'il.org.osm.israelhiking',
  appName: 'Israel Hiking Map',
  webDir: 'www',
  bundledWebRuntime: false,
  ios: {
    contentInset: "always"
  }
};

export default config;
