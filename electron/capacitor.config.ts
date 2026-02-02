import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jbcom.stellardescent',
  appName: 'Stellar Descent',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    ScreenOrientation: {
      // Lock to landscape for the game
    },
    CapacitorSQLite: {
      // iOS database location
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      // Enable encryption on iOS/Android for secure save data
      iosIsEncryption: false,
      androidIsEncryption: false,
      // Use biometric authentication for encryption (optional)
      iosBiometric: {
        biometricAuth: false,
      },
      // Disable readonly (we need read/write access)
      readonly: false,
    },
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  electron: {
    // Electron desktop app configuration
    backgroundColor: '#000000',
    splashScreenEnabled: false,
    trayIconAndMenuEnabled: false,
    hideMainWindowOnLaunch: false,
    deepLinkingEnabled: false,
  },
};

export default config;
