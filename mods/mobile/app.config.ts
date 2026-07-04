/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { ExpoConfig, ConfigContext } from "expo/config";
// Deep import: react-native-nitro-screen-recorder's `app.plugin.js` only
// wires its main `withScreenRecorder` plugin, NOT this one — despite the
// library needing it. Without this, EAS Build's managed credentials never
// register the `group.do.mikro.app.screen-recorder` App Group for the
// BroadcastExtension target, and the build fails with "Provisioning profile
// ... doesn't support the group.do.mikro.app.screen-recorder App Group"
// (hit for real on an EAS iOS build, 2026-07-04). Pinned to an exact package
// version (see package.json) since this path isn't part of the package's
// public API and could move on a routine bump.
import { withEasManagedCredentials } from "react-native-nitro-screen-recorder/lib/typescript/expo-plugin/ios/withEasManagedCredentials";

// Shared between the main plugin entry and withEasManagedCredentials below —
// both need the exact same props to derive the same App Group / extension
// bundle identifier (see the library's iosConstants.js defaults).
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
    // App Group entitlement on iOS regardless — hence withEasManagedCredentials
    // below, so EAS Build actually provisions for it. Android only supports
    // system-wide ("global") recording via this library — see design.md's
    // platform-asymmetry note.
    ["react-native-nitro-screen-recorder", screenRecorderPluginProps],
    // @expo/config-types' `plugins` type only declares `string | [string, any]`
    // entries, even though Expo's actual runtime resolver (@expo/config-plugins)
    // supports passing a plugin function directly — a known gap between the
    // types and reality, not a mistake here.
    [withEasManagedCredentials, screenRecorderPluginProps] as unknown as [string, object]
  ],
  extra: {
    storybookEnabled: process.env.STORYBOOK_ENABLED === "true",
    eas: {
      projectId: "6b8784e8-d267-4d11-924b-2dbd9a388abd"
    }
  }
});
