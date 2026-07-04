## ADDED Requirements

### Requirement: Mobile bug-report entry point

The mobile app SHALL provide a bug-report entry point in the profile tab, since no such entry point exists today on mobile.

#### Scenario: Discovering the entry point

- **WHEN** a mobile user opens the profile tab (`perfil.tsx`)
- **THEN** they see a bug-report row/icon consistent with existing account-action patterns on that screen

### Requirement: Native screen and mic recording on mobile

The mobile app SHALL capture screen video and microphone audio natively when a user records a bug report, since React Native has no browser-equivalent capture APIs. On iOS this is in-app-only (`startInAppRecording`); on Android it is system-wide (`startGlobalRecording`), since Android's `MediaProjection` API has no in-app-only capture mode.

#### Scenario: Starting a mobile recording

- **WHEN** a mobile user taps the bug-report entry point, sees the consent notice, and confirms
- **THEN** the app starts screen recording plus microphone capture via the native screen-recorder module (`enableMic: true`), and the consent screen is replaced by a floating recording indicator rather than a blocking screen

#### Scenario: Navigating the app while recording

- **WHEN** a mobile recording is in progress
- **THEN** the user can freely navigate to any other screen in the app while recording continues, since the recording UI is a small floating pill (not a full-screen modal) and does not block interaction with the rest of the app

#### Scenario: Android recording captures outside the app

- **WHEN** an Android user switches away from the app (another app, a notification) while a recording is in progress
- **THEN** that content is captured too, since Android has no in-app-only recording mode — the consent notice on Android explicitly says so before recording starts, unlike iOS where only the app's own content is ever captured

#### Scenario: Stopping and submitting a mobile recording

- **WHEN** a mobile user taps the stop control on the floating recording pill, from whichever screen they've navigated to
- **THEN** the app reads the resulting `ScreenRecordingFile` (a local file path) via `expo-file-system`, base64-encodes it, and submits it plus a still-frame screenshot to the existing `submitBugReport` mutation using the same payload shape the web client uses

#### Scenario: Consent required before recording

- **WHEN** a mobile user taps the bug-report entry point
- **THEN** a consent notice is shown before any recording starts, matching the web flow's consent step, with Android showing the additional system-wide-capture notice

### Requirement: Mobile native module survives prebuild

The native screen-recorder dependency and its Expo config plugin SHALL be compatible with the repo's `expo prebuild --platform all --no-install` CI check, since a broken config plugin has previously crashed the app at startup.

#### Scenario: CI prebuild check with the new dependency

- **WHEN** `expo prebuild --platform all --no-install` runs in CI after the native screen-recorder dependency and its config plugin are added
- **THEN** prebuild completes without error on all platforms

### Requirement: EAS dev client required for local testing

Testing the mobile bug-report feature SHALL require an EAS custom dev client build, since native screen-recording modules are not available in Expo Go.

#### Scenario: Attempting to use the feature in Expo Go

- **WHEN** a developer runs the app in Expo Go (not a custom dev client)
- **THEN** the bug-report feature is not expected to function, and this limitation is documented for the team rather than silently failing without explanation
