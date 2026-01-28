import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mapeak',
  appName: 'Mapeak',
  webDir: 'www',
  server: {
    errorPath: "/"
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: false,
        facebook: false,
        apple: false,
        twitter: false,
        oauth2: true
      }
    },
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
