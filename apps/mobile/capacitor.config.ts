import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "pk.raahi.app",
  appName: "Raahi",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0F1A",
    buildOptions: {
      // Signing is configured via android/keystore.properties (see DEPLOY.md)
    },
  },
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0B0F1A",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0B0F1A",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_raahi",
      iconColor: "#10B981",
    },
    CapacitorHttp: { enabled: false },
  },
};

export default config;
