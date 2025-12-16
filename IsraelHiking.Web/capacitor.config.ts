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
    CapacitorSQLite: {
      iosDatabaseLocation: "Library/CapacitorDatabase"
    }
  },
  ios: {
    preferredContentMode: "mobile"
  },
  android: {
    adjustMarginsForEdgeToEdge: 'auto'
  }
};

export default config;
