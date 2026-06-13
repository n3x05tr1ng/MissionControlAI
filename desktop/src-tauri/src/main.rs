// No extra console window on Windows release builds; harmless elsewhere.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Thin binary entry — all logic lives in the library crate so Tauri's mobile
//! entrypoints and tests can reuse `run()`.
fn main() {
    hive_desktop_lib::run();
}
