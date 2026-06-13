//! Hive desktop shell — Tauri v2 application library.
//!
//! Hive's web app is NOT static-exportable (it is a real Next server: API routes,
//! SSE streams, a SQLite data layer, the Claude Agent SDK). So the desktop app
//! runs the production **Next standalone server** and the **embedded-terminal
//! server** as two Node child processes off a single bundled `node` binary:
//!
//!  1. spawn `node next-runtime/server.js` on a free loopback port (the Next UI),
//!  2. spawn `node terminal-runtime/terminal-server.mjs` on a FIXED loopback port
//!     (`TERMINAL_PORT`, baked into the frontend as NEXT_PUBLIC_HIVE_TERMINAL_PORT),
//!  3. wait until the Next server answers `GET / → 200`, then navigate the window
//!     from the bundled splash to `http://127.0.0.1:<next port>`,
//!  4. tear BOTH children down on every exit path so no Node process (or the PTYs
//!     the terminal server owns) outlives the window.
//!
//! Children are spawned with **std::process** (full lifecycle control) and each is
//! reaped by a supervisor thread so neither lingers as a zombie. Both get
//! `HIVE_DATA_DIR=<app-data>` (the SQLite vault lives under the app-data dir) and
//! `HIVE_ALLOWED_ORIGINS=<next origin>` so the terminal server's anti-CSWSH
//! allowlist accepts the webview's WebSocket upgrades. (Note: Next renames its
//! process title to "next-server …", so the Next child is not found by the binary
//! name in `ps` — teardown targets the stored PID, not the title.)

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, WindowEvent};

/// The bundled Node runtime (declared as `externalBin` in tauri.conf.json, so it
/// is bundled next to the app binary in `Contents/MacOS/`).
const NODE_BIN: &str = "hive-node";

/// Fixed loopback port for the embedded-terminal WebSocket server. It MUST match
/// the `NEXT_PUBLIC_HIVE_TERMINAL_PORT` baked into the frontend at build time
/// (see scripts/build-desktop.sh) because the browser reads that value to build
/// the `ws://127.0.0.1:<port>/terminal` URL. A high, uncommon port avoids clashes.
const TERMINAL_PORT: u16 = 47821;

/// Max time to wait for the Next sidecar to answer its health route.
const NEXT_HEALTH_TIMEOUT: Duration = Duration::from_secs(60);

/// The live PIDs of the two Node children, used for teardown.
#[derive(Default)]
struct AppState {
    next_pid: Mutex<Option<u32>>,
    term_pid: Mutex<Option<u32>>,
}

/// `~/Library/Application Support/com.hive.desktop/` — the SQLite vault + WAL live
/// here so they survive app updates and are owned by the logged-in macOS user.
fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create app data dir: {e}"))?;
    Ok(dir)
}

/// The bundled `node`, placed by Tauri next to the app executable.
fn node_bin() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| format!("cannot resolve current exe: {e}"))?;
    Ok(exe.parent().ok_or("exe has no parent")?.join(NODE_BIN))
}

/// Append-only log under the app-data dir for the children's stdout/stderr.
fn sidecar_log(app: &tauri::AppHandle) -> std::fs::File {
    let path = app_data_dir(app)
        .map(|d| d.join("sidecars.log"))
        .unwrap_or_else(|_| PathBuf::from("/tmp/hive-sidecars.log"));
    std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .or_else(|_| {
            std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open("/tmp/hive-sidecars.log")
        })
        .expect("cannot open sidecar log")
}

/// Spawn one Node child (stdout/stderr → the shared log, stdin detached) and a
/// supervisor thread that reaps it on exit. Returns its PID (stored for teardown).
fn spawn_supervised(
    node: &PathBuf,
    log: &std::fs::File,
    label: &'static str,
    script: PathBuf,
    cwd: PathBuf,
    envs: &[(&str, String)],
) -> Result<u32, String> {
    let out = log.try_clone().map_err(|e| format!("log clone: {e}"))?;
    let err = log.try_clone().map_err(|e| format!("log clone: {e}"))?;
    let mut cmd = Command::new(node);
    cmd.arg(script)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::from(out))
        .stderr(Stdio::from(err));
    for (k, v) in envs {
        cmd.env(k, v);
    }
    let mut child: Child = cmd.spawn().map_err(|e| format!("spawn {label}: {e}"))?;
    let pid = child.id();
    // Reap on exit so the child never lingers as a zombie.
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(pid)
}

/// Start both Node children and return the Next server base URL once healthy.
fn start_sidecars(app: &tauri::AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();
    let res = app
        .path()
        .resource_dir()
        .map_err(|e| format!("cannot resolve resource dir: {e}"))?;
    let data_dir = app_data_dir(app)?;
    let data_str = data_dir.to_string_lossy().to_string();
    let node = node_bin()?;
    let log = sidecar_log(app);

    let next_runtime = res.join("next-runtime");
    let term_runtime = res.join("terminal-runtime");

    let next_port = portpicker::pick_unused_port().ok_or("no free TCP port available")?;
    let next_url = format!("http://127.0.0.1:{next_port}");
    // The browser page is served from the Next origin; the terminal server's
    // anti-CSWSH allowlist must accept WS upgrades carrying exactly that Origin.
    let allowed_origins = format!("http://127.0.0.1:{next_port},http://localhost:{next_port}");

    // 1) Next standalone server (the UI).
    let next_pid = spawn_supervised(
        &node,
        &log,
        "next",
        next_runtime.join("server.js"),
        next_runtime.clone(),
        &[
            ("PORT", next_port.to_string()),
            ("HOSTNAME", "127.0.0.1".to_string()),
            ("NODE_ENV", "production".to_string()),
            ("HIVE_DATA_DIR", data_str.clone()),
            ("HIVE_TERMINAL_PORT", TERMINAL_PORT.to_string()),
            ("NEXT_PUBLIC_HIVE_TERMINAL_PORT", TERMINAL_PORT.to_string()),
            ("HIVE_ALLOWED_ORIGINS", allowed_origins.clone()),
        ],
    )?;
    *state.next_pid.lock().map_err(|_| "lock poisoned")? = Some(next_pid);

    // 2) Embedded-terminal server (PTY <-> WebSocket bridge) on the fixed port.
    let term_pid = spawn_supervised(
        &node,
        &log,
        "term",
        term_runtime.join("terminal-server.mjs"),
        term_runtime.clone(),
        &[
            ("HIVE_TERMINAL_PORT", TERMINAL_PORT.to_string()),
            ("NODE_ENV", "production".to_string()),
            ("HIVE_DATA_DIR", data_str),
            ("HIVE_ALLOWED_ORIGINS", allowed_origins),
        ],
    )?;
    *state.term_pid.lock().map_err(|_| "lock poisoned")? = Some(term_pid);

    // Block (with timeout) until the Next server answers its health route.
    wait_for_health(&next_url)?;
    Ok(next_url)
}

/// Poll `GET <base_url>/` until it returns 2xx or the timeout elapses.
fn wait_for_health(base_url: &str) -> Result<(), String> {
    let addr = base_url.strip_prefix("http://").ok_or("malformed base url")?;
    let deadline = Instant::now() + NEXT_HEALTH_TIMEOUT;
    loop {
        if Instant::now() > deadline {
            return Err(format!(
                "Next server did not become healthy within {}s",
                NEXT_HEALTH_TIMEOUT.as_secs()
            ));
        }
        if http_get_ok(addr, "/") {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}

/// Tiny blocking HTTP/1.0 GET; true on a 2xx status. Loopback liveness probe only.
fn http_get_ok(host_port: &str, path: &str) -> bool {
    use std::io::{Read, Write};
    use std::net::TcpStream;

    let mut stream = match TcpStream::connect(host_port) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(900)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(900)));
    let req = format!("GET {path} HTTP/1.0\r\nHost: {host_port}\r\nConnection: close\r\n\r\n");
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 64];
    let n = match stream.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return false,
    };
    is_http_2xx(&String::from_utf8_lossy(&buf[..n]))
}

/// Pure predicate: does an HTTP response head begin with a `2xx` status line?
fn is_http_2xx(head: &str) -> bool {
    head.starts_with("HTTP/1.")
        && head
            .split_whitespace()
            .nth(1)
            .and_then(|code| code.parse::<u16>().ok())
            .map(|code| (200..300).contains(&code))
            .unwrap_or(false)
}

/// SIGTERM then SIGKILL a child by PID. SIGTERM lets Node (and, for the terminal
/// server, the PTYs it owns) shut down gracefully; the supervisor thread reaps it.
fn stop_pid(slot: &Mutex<Option<u32>>) {
    if let Ok(mut guard) = slot.lock() {
        if let Some(pid) = guard.take() {
            #[cfg(unix)]
            unsafe {
                libc::kill(pid as i32, libc::SIGTERM);
            }
            std::thread::sleep(Duration::from_millis(400));
            #[cfg(unix)]
            unsafe {
                libc::kill(pid as i32, libc::SIGKILL);
            }
        }
    }
}

/// Tear both Node children down. Called on every exit path so neither outlives the
/// window (the terminal server holds live shells in the user's projects).
fn stop_sidecars(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        stop_pid(&state.term_pid);
        stop_pid(&state.next_pid);
    }
}

/// Tauri application entrypoint.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            // Start the children synchronously during setup so the window only
            // navigates to a live server. On failure, tear down and abort setup.
            match start_sidecars(&handle) {
                Ok(url) => {
                    if let Some(win) = handle.get_webview_window("main") {
                        let _ = win.eval(&format!("window.location.replace('{url}')"));
                    }
                }
                Err(e) => {
                    stop_sidecars(&handle);
                    return Err(e.into());
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                stop_sidecars(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the Hive desktop application")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                stop_sidecars(app_handle);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_2xx_status_lines_are_detected() {
        assert!(is_http_2xx("HTTP/1.0 200 OK\r\n"));
        assert!(is_http_2xx("HTTP/1.1 204 No Content\r\n"));
        assert!(!is_http_2xx("HTTP/1.1 307 Temporary Redirect\r\n"));
    }

    #[test]
    fn non_2xx_status_lines_are_rejected() {
        assert!(!is_http_2xx("HTTP/1.1 404 Not Found\r\n"));
        assert!(!is_http_2xx("HTTP/1.1 500 Internal Server Error\r\n"));
        assert!(!is_http_2xx(""));
    }
}
