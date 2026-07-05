## MODIFIED Requirements

### Requirement: Tauri native screenshot via ScreenCaptureKit

The dashboard Tauri desktop build SHALL capture a screenshot for feedback using a native
plugin backed by ScreenCaptureKit, instead of grabbing a frame from a `getDisplayMedia`
stream, which WKWebView doesn't support.

#### Scenario: Starting a recording in the Tauri build

- **WHEN** a user in the Tauri desktop build clicks the feedback (message) icon, accepts
  consent, and clicks "Empezar a grabar"
- **THEN** the app captures a screenshot via the native `start_feedback_recording`
  command and starts a mic-only recording via the existing `getUserMedia` path, without the
  `undefined is not an object` error previously seen from calling
  `navigator.mediaDevices.getDisplayMedia`

#### Scenario: Submitting a Tauri feedback recording

- **WHEN** a Tauri recording is stopped
- **THEN** the app submits the mic audio recording and the native screenshot to
  `submitFeedback`, matching the payload shape the web client uses (the video field carries
  audio content, since the server only ever uses it for transcription)

#### Scenario: macOS Screen Recording permission not granted

- **WHEN** a user starts a Tauri recording without having granted macOS Screen Recording
  permission to the app
- **THEN** the app surfaces a clear error in the existing error stage of the feedback dialog
  (not a silent failure or unhandled exception), explaining that Screen Recording permission
  is required
