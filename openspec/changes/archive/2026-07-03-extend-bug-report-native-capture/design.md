## Context

PR #75 shipped screen+mic bug recording for the dashboard web build only, using standard browser APIs (`getDisplayMedia` + `getUserMedia` + `MediaRecorder`) inside `BugReportButton.tsx`, wired only into the founder shell. Two runtimes can't use that code path at all:

- **Tauri (macOS dashboard build)**: WKWebView does not implement `getDisplayMedia` (open upstream issue tauri-apps/tauri#2338). `getUserMedia` for the mic already works there.
- **React Native (mobile)**: no `MediaRecorder`/`getDisplayMedia`/`getUserMedia` — screen and audio capture require native modules entirely.

The server side (`createSubmitBugReport`, `submitBugReport` mutation) is capture-source-agnostic — it accepts a video blob + screenshot + metadata and does the rest (transcribe, structure, file issue). Nothing there needs to change; this design is scoped to client-side capture plumbing on two new runtimes.

## Goals / Non-Goals

**Goals:**

- Full parity with the web capture flow (screen + mic + still frame) on both Tauri desktop and mobile, not a reduced fallback.
- Reuse the existing consent → record → stop → upload UX and the existing `submitBugReport` payload contract unchanged.
- Keep the two platform implementations isolated behind a capture-provider seam so `BugReportButton.tsx`'s state machine doesn't fork per platform.

**Non-Goals:**

- No server-side changes.
- No permanent screenshot-only/voice-only fallback on mobile (full native screen+mic capture there, evaluated and explicitly chosen by the user over a reduced fallback). Tauri is a deliberate, narrower exception: it ships native screenshot + existing mic audio now (not full muxed video) specifically because the server discards video today anyway — see Decision 1 — with full parity revisited alongside mikro#87.
- No system-wide screen recording BY CHOICE where an in-app-only option exists — but see Decision 3: Android's screen-recording library has no in-app-only mode at all (a fundamental `MediaProjection` API constraint, not a library gap), so Android bug reports use system-wide capture out of necessity, not preference. iOS stays in-app-only via `startInAppRecording`.
- No change to the founder-only placement on web; this change does not decide whether to also expose the button in the main ops dashboard `Layout.tsx` (out of scope — file separately if wanted).

## Decisions

**1. Tauri: custom Rust plugin over `screencapturekit`, scoped to a single native screenshot — not full video capture.**
Verified against the real crate (v8.0.0, sources pulled and compiled locally): `SCStream` + `SCRecordingOutput` (macOS 15+) can record screen video directly to an mp4 file — genuinely usable, and an initial implementation was built and compiled clean against it. But muxing that video with the mic's audio (ScreenCaptureKit cannot capture microphone input, only system/app audio output) turned out to have no client-side solution — no browser API remuxes two separate recordings into one file — and doing it in Rust means bundling and code-signing/notarizing an ffmpeg binary inside the macOS app, a real new distribution dependency with no CI support today.

Decision (confirmed with the user once this tradeoff surfaced): since the server (`createSubmitBugReport`) currently discards the video entirely after feeding its audio track to Deepgram — the filed issue only ever shows the transcript and a separately-captured screenshot — a muxed video has no visible value today. So: capture ONE native screenshot via `SCScreenshotManager::capture_image()` (macOS 14+, no extra bundling needed) in place of the canvas-frame-grab the web version does from its live `getDisplayMedia` stream, and keep submitting the existing `getUserMedia` mic recording as the "video" field (it's audio content either way — the field is consumed purely for its audio track downstream). Full muxed screen+audio video capture is deferred to mikro#87 (attach/link the full recording), where it will actually be used for something. This avoids the ffmpeg bundling/signing scope entirely for this change.

**2. Capture-provider seam in `BugReportButton.tsx`, selected by feature detection — not a Tauri/OS check.**
Introduce a small interface with `startRecording()`/`stopRecording()`, with a browser implementation (today's `getDisplayMedia` + `getUserMedia` + `MediaRecorder`, unchanged) and a Tauri implementation (mic-only `getUserMedia`/`MediaRecorder` + the new `capture_bug_report_screenshot` command instead of a canvas frame-grab). Selection is `"getDisplayMedia" in (navigator.mediaDevices ?? {})`: true → browser path (covers regular web AND Windows Tauri, since WebView2 already supports it — this bug is macOS/WebKit-specific); false → Tauri native path, using the existing `"__TAURI_INTERNALS__" in window` check (`mods/dashboard/src/lib/saveFile.ts`/`updater.ts`'s pattern) only to decide whether to even attempt the native command (a plain browser lacking `getDisplayMedia` should still get a clear "not supported" error, not a failed Tauri IPC call). This avoids adding a platform-detection dependency (e.g. `@tauri-apps/plugin-os`) purely to distinguish macOS from Windows Tauri builds.

**3. Mobile: `react-native-nitro-screen-recorder` (0.7.0) — `startInAppRecording` on iOS, `startGlobalRecording` on Android (platform asymmetry, confirmed against real docs).**
Alternatives considered: hand-write ReplayKit/MediaProjection wrappers (rejected — large surface, this library already wraps both with a maintained Expo config plugin); `expo-screen-recorder` (older/less maintained, no Expo config plugin per its README). Verified against the library's actual docs: it exposes TWO distinct modes, not one. `startInAppRecording`/`stopInAppRecording` (iOS only) records just the app's own content, no broadcast extension needed — matches the in-app-only Non-Goal exactly. `startGlobalRecording`/`stopGlobalRecording` (iOS + Android) is system-wide capture (other apps, system UI), requiring an iOS Broadcast Extension. **Android has no in-app-only mode in this library at all** — only global/system-wide, which is how Android's `MediaProjection` API fundamentally works (a full-device virtual display mirror; there's no OS-level "just this app" scoping the way ReplayKit's in-app API provides on iOS). Decision: use `startInAppRecording` on iOS, `startGlobalRecording` on Android — best available per platform, not uniform. `stopInAppRecording()`/`stopGlobalRecording()` both return a `ScreenRecordingFile` (`path`, `name`, `size`, `duration`, `enabledMicrophone`) — a local file URI read via the already-installed `expo-file-system` (`readAsStringAsync(path, { encoding: "base64" })`), not raw bytes directly. Mic audio is native to the library (`enableMic: true` on start) — no separate audio-library/muxing needed, resolving the open question from the original design pass.

**4. New mobile screen/modal mirrors the web dialog's stage machine, EXCEPT the recording state.**
Consent → recording → processing → result → error, same copy/tone (Spanish, matching existing web strings) adapted to native UI components. Entry point is a row in the profile tab (`perfil.tsx`), decided directly with the user (no existing Pencil design covered this) — Pencil mockups produced in the Ship pipeline's design stage, using existing account-action row patterns in `perfil.tsx` as precedent, not a new pattern.

**4a. Recording state is a non-blocking floating pill, deliberately diverging from the web version.**
The web dialog keeps its full-screen modal up during the `recording` stage too (a `bg-black/40` overlay blocks the underlying page). That's tolerable on web because the OS-level screen-share picker captures independently of the in-page DOM. On mobile it would be a real regression: most bugs require navigating across multiple screens/taps to reproduce, and a blocking modal makes that impossible. Decision: once recording starts, the modal is replaced by a small floating pill (red dot + elapsed time + stop button) that stays on top while the user freely navigates the rest of the app; only tapping the pill's stop control ends the recording. Confirmed with the user during the Pencil design-sign-off step (2026-07-03) after they asked whether they'd be able to move around during recording.

**5. EAS dev client is a workflow change, not new CI capability.**
The repo's mobile build architecture already routes all iOS binary builds through EAS cloud builds (AGENTS.md — no macOS runner ever compiles iOS) and Android through `build-android.yaml`'s Gradle build. Adding a native module doesn't require new CI infrastructure — it means anyone testing this feature locally needs a custom dev client build (`eas build --profile development`) instead of Expo Go, which has no path to native modules regardless.

## Risks / Trade-offs

- [ScreenCaptureKit requires the user to grant Screen Recording permission in macOS System Settings] → mitigated in the shipped code: `describe_error()` in `commands.rs` matches `SCError::PermissionDenied` and returns a clear Spanish message pointing at System Settings, surfaced through the same `error` stage the UI already has. Verified by pulling the real crate source (v8.0.0) rather than assuming the error shape.
- [Tauri's screenshot is a single native capture, not synced to the mic recording the way the web version's screenshot is (grabbed from the live shared stream)] → acceptable: it's still "what the screen looked like during the report," just captured at record-start instead of record-stop; revisit if users report the screenshot missing the relevant moment.
- [`react-native-nitro-screen-recorder` is a community package, not officially maintained by Expo/Meta] → mitigate by pinning an exact version, verifying `expo prebuild --platform all --no-install` passes in CI before merge (existing gate), and keeping the capture-provider seam narrow so swapping libraries later is contained.
- [Two new native dependencies contradict the repo's stated "prefer pure-JS" bias] → accepted deliberately: no pure-JS path exists for screen capture on either platform; flagged explicitly in the proposal's Impact section per AGENTS.md's native-dependency guidance.
- [Native screen recording drains battery/perf on lower-end Android devices used by field evaluators] → in-app-only capture on iOS keeps overhead bounded; Android is system-wide regardless (see Decision 3), so the main mitigation is keeping recordings short (same expectation as the web version's UX copy, which already asks users to be concise).
- [On Android, the recording pill's "navigate freely" UX means system-wide capture keeps running if the user switches to another app or sees a notification — unlike iOS's in-app-only mode, that content IS captured] → mitigated by the existing consent copy already asking users to avoid showing sensitive customer data, extended in the mobile consent screen to mention that on Android, anything visible on screen (including notifications, other apps) is captured while recording — not just this app's content. Confirmed against the library's real docs (no Android in-app-only mode exists) rather than assumed.
- [EAS dev client requirement could quietly break "testers use Expo Go" muscle memory] → call it out in the PR description and any release notes; not a code risk, a communication one.

## Migration Plan

- No data migration. This is additive capability on two new clients against an unchanged server contract.
- Rollout: land Tauri plugin and mobile capture as separate PRs if convenient (they're independent), each gated by the same test bar (unit tests + `expo prebuild` check for mobile, manual Tauri build verification on macOS for desktop — no e2e infra exists for either app per repo survey).
- Rollback: revert the client PR(s); server is untouched so no coordinated rollback needed.

## Open Questions

- ~~Does `screencapturekit` crate expose a simple "record N seconds to file" API, or only raw frame callbacks?~~ Resolved: it does (`SCRecordingOutput`, macOS 15+), but that path is unused per Decision 1 — screenshot-only via `SCScreenshotManager::capture_image()` needs no special feature flag beyond `macos_14_0`.
- Does `react-native-nitro-screen-recorder`'s output include the microphone track already, or does mic audio need separate capture and muxing? Resolve against the library's actual API during mobile build.
- ~~Should the mobile entry point also appear in the evaluator app's profile-equivalent screen?~~ Resolved: moot — there is only one shared `mods/mobile/app/perfil.tsx` used by both Cobradores and Evaluator roles (confirmed by repo survey), and the Pencil design already lives in the shared `nCQnp` cluster, so both roles get it automatically.
