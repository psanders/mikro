/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { ExpoConfig, ConfigContext } from "expo/config";

// Props for react-native-nitro-screen-recorder's plugin. On iOS, the plugin
// is PATCHED (see patches/react-native-nitro-screen-recorder+0.7.0.patch) to
// skip its BroadcastExtension target entirely — we only ever call
// `startInAppRecording`/`stopInAppRecording` on iOS (Android is the platform
// that needs `startGlobalRecording`, since MediaProjection has no in-app-only
// mode), so the extension, its App Group entitlement, and the EAS
// managed-credentials wiring the library does for it are all unused weight.
// Building the extension anyway hit an unresolved upstream EAS bug
// (expo/expo#40851): the BroadcastExtension target's provisioning profile
// never picked up the App Group, and neither a manual `withEasManagedCredentials`
// plugin entry nor credential regeneration fixed it for other reporters
// either (2026-07-04). Not creating the extension at all sidesteps the bug
// rather than fighting it. Android is unaffected by any of this — the patch
// only touches the iOS plugin chain.
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
    // No camera overlay needed, so camera permission stays off. See
    // screenRecorderPluginProps comment above for why iOS's BroadcastExtension
    // is patched out; Android still gets its full global-recording setup
    // (permissions, service, MainActivity changes) from this same plugin
    // entry — see design.md's platform-asymmetry note.
    ["react-native-nitro-screen-recorder", screenRecorderPluginProps]
  ],
  extra: {
    storybookEnabled: process.env.STORYBOOK_ENABLED === "true",
    eas: {
      projectId: "6b8784e8-d267-4d11-924b-2dbd9a388abd"
    }
  }
});
