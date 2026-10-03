//! Core of the RuView laptop node: turns WiFi RSSI readings into the ESP32
//! ADR-018 CSI frame format the RuView sensing server ingests on UDP 5005,
//! and answers RuView Desktop's node discovery.
//!
//! A laptop WiFi adapter cannot report Channel State Information (CSI), only
//! received signal strength (RSSI) per access point. People moving between the
//! laptop and the access points change those RSSI values, which is what the
//! server's motion / presence pipeline picks up. Each frame therefore carries
//! one "virtual subcarrier" per access point:
//!
//! * slot 0 is the connected access point, read at the full frame rate;
//! * slots 1.. are neighbouring access points from the last WiFi scan.
//!
//! Each slot's amplitude is the RSSI *deviation from its own slow baseline*,
//! centred on [`CENTER`]. A quiet room therefore produces a flat frame, and
//! only real fluctuations show up as variance — static differences between
//! strong and weak access points would otherwise look like permanent motion.

use std::collections::HashMap;
use std::time::{Duration, Instant};

/// ADR-018 frame magic (`csi_collector.c` in the ESP32 firmware).
pub const ADR018_MAGIC: u32 = 0xC511_0001;
/// Amplitude a slot sits at when its RSSI equals its baseline.
pub const CENTER: f64 = 64.0;
/// Number of virtual subcarriers per frame (1 connected AP + 7 neighbours).
pub const SLOTS: usize = 8;
/// UDP port RuView Desktop sends `RUVIEW_DISCOVER` probes to.
pub const DISCOVERY_PORT: u16 = 5006;
/// mDNS service type RuView Desktop browses for.
pub const MDNS_SERVICE_TYPE: &str = "_ruview._udp.local.";
/// Version string reported to RuView Desktop.
pub const NODE_VERSION: &str = concat!("laptop-wifi-", env!("CARGO_PKG_VERSION"));

/// One access point seen in a WiFi scan.
#[derive(Debug, Clone, PartialEq)]
pub struct ApReading {
    pub bssid: [u8; 6],
    pub ssid: String,
    pub rssi_dbm: f64,
    pub freq_mhz: u32,
}

/// The ADR-018 header fields plus per-subcarrier I/Q bytes.
#[derive(Debug, Clone, PartialEq)]
pub struct Adr018Frame {
    pub node_id: u8,
    pub freq_mhz: u32,
    pub sequence: u32,
    pub rssi_dbm: i8,
    pub noise_floor_dbm: i8,
    /// Amplitude per subcarrier, 0..=127 (encoded as I with Q = 0).
    pub amplitudes: Vec<u8>,
}

impl Adr018Frame {
    /// Serialise to the wire layout parsed by `parse_esp32_frame` in the
    /// sensing server:
    ///
    /// ```text
    /// [0..3]   magic (u32 LE)      [12..15] sequence (u32 LE)
    /// [4]      node_id             [16]     rssi (i8)
    /// [5]      n_antennas          [17]     noise_floor (i8)
    /// [6..7]   n_subcarriers (LE)  [18]     PPDU type
    /// [8..11]  freq_mhz (u32 LE)   [19]     ADR-018 flags
    /// [20..]   I/Q pairs (i8, i8) per subcarrier
    /// ```
    pub fn encode(&self) -> Vec<u8> {
        let n = self.amplitudes.len().min(u16::MAX as usize);
        let mut buf = Vec::with_capacity(20 + n * 2);
        buf.extend_from_slice(&ADR018_MAGIC.to_le_bytes());
        buf.push(self.node_id);
        buf.push(1); // n_antennas
        buf.extend_from_slice(&(n as u16).to_le_bytes());
        buf.extend_from_slice(&self.freq_mhz.to_le_bytes());
        buf.extend_from_slice(&self.sequence.to_le_bytes());
        buf.push(self.rssi_dbm as u8);
        buf.push(self.noise_floor_dbm as u8);
        buf.push(0); // PPDU type: HT/legacy
        buf.push(0); // ADR-018 flags: none
        for &a in &self.amplitudes[..n] {
            buf.push(a.min(127)); // I
            buf.push(0); // Q
        }
        buf
    }
}

#[derive(Debug, Clone)]
struct Slot {
    bssid: [u8; 6],
    rssi_dbm: f64,
    baseline_dbm: f64,
    last_seen: Instant,
}

/// Maps RSSI readings onto a fixed set of virtual subcarriers.
#[derive(Debug, Clone)]
pub struct SlotMapper {
    /// Amplitude units per dB of deviation from baseline.
    gain: f64,
    /// Baseline EMA time constant.
    baseline_tau: Duration,
    /// Neighbour slots not refreshed for this long are released.
    stale_after: Duration,
    connected: Option<Slot>,
    neighbours: Vec<Option<Slot>>,
    last_update: Option<Instant>,
}

impl SlotMapper {
    pub fn new(gain: f64, baseline_tau: Duration, stale_after: Duration) -> Self {
        Self {
            gain,
            baseline_tau,
            stale_after,
            connected: None,
            neighbours: vec![None; SLOTS - 1],
            last_update: None,
        }
    }

    /// Record the connected access point's RSSI (read every frame).
    pub fn set_connected(&mut self, bssid: [u8; 6], rssi_dbm: f64, now: Instant) {
        match &mut self.connected {
            Some(s) if s.bssid == bssid => {
                s.rssi_dbm = rssi_dbm;
                s.last_seen = now;
            }
            // Roamed to another AP (or first reading): start a fresh baseline.
            _ => {
                self.connected = Some(Slot {
                    bssid,
                    rssi_dbm,
                    baseline_dbm: rssi_dbm,
                    last_seen: now,
                });
            }
        }
    }

    /// Feed the result of a WiFi scan. Neighbours keep their slot while they
    /// stay visible; free slots go to the strongest unassigned APs.
    pub fn update_neighbours(&mut self, readings: &[ApReading], now: Instant) {
        let connected_bssid = self.connected.as_ref().map(|s| s.bssid);
        let by_bssid: HashMap<[u8; 6], f64> = readings
            .iter()
            .filter(|r| Some(r.bssid) != connected_bssid)
            .map(|r| (r.bssid, r.rssi_dbm))
            .collect();

        for slot in self.neighbours.iter_mut() {
            if let Some(s) = slot {
                if let Some(&rssi) = by_bssid.get(&s.bssid) {
                    s.rssi_dbm = rssi;
                    s.last_seen = now;
                } else if now.duration_since(s.last_seen) > self.stale_after {
                    *slot = None;
                }
            }
        }

        let mut candidates: Vec<(&[u8; 6], &f64)> = by_bssid
            .iter()
            .filter(|(b, _)| !self.neighbours.iter().flatten().any(|s| &s.bssid == *b))
            .collect();
        candidates.sort_by(|a, b| b.1.total_cmp(a.1).then(a.0.cmp(b.0)));
        let mut candidates = candidates.into_iter();
        for slot in self.neighbours.iter_mut().filter(|s| s.is_none()) {
            match candidates.next() {
                Some((&bssid, &rssi_dbm)) => {
                    *slot = Some(Slot {
                        bssid,
                        rssi_dbm,
                        baseline_dbm: rssi_dbm,
                        last_seen: now,
                    })
                }
                None => break,
            }
        }
    }

    /// Advance the baselines to `now` and return one amplitude per slot.
    pub fn amplitudes(&mut self, now: Instant) -> Vec<u8> {
        let dt = self
            .last_update
            .map(|t| now.saturating_duration_since(t).as_secs_f64())
            .unwrap_or(0.0);
        self.last_update = Some(now);
        let alpha = 1.0 - (-dt / self.baseline_tau.as_secs_f64().max(1e-3)).exp();
        let gain = self.gain;

        let mut out = Vec::with_capacity(SLOTS);
        for slot in std::iter::once(&mut self.connected).chain(self.neighbours.iter_mut()) {
            let amp = match slot {
                Some(s) => {
                    let a = CENTER + gain * (s.rssi_dbm - s.baseline_dbm);
                    s.baseline_dbm += alpha * (s.rssi_dbm - s.baseline_dbm);
                    a
                }
                None => CENTER,
            };
            out.push(amp.round().clamp(1.0, 127.0) as u8);
        }
        out
    }

    /// Number of neighbour access points currently tracked.
    pub fn neighbour_count(&self) -> usize {
        self.neighbours.iter().flatten().count()
    }
}

/// Reply to a `RUVIEW_DISCOVER` probe, in the format RuView Desktop parses:
/// `RUVIEW_BEACON|<mac>|<node_id>|<version>|<chip>|<role>|<tdm_slot>|<tdm_total>`.
pub fn beacon_reply(mac: &str, node_id: u8) -> String {
    format!("RUVIEW_BEACON|{mac}|{node_id}|{NODE_VERSION}|laptop-wifi|node|0|1")
}

/// Answer every `RUVIEW_DISCOVER` probe arriving on `sock` with `reply`, on a
/// background thread.
pub fn spawn_discovery_responder(
    sock: std::net::UdpSocket,
    reply: String,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut buf = [0u8; 512];
        loop {
            match sock.recv_from(&mut buf) {
                Ok((n, from)) if buf[..n].starts_with(b"RUVIEW_DISCOVER") => {
                    let _ = sock.send_to(reply.as_bytes(), from);
                }
                Ok(_) => {}
                Err(_) => std::thread::sleep(Duration::from_millis(200)),
            }
        }
    })
}

/// Advertise this node as `_ruview._udp` over mDNS with the TXT properties
/// RuView Desktop reads (mac, node_id, version, chip, role, name, ...).
pub fn register_mdns(
    host: &str,
    mac: &str,
    node_id: u8,
    data_port: u16,
) -> Result<mdns_sd::ServiceDaemon, String> {
    let host = host.to_lowercase();
    let daemon = mdns_sd::ServiceDaemon::new().map_err(|e| e.to_string())?;
    let name = format!("Laptop WiFi ({host})");
    let node_id = node_id.to_string();
    let props = [
        ("mac", mac),
        ("node_id", node_id.as_str()),
        ("version", NODE_VERSION),
        ("chip", "laptop-wifi"),
        ("role", "node"),
        ("csi", "0"),
        ("ota", "0"),
        ("wasm", "0"),
        ("name", name.as_str()),
    ];
    let info = mdns_sd::ServiceInfo::new(
        MDNS_SERVICE_TYPE,
        &format!("ruview-laptop-{host}"),
        &format!("{host}.local."),
        "",
        data_port,
        &props[..],
    )
    .map_err(|e| e.to_string())?
    .enable_addr_auto();
    daemon.register(info).map_err(|e| e.to_string())?;
    Ok(daemon)
}

/// Format a MAC address as `aa:bb:cc:dd:ee:ff`.
pub fn format_mac(mac: &[u8; 6]) -> String {
    mac.iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(":")
}

/// A stable, locally administered MAC for this node, derived from the WiFi
/// interface GUID (the WLAN API does not expose the adapter MAC).
pub fn node_mac_from_guid(guid_bytes: &[u8; 16]) -> [u8; 6] {
    let mut mac = [0u8; 6];
    for (i, b) in guid_bytes.iter().enumerate() {
        mac[i % 6] ^= b.rotate_left((i / 6) as u32);
    }
    mac[0] = (mac[0] & 0xFC) | 0x02; // unicast, locally administered
    mac
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mapper() -> SlotMapper {
        SlotMapper::new(8.0, Duration::from_secs(20), Duration::from_secs(60))
    }

    #[test]
    fn encode_matches_server_layout() {
        let f = Adr018Frame {
            node_id: 3,
            freq_mhz: 2437,
            sequence: 0x0102_0304,
            rssi_dbm: -52,
            noise_floor_dbm: -95,
            amplitudes: vec![64, 70, 200],
        };
        let b = f.encode();
        assert_eq!(b.len(), 20 + 3 * 2);
        assert_eq!(
            u32::from_le_bytes(b[0..4].try_into().unwrap()),
            ADR018_MAGIC
        );
        assert_eq!(b[4], 3);
        assert_eq!(b[5], 1);
        assert_eq!(u16::from_le_bytes([b[6], b[7]]), 3);
        assert_eq!(u32::from_le_bytes(b[8..12].try_into().unwrap()), 2437);
        assert_eq!(
            u32::from_le_bytes(b[12..16].try_into().unwrap()),
            0x0102_0304
        );
        assert_eq!(b[16] as i8, -52);
        assert_eq!(b[17] as i8, -95);
        assert_eq!(&b[20..], &[64, 0, 70, 0, 127, 0]);
    }

    #[test]
    fn steady_signal_is_flat() {
        let mut m = mapper();
        let t0 = Instant::now();
        m.set_connected([1; 6], -50.0, t0);
        m.update_neighbours(
            &[ApReading {
                bssid: [2; 6],
                ssid: "n".into(),
                rssi_dbm: -80.0,
                freq_mhz: 2412,
            }],
            t0,
        );
        let a = m.amplitudes(t0);
        assert_eq!(a.len(), SLOTS);
        assert!(a.iter().all(|&x| x == CENTER as u8), "{a:?}");
    }

    #[test]
    fn deviation_scales_with_gain_and_baseline_recovers() {
        let mut m = mapper();
        let t0 = Instant::now();
        m.set_connected([1; 6], -50.0, t0);
        m.amplitudes(t0);
        m.set_connected([1; 6], -53.0, t0 + Duration::from_millis(100));
        let a = m.amplitudes(t0 + Duration::from_millis(100));
        assert_eq!(a[0], (CENTER - 24.0) as u8);
        // Hold the new level for several baseline time constants.
        let mut t = t0 + Duration::from_millis(100);
        for _ in 0..1200 {
            t += Duration::from_millis(100);
            m.amplitudes(t);
        }
        assert_eq!(m.amplitudes(t)[0], CENTER as u8);
    }

    #[test]
    fn neighbour_slots_are_sticky_and_expire() {
        let mut m = mapper();
        let t0 = Instant::now();
        m.set_connected([1; 6], -50.0, t0);
        let ap = |b: u8, r: f64| ApReading {
            bssid: [b; 6],
            ssid: String::new(),
            rssi_dbm: r,
            freq_mhz: 2412,
        };
        m.update_neighbours(&[ap(1, -50.0), ap(2, -60.0), ap(3, -70.0)], t0);
        assert_eq!(
            m.neighbour_count(),
            2,
            "connected AP must not take a neighbour slot"
        );
        let slot_of = |m: &SlotMapper, b: u8| {
            m.neighbours
                .iter()
                .position(|s| s.as_ref().map(|s| s.bssid) == Some([b; 6]))
        };
        let s2 = slot_of(&m, 2);
        // AP 4 appears stronger; AP 2 keeps its slot.
        m.update_neighbours(
            &[ap(2, -61.0), ap(3, -70.0), ap(4, -40.0)],
            t0 + Duration::from_secs(5),
        );
        assert_eq!(slot_of(&m, 2), s2);
        assert_eq!(m.neighbour_count(), 3);
        // AP 3 disappears for longer than stale_after.
        m.update_neighbours(&[ap(2, -61.0), ap(4, -40.0)], t0 + Duration::from_secs(70));
        assert_eq!(slot_of(&m, 3), None);
    }

    #[test]
    fn discovery_responder_answers_probe() {
        use std::net::UdpSocket;
        let server = UdpSocket::bind("127.0.0.1:0").unwrap();
        let addr = server.local_addr().unwrap();
        spawn_discovery_responder(server, beacon_reply("02:00:00:00:00:01", 1));
        let client = UdpSocket::bind("127.0.0.1:0").unwrap();
        client
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        client.send_to(b"hello", addr).unwrap(); // ignored
        client.send_to(b"RUVIEW_DISCOVER", addr).unwrap();
        let mut buf = [0u8; 256];
        let (n, _) = client.recv_from(&mut buf).unwrap();
        let text = std::str::from_utf8(&buf[..n]).unwrap();
        assert!(
            text.starts_with("RUVIEW_BEACON|02:00:00:00:00:01|1|"),
            "{text}"
        );
    }

    #[test]
    fn beacon_and_mac_format() {
        let mac = node_mac_from_guid(&[7u8; 16]);
        assert_eq!(mac[0] & 0x03, 0x02);
        let s = format_mac(&mac);
        assert_eq!(s.len(), 17);
        let reply = beacon_reply(&s, 1);
        let parts: Vec<&str> = reply.split('|').collect();
        assert_eq!(parts[0], "RUVIEW_BEACON");
        assert_eq!(parts[1], s);
        assert_eq!(parts[2], "1");
        assert_eq!(parts.len(), 8);
    }
}
