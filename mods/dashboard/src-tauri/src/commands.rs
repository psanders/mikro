// Native screenshot capture for the bug-report feature (mikro/#69,
// extend-bug-report-native-capture). WKWebView on macOS doesn't implement
// `getDisplayMedia`, so there's no live screen video stream to grab a still
// frame from like the web build does — this captures one screenshot natively
// via ScreenCaptureKit instead. Mic audio keeps using the existing
// `getUserMedia` path (that already works fine in Tauri) and is submitted in
// the video field in its place. Full muxed screen+audio video capture is
// deliberately deferred to mikro#87 (attach/link the full recording), since
// the server currently discards the video after transcribing its audio track
// anyway — see design.md decision 5. Windows Tauri builds keep using
// `getDisplayMedia` (WebView2 supports it), so this command only does real
// work on macOS and returns a clear error everywhere else.

#[cfg(target_os = "macos")]
mod mac {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use screencapturekit::prelude::*;
    use screencapturekit::screenshot_manager::{CGImageExt, ImageFormat, SCScreenshotManager};
    use std::time::{SystemTime, UNIX_EPOCH};

    pub fn capture() -> Result<(String, String), String> {
        let content = SCShareableContent::get().map_err(describe_error)?;
        let display = content
            .displays()
            .into_iter()
            .next()
            .ok_or_else(|| "No se encontró ninguna pantalla para capturar.".to_string())?;

        let filter = SCContentFilter::create()
            .with_display(&display)
            .with_excluding_windows(&[])
            .build();
        let config = SCStreamConfiguration::new()
            .with_width(display.width())
            .with_height(display.height());

        let image =
            SCScreenshotManager::capture_image(&filter, &config).map_err(describe_error)?;

        let path = std::env::temp_dir().join(format!("mikro-bug-report-{}.png", token()));
        image
            .save(path.to_string_lossy().as_ref(), ImageFormat::Png)
            .map_err(describe_error)?;

        let bytes =
            std::fs::read(&path).map_err(|e| format!("No se pudo leer la captura: {e}"))?;
        let _ = std::fs::remove_file(&path);

        Ok((STANDARD.encode(bytes), "image/png".to_string()))
    }

    fn describe_error(err: SCError) -> String {
        match err {
            SCError::PermissionDenied(_) => "Se requiere permiso de Grabación de pantalla. \
                 Actívalo en Ajustes del Sistema → Privacidad y seguridad → Grabación de \
                 pantalla, y vuelve a intentar."
                .to_string(),
            other => format!("No se pudo capturar la pantalla: {other}"),
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedScreenshot {
    pub base64: String,
    pub mime_type: String,
}

/// Captures a single screenshot natively via ScreenCaptureKit, in place of
/// grabbing a frame from a live `getDisplayMedia` stream (which WKWebView
/// doesn't support).
#[tauri::command]
pub fn capture_bug_report_screenshot() -> Result<CapturedScreenshot, String> {
    #[cfg(target_os = "macos")]
    {
        let (base64, mime_type) = mac::capture()?;
        Ok(CapturedScreenshot { base64, mime_type })
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("La captura nativa de pantalla solo está disponible en macOS.".to_string())
    }
}
