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
  },
  // The firebase plugins pull the firebase-ios-sdk swift package in under their own name, which
  // collides with the identity swift package manager derives for them; symlinking them is the
  // workaround capawesome documents for it - see capawesome-team/capacitor-firebase#959.
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          "@capacitor-firebase/analytics": {
            symlink: true
          }
        }
      }
    }
  }
};

export default config;
