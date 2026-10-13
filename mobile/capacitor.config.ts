import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The store binary is this device UI.
 * Do not set `server.url` to https://www.dotheimpossible.ai.
 * A remote url would ship a website wrapper, which App Store guideline 4.2 rejects.
 * The school site is opened on purpose, after a parent gate, from the School screen.
 */
const config: CapacitorConfig = {
  appId: "ai.dotheimpossible.vkole",
  appName: "Do the Impossible",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#2c5e4a",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
