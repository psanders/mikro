## Why

The in-app bug report feature (mikro/#69, shipped in PR #75) only works in the dashboard web build, wired into the founder-only `/founder` shell. Two gaps were confirmed by re-testing: the Tauri desktop build throws `undefined is not an object (evaluating 'navigator.mediaDevices.getDisplayMedia')` because WKWebView doesn't implement that browser API, and the mobile app has no bug-report entry point at all — `MediaRecorder`/`getDisplayMedia` don't exist in React Native regardless. Non-technical field users (evaluators, collectors) are exactly the audience this feature was meant to serve, and they're on mobile — the gap defeats the original motivation.

## What Changes

- Add a native Tauri Rust plugin (using Apple's ScreenCaptureKit via the `screencapturekit` crate) that captures screen frames on macOS and streams them to the dashboard frontend, replacing the unsupported `getDisplayMedia()` call in the Tauri build only (web build keeps using the browser API).
- Add a bug-report entry point to the mobile app's profile tab (`mods/mobile/app/perfil.tsx`), using `react-native-nitro-screen-recorder` (ReplayKit on iOS, MediaProjection on Android) for screen capture plus mic audio capture, reusing the same consent → record → stop → upload flow as the web version.
- Both new clients submit to the existing `submitBugReport` tRPC mutation unchanged — no server-side changes in scope.
- **BREAKING (workflow, not API)**: testing the mobile bug-report feature requires an EAS custom dev client build; it will not function in Expo Go, since native screen-recording modules require compiled native code.

## Capabilities

### New Capabilities

- `bug-report-desktop-capture`: Tauri-native screen capture (ScreenCaptureKit-backed) as the desktop-build equivalent of the browser `getDisplayMedia` flow, feeding the same consent/record/upload UX already shipped for web.
- `bug-report-mobile-capture`: mobile bug-report entry point (profile tab) with native screen + mic recording, structured issue submission, and EAS dev-client build requirement.

### Modified Capabilities

- none — no existing capability spec covers the web-only bug report feature (PR #75 shipped without an OpenSpec change), so both platform extensions land as net-new capabilities rather than deltas.

## Impact

- `mods/dashboard/src/components/BugReportButton.tsx`: branch capture implementation by runtime (browser `getDisplayMedia` vs. Tauri plugin bridge), no change to consent UI or upload payload shape.
- `mods/dashboard/src-tauri/`: new Rust plugin crate + `screencapturekit` dependency, IPC command(s) to stream captured frames to the frontend, Cargo.lock update.
- `mods/mobile/app/perfil.tsx`: new bug-report row/entry point matching existing account-action patterns; new screen/modal for consent → record → stop → upload states (mirrors web dialog).
- `mods/mobile/package.json`: new dependency `react-native-nitro-screen-recorder` + its Expo config plugin registered in `app.json`/`app.config.*`; verify `expo prebuild --platform all --no-install` still passes (a broken config plugin has crashed app startup before — the expo-print incident).
- `pencil.pen`: new mobile screen/component nodes for the profile-tab entry point and record/consent states (no existing design covers this).
- No changes to `mods/apiserver` — `submitBugReport` mutation and `createSubmitBugReport` are reused as-is.
- Root `package-lock.json` and `mods/dashboard/src-tauri/Cargo.lock` both need updating per AGENTS.md lockfile discipline; run `npm install` at repo root after any `package.json` edit.
- Mobile CI: `build-android.yaml` will start compiling real native screen-recorder code on every main push touching mobile; `pr-checks.yaml` mobile-checks (`expo prebuild --platform all --no-install`) is the pre-merge gate for the new config plugin.
