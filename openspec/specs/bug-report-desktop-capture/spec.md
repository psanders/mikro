# bug-report-desktop-capture

## Purpose

Covers screen/screenshot capture for the in-app feedback feature (mikro/#69) on the dashboard's Tauri desktop build, where WKWebView doesn't implement the browser `getDisplayMedia` API that the web build relies on.

## Requirements

### Requirement: Tauri native screenshot via ScreenCaptureKit

The dashboard Tauri desktop build SHALL capture a screenshot for feedback using a native plugin backed by ScreenCaptureKit, instead of grabbing a frame from a `getDisplayMedia` stream, which WKWebView doesn't support.

#### Scenario: Starting a recording in the Tauri build

- **WHEN** a user in the Tauri desktop build clicks the feedback (message) icon, accepts consent, and clicks "Empezar a grabar"
- **THEN** the app captures a screenshot via the native `start_feedback_recording` command and starts a mic-only recording via the existing `getUserMedia` path, without the `undefined is not an object` error previously seen from calling `navigator.mediaDevices.getDisplayMedia`

#### Scenario: Submitting a Tauri feedback recording

- **WHEN** a Tauri recording is stopped
- **THEN** the app submits the mic audio recording and the native screenshot to `submitFeedback`, matching the payload shape the web client uses (the video field carries audio content, since the server only ever uses it for transcription)

#### Scenario: macOS Screen Recording permission not granted

- **WHEN** a user starts a Tauri recording without having granted macOS Screen Recording permission to the app
- **THEN** the app surfaces a clear error in the existing error stage of the feedback dialog (not a silent failure or unhandled exception), explaining that Screen Recording permission is required

### Requirement: Web and Windows Tauri capture path unaffected

The existing browser-based capture path SHALL remain unchanged for any runtime where `getDisplayMedia` is available — the regular web build and Windows Tauri builds (WebView2 supports it; this gap is macOS/WebKit-specific).

#### Scenario: Web or Windows Tauri build still uses getDisplayMedia

- **WHEN** the dashboard is running somewhere `navigator.mediaDevices.getDisplayMedia` exists
- **THEN** it continues to use `getDisplayMedia` and `getUserMedia` exactly as shipped in PR #75, without invoking the native Tauri screenshot command
