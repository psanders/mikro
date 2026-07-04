fn main() {
    // The `screencapturekit` crate (used by src/commands.rs for the bug-report
    // native screenshot, macOS-only) needs the Swift runtime's rpath baked into
    // whatever binary actually links it. Its own build.rs emits the right
    // `-Wl,-rpath,...` flags, but `cargo:rustc-link-arg` from a *dependency's*
    // build script only applies when that dependency itself produces the final
    // binary — it does not propagate through to a downstream crate like this
    // one that merely depends on it. Without this, the app fails at launch
    // with `dyld: Library not loaded: @rpath/libswift_Concurrency.dylib`
    // (confirmed via `otool -l` showing zero LC_RPATH entries without this).
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
        if let Ok(output) = std::process::Command::new("xcode-select").arg("-p").output() {
            if output.status.success() {
                let xcode_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                for suffix in ["usr/lib/swift-5.5/macosx", "usr/lib/swift/macosx"] {
                    println!(
                        "cargo:rustc-link-arg=-Wl,-rpath,{xcode_path}/Toolchains/XcodeDefault.xctoolchain/{suffix}"
                    );
                }
            }
        }
    }

    tauri_build::build()
}
