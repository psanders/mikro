// The desktop shell is intentionally thin: it only hosts the webview that loads
// the same SPA served on the web. All business logic lives behind the tRPC API.
// The exceptions are native, WebView-can't-do-this features: `commands` for
// screen capture (bug-report), and `save_dialog` for the report/document
// save-location picker (mikro/#204 — see that module for why it can't just
// use `@tauri-apps/plugin-dialog`'s `save()`).
mod commands;
mod save_dialog;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .manage(commands::FeedbackCaptureState::default())
        .invoke_handler(tauri::generate_handler![
            commands::start_feedback_recording,
            commands::stop_feedback_recording,
            save_dialog::pick_save_path,
            save_dialog::write_saved_file
        ]);

    // Auto-update is desktop-only: the updater fetches/installs signed releases
    // from the apiserver manifest endpoint, and the process plugin relaunches
    // the app once an update is applied.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
