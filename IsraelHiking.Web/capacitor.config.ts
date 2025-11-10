import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'il.org.osm.israelhiking',
  appName: 'Israel Hiking Map',
  webDir: 'www',
  server: {
    iosScheme: "ionic",
    androidScheme: "http",
    errorPath: "/"
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
