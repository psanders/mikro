// The desktop shell is intentionally thin: it only hosts the webview that loads
// the same SPA served on the web. All business logic lives behind the tRPC API.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
