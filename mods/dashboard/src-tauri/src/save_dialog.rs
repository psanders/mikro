// Native "choose where to save" picker for report/document downloads
// (mikro/#204). This replaces `@tauri-apps/plugin-dialog`'s `save()`, which
// on macOS 26 Tahoe can crash the entire app: its underlying
// `NSSavePanel.savePanel()` call can return NULL when the panel XPC service
// misbehaves, and objc2-app-kit 0.3.2's safe binding for that method
// force-unwraps the result (tauri-apps/tauri#13047, no upstream fix as of
// this writing). `saveFile.ts`'s previous workaround sidestepped the crash
// by skipping the native dialog entirely and writing straight to Downloads —
// this restores the picker by calling the panel ourselves, nil-safely.
//
// The frontend (`saveFile.ts`) calls `pick_save_path` first:
//   - "picked" { path }  — the user chose a location; the frontend then
//     writes the bytes there via `write_saved_file`.
//   - "cancelled"        — the user backed out of the dialog; do nothing,
//     no toast, no error.
//   - "unavailable"      — the panel could not be shown at all (the nil-panel
//     case above, or the app isn't running with a main-thread window yet);
//     the frontend falls back to today's silent-Downloads-write behavior.
//
// NSSavePanel (and rfd's Windows dialog, for consistency) must run on the
// main thread, so this command is async and hops via
// `AppHandle::run_on_main_thread` + a `tokio::sync::oneshot` channel — the
// same shape `tauri-plugin-dialog` itself uses internally.

use serde::Serialize;

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum PickSavePathResult {
    #[serde(rename = "picked")]
    Picked { path: String },
    #[serde(rename = "cancelled")]
    Cancelled,
    #[serde(rename = "unavailable")]
    Unavailable,
}

#[tauri::command]
pub async fn pick_save_path(app: tauri::AppHandle, filename: String) -> PickSavePathResult {
    let (tx, rx) = tokio::sync::oneshot::channel();

    // `run_on_main_thread` itself only fails if the event loop is already
    // gone (e.g. app shutting down) — treat that the same as "no panel
    // available" rather than hanging forever waiting on `rx`.
    if app
        .run_on_main_thread(move || {
            let result = platform::pick_save_path(&filename);
            let _ = tx.send(result);
        })
        .is_err()
    {
        return PickSavePathResult::Unavailable;
    }

    rx.await.unwrap_or(PickSavePathResult::Unavailable)
}

/// Writes bytes (base64-encoded, as report/document mutations already hand
/// back over tRPC) to a path the user picked via `pick_save_path`. Doing the
/// write here rather than via `@tauri-apps/plugin-fs`'s `writeFile` avoids
/// depending on that plugin's `fs:scope` capability covering wherever the
/// native panel let the user navigate to — which can be outside the
/// `$HOME/**`-rooted scope in `capabilities/default.json` (an external
/// volume, `/tmp`, etc). A user-picked destination doesn't need scope
/// gating: the OS-native panel is already the permission gate.
#[tauri::command]
pub fn write_saved_file(path: String, base64: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let bytes = STANDARD
        .decode(base64)
        .map_err(|e| format!("Contenido inválido: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("No se pudo guardar el archivo: {e}"))
}

#[cfg(target_os = "macos")]
mod platform {
    use super::PickSavePathResult;
    use objc2::rc::Retained;
    use objc2::{msg_send, ClassType, MainThreadMarker};
    use objc2_app_kit::{NSModalResponseOK, NSSavePanel};
    use objc2_foundation::{NSString, NSURL};
    use std::path::PathBuf;

    /// Must be called on the main thread (see `pick_save_path`'s
    /// `run_on_main_thread` hop) — NSSavePanel is AppKit UI.
    pub fn pick_save_path(filename: &str) -> PickSavePathResult {
        let Some(_mtm) = MainThreadMarker::new() else {
            return PickSavePathResult::Unavailable;
        };

        // SAFETY: `+[NSSavePanel savePanel]` is a plain Objective-C class
        // method with no special calling-convention requirements beyond the
        // usual `msg_send!` ones (correct selector, correct return type,
        // main thread). Apple's own docs note "This class is not a
        // singleton" — in practice, on macOS 26 Tahoe, the backing panel
        // XPC service can fail and this returns nil. objc2-app-kit's own
        // `NSSavePanel::savePanel(mtm)` binding declares a non-Optional
        // `Retained<NSSavePanel>` return and unwraps that nil, which is
        // exactly what crashes the app under the stock
        // `@tauri-apps/plugin-dialog` path (tauri-apps/tauri#13047). Asking
        // for `Option<Retained<NSSavePanel>>` here instead makes the nil
        // case a normal, safe `None`.
        let panel: Option<Retained<NSSavePanel>> =
            unsafe { msg_send![NSSavePanel::class(), savePanel] };
        let Some(panel) = panel else {
            return PickSavePathResult::Unavailable;
        };

        panel.setNameFieldStringValue(&NSString::from_str(filename));
        if let Some(downloads) = downloads_dir() {
            if let Some(dir_str) = downloads.to_str() {
                let url = NSURL::fileURLWithPath(&NSString::from_str(dir_str));
                panel.setDirectoryURL(Some(&url));
            }
        }

        let response = panel.runModal();
        if response != NSModalResponseOK {
            return PickSavePathResult::Cancelled;
        }
        match panel.URL().and_then(|url| url.path()) {
            Some(path) => PickSavePathResult::Picked {
                path: path.to_string(),
            },
            // The user clicked "Save" but the panel has no URL — shouldn't
            // normally happen; treat as a cancel rather than guessing a path.
            None => PickSavePathResult::Cancelled,
        }
    }

    fn downloads_dir() -> Option<PathBuf> {
        std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Downloads"))
    }
}

#[cfg(not(target_os = "macos"))]
mod platform {
    use super::PickSavePathResult;
    use std::path::PathBuf;

    /// Windows (and any other non-macOS desktop target): `rfd`'s save
    /// dialog isn't affected by the NSSavePanel-nil bug — this app doesn't
    /// need a hand-rolled binding here, just the same main-thread hop for
    /// consistency with the macOS path.
    pub fn pick_save_path(filename: &str) -> PickSavePathResult {
        let mut dialog = rfd::FileDialog::new().set_file_name(filename);
        if let Some(dir) = downloads_dir() {
            dialog = dialog.set_directory(dir);
        }
        match dialog.save_file() {
            Some(path) => match path.to_str() {
                Some(p) => PickSavePathResult::Picked {
                    path: p.to_string(),
                },
                None => PickSavePathResult::Unavailable,
            },
            None => PickSavePathResult::Cancelled,
        }
    }

    fn downloads_dir() -> Option<PathBuf> {
        std::env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join("Downloads"))
    }
}
