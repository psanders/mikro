/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { ExpoConfig, ConfigContext } from "expo/config";

// Props for react-native-nitro-screen-recorder's plugin. Note: the library's
// own iOS plugin chain (withScreenRecorder -> withBroadcastExtension) already
// calls its internal withEasManagedCredentials step itself — see
// node_modules/react-native-nitro-screen-recorder/lib/*/expo-plugin/ios/withBroadcastExtension.js
// — so `extra.eas.build.experimental.ios.appExtensions` for the
// BroadcastExtension target (incl. the group.do.mikro.app.screen-recorder App
// Group) is populated automatically on every prebuild. Do NOT add a second,
// manual `withEasManagedCredentials` plugin entry here: doing so produces a
// literal duplicate entry in the resolved appExtensions array (confirmed via
// `npx expo config --json`) without fixing anything — an EAS iOS build still
// failed with the same stale-provisioning-profile error after that was tried
// (2026-07-04). That failure is upstream EAS managed-credentials behavior,
// not a missing config plugin; see e.g. https://github.com/expo/expo/issues/40851.
const screenRecorderPluginProps = {
  enableCameraPermission: false,
  enableMicrophonePermission: true,
  microphonePermissionText:
    "Mikro necesita el micrófono para grabar reportes de problemas dentro de la app.",
  showPluginLogs: false
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Mikro",
  slug: "mikro",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "mikro",
  userInterfaceStyle: "light",
  runtimeVersion: {
    policy: "fingerprint"
  },
  updates: {
    url: "https://u.expo.dev/6b8784e8-d267-4d11-924b-2dbd9a388abd"
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "do.mikro.app",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSBluetoothAlwaysUsageDescription:
        "Mikro necesita Bluetooth para conectarse a la impresora térmica.",
      NSBluetoothPeripheralUsageDescription:
        "Mikro necesita Bluetooth para conectarse a la impresora térmica.",
      NSCameraUsageDescription: "Mikro necesita la cámara para fotografiar el contrato firmado.",
      NSMicrophoneUsageDescription:
        "Mikro necesita el micrófono para grabar reportes de problemas dentro de la app."
    }
  },
  android: {
    package: "do_.mikro.app",
    adaptiveIcon: {
      backgroundColor: "#103A8A",
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png"
    },
    permissions: [
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
      "android.permission.POST_NOTIFICATIONS"
    ]
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-local-authentication",
    "expo-sqlite",
    "expo-sharing",
    "expo-updates",
    [
      "expo-image-picker",
      {
        cameraPermission: "Mikro necesita la cámara para fotografiar el contrato firmado."
      }
    ],
    ["react-native-ble-plx", { isBackgroundEnabled: false, neverForLocation: true }],
    // Bug-report screen recording (mikro/#69, extend-bug-report-native-capture).
    // No camera overlay needed, so camera permission stays off. iOS uses
    // in-app-only recording at runtime (no broadcast extension APIs called),
    // but the plugin unconditionally sets up a BroadcastExtension target and
    // App Group entitlement on iOS regardless (incl. wiring EAS managed
    // credentials for that target internally — see screenRecorderPluginProps
    // comment above). Android only supports system-wide ("global") recording
    // via this library — see design.md's platform-asymmetry note.
    ["react-native-nitro-screen-recorder", screenRecorderPluginProps]
  ],
  extra: {
    storybookEnabled: process.env.STORYBOOK_ENABLED === "true",
    eas: {
      projectId: "6b8784e8-d267-4d11-924b-2dbd9a388abd"
    }
  }
});
