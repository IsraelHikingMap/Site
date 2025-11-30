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
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: "Library/CapacitorDatabase"
    },
    GenericOAuth2: {
      android: {
        customScheme: "ihm"
      },
      ios: {
        customScheme: "ihm"
      }
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
