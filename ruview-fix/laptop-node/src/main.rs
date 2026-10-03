//! `ruview-laptop-node` — use this laptop's WiFi adapter as a RuView sensing
//! node. Streams RSSI-derived ADR-018 frames to the sensing server (UDP 5005)
//! and answers RuView Desktop discovery (UDP 5006 + mDNS), so the laptop shows
//! up under Nodes like an ESP32 would.
//!
//! Built as a Windows GUI-subsystem program so it can run at logon without a
//! console window; when started from a terminal it attaches to it for output.

#![cfg_attr(windows, windows_subsystem = "windows")]

mod wlan;

use std::fs::OpenOptions;
use std::io::Write;
use std::net::UdpSocket;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use ruview_laptop_node::{
    beacon_reply, format_mac, node_mac_from_guid, register_mdns, spawn_discovery_responder,
    Adr018Frame, SlotMapper, DISCOVERY_PORT, NODE_VERSION,
};
use wlan::Wlan;

const USAGE: &str = "\
ruview-laptop-node: use this laptop's WiFi as a RuView sensing node

Options:
  --server <ip:port>   sensing server UDP address      [default: 127.0.0.1:5005]
  --node-id <n>        node id reported to RuView      [default: 1]
  --rate <hz>          frames per second               [default: 10]
  --gain <n>           amplitude units per dB of RSSI change [default: 8]
  --scan-secs <s>      seconds between WiFi scans (0 = never) [default: 15]
  --log <file>         log file  [default: %LOCALAPPDATA%\\RuView\\laptop-node.log]
  --no-discovery       do not answer RuView Desktop node discovery
  -h, --help           show this help
";

struct Args {
    server: String,
    node_id: u8,
    rate_hz: f64,
    gain: f64,
    scan_secs: u64,
    log: Option<PathBuf>,
    discovery: bool,
}

fn parse_args() -> Result<Args, String> {
    let mut a = Args {
        server: "127.0.0.1:5005".into(),
        node_id: 1,
        rate_hz: 10.0,
        gain: 8.0,
        scan_secs: 15,
        log: std::env::var_os("LOCALAPPDATA")
            .map(|d| PathBuf::from(d).join("RuView").join("laptop-node.log")),
        discovery: true,
    };
    let mut it = std::env::args().skip(1);
    while let Some(flag) = it.next() {
        let mut val = |name: &str| it.next().ok_or_else(|| format!("{name} needs a value"));
        match flag.as_str() {
            "--server" => a.server = val("--server")?,
            "--node-id" => {
                a.node_id = val("--node-id")?
                    .parse()
                    .map_err(|e| format!("--node-id: {e}"))?
            }
            "--rate" => a.rate_hz = val("--rate")?.parse().map_err(|e| format!("--rate: {e}"))?,
            "--gain" => a.gain = val("--gain")?.parse().map_err(|e| format!("--gain: {e}"))?,
            "--scan-secs" => {
                a.scan_secs = val("--scan-secs")?
                    .parse()
                    .map_err(|e| format!("--scan-secs: {e}"))?
            }
            "--log" => a.log = Some(PathBuf::from(val("--log")?)),
            "--no-discovery" => a.discovery = false,
            "-h" | "--help" => return Err(String::new()),
            other => return Err(format!("unknown option {other}")),
        }
    }
    if !(1.0..=50.0).contains(&a.rate_hz) {
        return Err("--rate must be between 1 and 50".into());
    }
    if !(a.gain > 0.0 && a.gain <= 64.0) {
        return Err("--gain must be between 0 and 64".into());
    }
    Ok(a)
}

static LOG_FILE: Mutex<Option<std::fs::File>> = Mutex::new(None);

fn log(msg: &str) {
    let line = format!("{} {msg}", timestamp());
    eprintln!("{line}");
    if let Ok(mut f) = LOG_FILE.lock() {
        if let Some(f) = f.as_mut() {
            let _ = writeln!(f, "{line}");
        }
    }
}

fn timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (h, m, s) = ((secs / 3600) % 24, (secs / 60) % 60, secs % 60);
    format!("[{h:02}:{m:02}:{s:02} UTC]")
}

fn open_log(path: &PathBuf) {
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    // Keep the log small: start over once it passes 1 MB.
    let truncate = std::fs::metadata(path)
        .map(|m| m.len() > 1_000_000)
        .unwrap_or(false);
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(!truncate)
        .truncate(truncate)
        .open(path);
    if let (Ok(f), Ok(mut slot)) = (file, LOG_FILE.lock()) {
        *slot = Some(f);
    }
}

#[cfg(windows)]
fn attach_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    // SAFETY: plain Win32 call; failure (no parent console) is harmless.
    unsafe { AttachConsole(ATTACH_PARENT_PROCESS) };
}

#[cfg(not(windows))]
fn attach_console() {}

/// Answer `RUVIEW_DISCOVER` probes from RuView Desktop.
fn spawn_udp_discovery(mac: String, node_id: u8) {
    match UdpSocket::bind(("0.0.0.0", DISCOVERY_PORT)) {
        Ok(sock) => {
            spawn_discovery_responder(sock, beacon_reply(&mac, node_id));
        }
        Err(e) => log(&format!(
            "discovery: cannot listen on UDP {DISCOVERY_PORT} ({e}); RuView Desktop may not list this node"
        )),
    }
}

/// Advertise `_ruview._udp` over mDNS (RuView Desktop browses both).
fn start_mdns(mac: &str, node_id: u8, data_port: u16) -> Option<mdns_sd::ServiceDaemon> {
    let host = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "laptop".into());
    match register_mdns(&host, mac, node_id, data_port) {
        Ok(d) => Some(d),
        Err(e) => {
            log(&format!("mDNS: register failed ({e})"));
            None
        }
    }
}

fn open_wlan_blocking() -> Wlan {
    let mut last_err = None;
    loop {
        match Wlan::open() {
            Ok(w) => return w,
            Err(e) => {
                if last_err != Some(e) {
                    log(&format!(
                        "WiFi: cannot open adapter: {e}. Retrying every 5 s..."
                    ));
                    last_err = Some(e);
                }
                std::thread::sleep(Duration::from_secs(5));
            }
        }
    }
}

fn main() {
    attach_console();
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            if !e.is_empty() {
                eprintln!("error: {e}\n");
            }
            eprint!("{USAGE}");
            std::process::exit(if e.is_empty() { 0 } else { 2 });
        }
    };
    if let Some(p) = &args.log {
        open_log(p);
    }
    log(&format!(
        "ruview-laptop-node {NODE_VERSION} starting (server {}, {} Hz)",
        args.server, args.rate_hz
    ));

    let sock = UdpSocket::bind("0.0.0.0:0").expect("bind UDP socket");
    let data_port = args
        .server
        .rsplit(':')
        .next()
        .and_then(|p| p.parse().ok())
        .unwrap_or(5005u16);

    let mut wlan = open_wlan_blocking();
    let mac = format_mac(&node_mac_from_guid(&wlan.guid_bytes()));
    log(&format!(
        "WiFi adapter: {} (node mac {mac})",
        wlan.description
    ));

    let _mdns = if args.discovery {
        spawn_udp_discovery(mac.clone(), args.node_id);
        start_mdns(&mac, args.node_id, data_port)
    } else {
        None
    };

    let period = Duration::from_secs_f64(1.0 / args.rate_hz);
    let mut mapper = SlotMapper::new(args.gain, Duration::from_secs(20), Duration::from_secs(90));
    let mut seq: u32 = 0;
    let mut freq_mhz: u32 = 2437;
    let mut next_tick = Instant::now();
    let mut next_scan = Instant::now();
    let mut next_bss_read = Instant::now();
    let mut next_report = Instant::now() + Duration::from_secs(10);
    let mut sent_since_report = 0u32;
    let mut last_link_err: Option<wlan::WlanError> = None;
    let mut bss_denied_logged = false;
    let mut last_ssid = String::new();
    let mut send_err_logged = false;
    let mut failing_since: Option<Instant> = None;

    loop {
        let now = Instant::now();
        if now < next_tick {
            std::thread::sleep(next_tick - now);
        }
        next_tick += period;
        let now = Instant::now();
        if now > next_tick + period * 10 {
            next_tick = now + period; // fell far behind (e.g. sleep/resume)
        }

        // 1. Connected-link RSSI, every frame.
        let (bssid, rssi) = match wlan.link() {
            Ok(link) => {
                if link.ssid != last_ssid {
                    log(&format!(
                        "WiFi: connected to \"{}\" ({}), RSSI {:.0} dBm, quality {}%",
                        link.ssid,
                        format_mac(&link.bssid),
                        link.rssi_dbm,
                        link.quality_pct
                    ));
                    last_ssid = link.ssid.clone();
                }
                last_link_err = None;
                failing_since = None;
                (link.bssid, link.rssi_dbm)
            }
            Err(e) => {
                // Without location permission Windows hides the SSID/BSSID
                // but may still report RSSI.
                match (e.is_access_denied(), wlan.rssi()) {
                    (true, Ok(r)) => {
                        if last_link_err != Some(e) {
                            log(&format!("WiFi: {e}. Using RSSI only."));
                            last_link_err = Some(e);
                        }
                        ([0; 6], f64::from(r))
                    }
                    _ => {
                        if last_link_err != Some(e) {
                            log(&format!(
                                "WiFi: no usable link ({e}); waiting for a WiFi connection..."
                            ));
                            last_link_err = Some(e);
                            last_ssid.clear();
                        }
                        // After 30 s of failures, reopen the WLAN session in
                        // case the WLAN service or adapter driver restarted.
                        let since = *failing_since.get_or_insert(now);
                        if now.duration_since(since) > Duration::from_secs(30) {
                            failing_since = Some(now);
                            if let Ok(w) = Wlan::open() {
                                wlan = w;
                            }
                        }
                        continue;
                    }
                }
            }
        };
        mapper.set_connected(bssid, rssi, now);

        // 2. Neighbour access points from the driver's scan cache.
        if args.scan_secs > 0 && now >= next_scan {
            let _ = wlan.request_scan();
            next_scan = now + Duration::from_secs(args.scan_secs);
            next_bss_read = now + Duration::from_secs(4); // scans take ~2-4 s
        }
        if now >= next_bss_read {
            next_bss_read = now + Duration::from_secs(2);
            match wlan.bss_list() {
                Ok(list) => {
                    if let Some(f) = wlan::freq_for(&bssid, &list) {
                        freq_mhz = f;
                    }
                    mapper.update_neighbours(&list, now);
                }
                Err(e) if !bss_denied_logged => {
                    log(&format!(
                        "WiFi scan list unavailable ({e}); using the connected link only"
                    ));
                    bss_denied_logged = true;
                }
                Err(_) => {}
            }
        }

        // 3. Build and send the frame.
        let frame = Adr018Frame {
            node_id: args.node_id,
            freq_mhz,
            sequence: seq,
            rssi_dbm: rssi.round().clamp(-127.0, 0.0) as i8,
            noise_floor_dbm: -95,
            amplitudes: mapper.amplitudes(now),
        };
        seq = seq.wrapping_add(1);
        match sock.send_to(&frame.encode(), &args.server) {
            Ok(_) => {
                sent_since_report += 1;
                send_err_logged = false;
            }
            Err(e) if !send_err_logged => {
                log(&format!("send to {} failed: {e}", args.server));
                send_err_logged = true;
            }
            Err(_) => {}
        }

        if now >= next_report {
            log(&format!(
                "streaming: {sent_since_report} frames since last report, RSSI {rssi:.0} dBm, {} neighbour APs, {freq_mhz} MHz",
                mapper.neighbour_count()
            ));
            sent_since_report = 0;
            next_report = now + Duration::from_secs(60);
        }
    }
}
