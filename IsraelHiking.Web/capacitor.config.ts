import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'il.org.osm.israelhiking',
  appName: 'Israel Hiking Map',
  webDir: 'www',
  bundledWebRuntime: false,
  cordova: {
    preferences: {
      "OAuthScheme": "ihm"
    }
  },
  plugins: {
    CapacitorSQLite: {
      "iosDatabaseLocation": "Library/CapacitorDatabase"
    }
  },
  ios: {
    preferredContentMode: "mobile"
  }
};

export default config;
