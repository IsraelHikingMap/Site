import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mapeak',
  appName: 'Mapeak',
  webDir: 'www',
  server: {
    errorPath: "/"
  },
  cordova: {
    preferences: {
      "OAuthScheme": "mapeak"
    }
  },
  plugins: {
    SystemBars: {
      insetsHandling: "disable"
    }
  },
  ios: {
    preferredContentMode: "mobile"
  }
};

export default config;
