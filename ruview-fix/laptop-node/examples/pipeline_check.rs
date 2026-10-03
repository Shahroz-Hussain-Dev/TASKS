//! End-to-end check of the frame mapping against a running sensing server.
//!
//! Replays *synthetic* RSSI traces (not real measurements) through the same
//! `SlotMapper` + ADR-018 encoder the node uses, and prints the server's
//! classification once per second:
//!
//!   phase 1 (40 s)  empty room: ±1 dB quantisation jitter
//!   phase 2 (30 s)  someone walking: 3-8 dB swings on the connected link
//!   phase 3 (40 s)  empty room again
//!
//! Usage: cargo run --release --example pipeline_check -- 127.0.0.1:5005 http://127.0.0.1:8080
//! (needs `curl` on PATH for the HTTP query)

use std::net::UdpSocket;
use std::process::Command;
use std::time::{Duration, Instant};

use ruview_laptop_node::{Adr018Frame, ApReading, SlotMapper};

/// Small deterministic PRNG so runs are reproducible.
struct Lcg(u64);
impl Lcg {
    fn next(&mut self) -> f64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        ((self.0 >> 11) as f64) / ((1u64 << 53) as f64)
    }
}

fn main() {
    let mut args = std::env::args().skip(1);
    let server = args.next().unwrap_or_else(|| "127.0.0.1:5005".into());
    let http = args
        .next()
        .unwrap_or_else(|| "http://127.0.0.1:8080".into());
    let gain: f64 = args.next().and_then(|g| g.parse().ok()).unwrap_or(8.0);

    let sock = UdpSocket::bind("0.0.0.0:0").unwrap();
    let mut mapper = SlotMapper::new(gain, Duration::from_secs(20), Duration::from_secs(90));
    let mut rng = Lcg(42);
    let neighbours: Vec<ApReading> = (0..6u8)
        .map(|i| ApReading {
            bssid: [i + 10; 6],
            ssid: format!("n{i}"),
            rssi_dbm: -60.0 - 5.0 * f64::from(i),
            freq_mhz: 2412,
        })
        .collect();

    let start = Instant::now();
    let period = Duration::from_millis(100);
    let mut next = start;
    let mut seq = 0u32;
    let mut walk_phase = 0.0f64;
    let mut next_print = start;
    println!(
        "{:>5}  {:<11} {:>7} {:>9}  {}",
        "t(s)", "phase", "rssi", "presence", "motion_level"
    );
    while start.elapsed() < Duration::from_secs(110) {
        let t = start.elapsed().as_secs_f64();
        let phase = if t < 40.0 {
            "empty"
        } else if t < 70.0 {
            "walking"
        } else {
            "empty again"
        };
        let base = -55.0;
        let rssi = match phase {
            "walking" => {
                walk_phase += 0.1 * (0.6 + 0.8 * rng.next());
                let swing = 3.0 + 5.0 * rng.next();
                (base + swing * (walk_phase * std::f64::consts::TAU * 0.7).sin()).round()
            }
            _ => {
                let j = rng.next();
                base + if j < 0.15 {
                    -1.0
                } else if j > 0.85 {
                    1.0
                } else {
                    0.0
                }
            }
        };
        let now = Instant::now();
        mapper.set_connected([1; 6], rssi, now);
        if seq % 20 == 0 {
            mapper.update_neighbours(&neighbours, now);
        }
        let frame = Adr018Frame {
            node_id: 1,
            freq_mhz: 2437,
            sequence: seq,
            rssi_dbm: rssi as i8,
            noise_floor_dbm: -95,
            amplitudes: mapper.amplitudes(now),
        };
        sock.send_to(&frame.encode(), &server).unwrap();
        seq += 1;

        if now >= next_print {
            next_print += Duration::from_secs(2);
            let out = Command::new("curl")
                .args(["-s", "-m", "1", &format!("{http}/api/v1/sensing/latest")])
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
                .unwrap_or_default();
            let field = |k: &str| {
                out.find(&format!("\"{k}\":"))
                    .map(|i| {
                        out[i + k.len() + 3..]
                            .split([',', '}'])
                            .next()
                            .unwrap_or("")
                            .trim_matches('"')
                            .to_string()
                    })
                    .unwrap_or_else(|| "?".into())
            };
            println!(
                "{:>5.0}  {:<11} {:>7.0} {:>9}  {}  (source={})",
                t,
                phase,
                rssi,
                field("presence"),
                field("motion_level"),
                field("source")
            );
        }
        next += period;
        if let Some(d) = next.checked_duration_since(Instant::now()) {
            std::thread::sleep(d);
        }
    }
}
