import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mapeak',
  appName: 'Mapeak',
  webDir: 'www',
  server: {
    iosScheme: "ionic",
    androidScheme: "http"
  },
  cordova: {
    preferences: {
      "OAuthScheme": "ihm"
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
