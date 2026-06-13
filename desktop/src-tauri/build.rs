//! Standard Tauri v2 build entry: parses tauri.conf.json, embeds the splash
//! frontend (frontendDist), validates capabilities, and wires the icons.
fn main() {
    tauri_build::build()
}
