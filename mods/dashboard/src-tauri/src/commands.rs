// Native screen video capture for the bug-report feature (mikro/#69,
// extend-bug-report-native-capture). WKWebView on macOS doesn't implement
// `getDisplayMedia`, so this records a short silent screen video natively
// via ScreenCaptureKit instead. No microphone/audio track: ScreenCaptureKit
// can't capture the mic (only system/app audio output), and muxing a
// separately-recorded mic track in would require bundling and code-signing
// an ffmpeg binary — real distribution scope for a video whose entire point
// is "show what the user did," not narration. There's no screenshot capture
// anymore either — the video is strictly more useful and is now the
// default/only visual artifact. Windows Tauri builds keep using
// `getDisplayMedia` (WebView2 supports it), so these commands only do real
// work on macOS and return a clear error everywhere else.

use std::sync::Mutex;

#[cfg(target_os = "macos")]
mod mac {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use screencapturekit::prelude::*;
    use screencapturekit::recording_output::{
        SCRecordingOutput, SCRecordingOutputCodec, SCRecordingOutputConfiguration,
        SCRecordingOutputFileType,
    };
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    pub struct Session {
        stream: SCStream,
        recording: SCRecordingOutput,
        path: PathBuf,
    }

    // `SCStream`/`SCRecordingOutput` wrap thread-safe Objective-C objects and
    // already carry `unsafe impl Send + Sync` in the crate itself; holding
    // them together behind a `Mutex` in Tauri managed state is safe for the
    // same reason.
    unsafe impl Send for Session {}

    pub fn start_recording() -> Result<Session, String> {
        let content = SCShareableContent::get().map_err(describe_error)?;
        let display = content
            .displays()
            .into_iter()
            .next()
            .ok_or_else(|| "No se encontró ninguna pantalla para grabar.".to_string())?;
        let filter = SCContentFilter::create()
            .with_display(&display)
            .with_excluding_windows(&[])
            .build();
        let config = SCStreamConfiguration::new()
            .with_width(display.width())
            .with_height(display.height());

        let path = std::env::temp_dir().join(format!("mikro-bug-report-{}.mp4", token()));

        let rec_config = SCRecordingOutputConfiguration::new()
            .with_output_url(&path)
            .with_video_codec(SCRecordingOutputCodec::H264)
            .with_output_file_type(SCRecordingOutputFileType::MP4);

        let recording = SCRecordingOutput::new(&rec_config).ok_or_else(|| {
            "No se pudo iniciar la grabación: se requiere macOS 15 o superior.".to_string()
        })?;

        let stream = SCStream::new(&filter, &config);
        stream
            .add_recording_output(&recording)
            .map_err(describe_error)?;
        stream.start_capture().map_err(describe_error)?;

        Ok(Session {
            stream,
            recording,
            path,
        })
    }

    pub fn stop_recording(session: Session) -> Result<(String, String), String> {
        session.stream.stop_capture().map_err(describe_error)?;
        session
            .stream
            .remove_recording_output(&session.recording)
            .map_err(describe_error)?;

        let bytes = std::fs::read(&session.path)
            .map_err(|e| format!("No se pudo leer la grabación: {e}"))?;
        let _ = std::fs::remove_file(&session.path);

        Ok((STANDARD.encode(bytes), "video/mp4".to_string()))
    }

    fn describe_error(err: SCError) -> String {
        match err {
            SCError::PermissionDenied(_) => "Se requiere permiso de Grabación de pantalla. \
                 Actívalo en Ajustes del Sistema → Privacidad y seguridad → Grabación de \
                 pantalla, y vuelve a intentar."
                .to_string(),
            other => format!("No se pudo grabar la pantalla: {other}"),
        }
    }

    fn token() -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        format!("{nanos:x}")
    }
}

#[cfg(target_os = "macos")]
type Session = mac::Session;
#[cfg(not(target_os = "macos"))]
type Session = ();

#[derive(Default)]
pub struct FeedbackCaptureState(Mutex<Option<Session>>);

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedRecording {
    pub base64: String,
    pub mime_type: String,
}

/// Starts a silent screen video recording via ScreenCaptureKit, in place of
/// `getDisplayMedia` (unsupported in WKWebView). No audio track — see this
/// file's header for why microphone/system audio isn't mixed in.
#[tauri::command]
pub fn start_feedback_recording(
    state: tauri::State<'_, FeedbackCaptureState>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let mut guard = state
            .0
            .lock()
            .map_err(|_| "Estado de grabación no disponible.".to_string())?;
        if guard.is_some() {
            return Err("Ya hay una grabación en curso.".to_string());
        }
        *guard = Some(mac::start_recording()?);
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = state;
        Err("La grabación nativa de pantalla solo está disponible en macOS.".to_string())
    }
}

/// Stops the in-progress recording and returns it as base64 video bytes,
/// ready to hand to the same `submitFeedback` upload path the browser
/// capture path already uses.
#[tauri::command]
pub fn stop_feedback_recording(
    state: tauri::State<'_, FeedbackCaptureState>,
) -> Result<CapturedRecording, String> {
    #[cfg(target_os = "macos")]
    {
        let session = {
            let mut guard = state
                .0
                .lock()
                .map_err(|_| "Estado de grabación no disponible.".to_string())?;
            guard
                .take()
                .ok_or_else(|| "No hay ninguna grabación en curso.".to_string())?
        };
        let (base64, mime_type) = mac::stop_recording(session)?;
        Ok(CapturedRecording { base64, mime_type })
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = state;
        Err("La grabación nativa de pantalla solo está disponible en macOS.".to_string())
    }
}
