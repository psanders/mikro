/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Mikro",
  slug: "mikro",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "mikro",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "do.mikro.app",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    package: "do_.mikro.app",
    adaptiveIcon: {
      backgroundColor: "#103A8A",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png"
    }
  },
  plugins: ["expo-router", "expo-secure-store", "expo-local-authentication"],
  extra: {
    storybookEnabled: process.env.STORYBOOK_ENABLED === "true",
    eas: {
      projectId: "6b8784e8-d267-4d11-924b-2dbd9a388abd"
    }
  }
});
