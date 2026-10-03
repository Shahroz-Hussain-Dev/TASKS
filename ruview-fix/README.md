# RuView on Windows without ESP32 boards

This folder makes RuView Desktop v0.4.1 run end to end on a Windows laptop
with no extra hardware:

| Piece | What it does |
|---|---|
| `sensing-server.exe` | The sensing server that RuView Desktop's **Start Server** button launches. The desktop installer does not include it. Built from RuView's source with `compat.patch`. |
| `ruview-laptop-node.exe` | **Turns your laptop into a RuView node.** It reads your WiFi adapter's signal strength 10 times a second and streams it to the server in the same ESP32 frame format the boards use. It also answers RuView Desktop's node discovery. |
| `ui/` | RuView's live web dashboard, served by the server at <http://localhost:8080/ui/index.html>. Three.js is bundled so it works offline. |
| `install-sensing-server.ps1` | Installs all of the above, then self-tests the server and the live WiFi stream. |
| `uninstall.ps1` | Removes everything the installer added. |
| `laptop-node/` | Source code of `ruview-laptop-node.exe` (Rust). |

## Install

1. Download this `ruview-fix` folder (or the zip) to your Windows PC and extract it.
2. Right-click `install-sensing-server.ps1` and choose **Run with PowerShell**.
   Accept the administrator prompt. If Windows blocks the script, run this
   in PowerShell from the folder:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-sensing-server.ps1
   ```
   At the end you should see two green lines:
   ```
   [OK] the sensing server runs on this PC.
   [OK] your laptop WiFi is streaming live into RuView (RSSI -52 dBm).
   ```
3. Close RuView Desktop completely and open it again.
4. **Sensing → Start Server**. The Dashboard shows the server as **Running**.
5. **Dashboard → Scan Network**. Your laptop appears as an **online node**,
   named "Laptop WiFi".
6. Open <http://localhost:8080/ui/index.html> and choose the **Sensing** tab
   for the live view: connection, RSSI graph, signal features, a heat-map and
   presence/motion classification.

If SmartScreen warns about the `.exe` files, click **More info → Run anyway**.
They are unsigned because they were built from source.

> RuView Desktop v0.4.1's own **Sensing** page shows sample log lines and
> activities built into the app; it does not read the server. Use the web
> dashboard (step 6) for the real live data.

## How the laptop node works, and its limits

ESP32 boards report **CSI**: amplitude and phase on dozens of WiFi
subcarriers, many times a second. A normal laptop WiFi card does not expose
CSI to Windows. It exposes **RSSI** (signal strength in dBm) for the network
you are connected to, plus the routers in its last scan.

When a person moves between your laptop and the router, the RSSI fluctuates.
The laptop node:

1. reads the connected link's RSSI 10 times a second, using the Windows Native WiFi API;
2. reads neighbouring routers from Windows' WiFi scan (it asks for a scan every 15 s);
3. converts each router's RSSI change into one "virtual subcarrier". This is
   the change from that router's own 20-second average, so a still room
   produces a flat signal;
4. sends the result to the server in the ESP32 ADR-018 frame format on UDP 5005.

The server then runs its normal real-time pipeline on it.

**What works:** live presence and motion detection for someone moving in
the room, especially between the laptop and the router. The live RSSI graph
and signal features also work. In tests here, a walking pattern was flagged
as `present_moving` / `active` within about 15 seconds. An empty room with
normal ±1 dB jitter stayed `absent`, and the label returned to `absent`
about 10 seconds after movement stopped.

**What does not work without CSI hardware:** reliable breathing and heart
rate, 17-point pose, and through-wall accuracy. RSSI is a single coarse
number per router (1 dB steps), so those fields may show values, but they are
not trustworthy. For those features you need ESP32-S3 boards (see below).
The dashboard labels the stream "ESP32 hardware" because the laptop node uses
the ESP32 frame format. The data really comes from your laptop's WiFi.

**Tips for better results:**

- Put the laptop so people walk between it and the router (2–5 m apart works well).
- Keep the laptop still, connected to WiFi, and on mains power. Some power-saving
  modes make the WiFi adapter report RSSI less often.
- Windows 11 24H2 and later: turn on **Settings → Privacy & security →
  Location → Location services** and **Let desktop apps access your location**.
  Without it Windows hides scan results from programs, and the node falls back
  to the connected link only. The installer opens this page if location is off.
- Sensitivity can be changed with `--gain` (default 8). Higher values reacted
  faster in testing but gave false "present" readings in an empty room.

The node logs to `%LOCALAPPDATA%\RuView\laptop-node.log`. To watch it live in
a terminal:
```powershell
& "$env:LOCALAPPDATA\RuView\bin\ruview-laptop-node.exe" --help
Get-Content "$env:LOCALAPPDATA\RuView\laptop-node.log" -Wait
```

## Adding ESP32 boards later

The installer also prepares the PC for real boards:

- the server accepts ESP32 data from your local network (`RUVIEW_UDP_BIND=0.0.0.0`,
  `RUVIEW_UDP_ALLOW=<your subnet>`), not only from this PC;
- Windows Firewall allows UDP 5005/5006 on Private networks.

Flash the `esp32-csi-node` firmware from **Flash** in RuView Desktop
(releases: <https://github.com/ruvnet/RuView/releases>). Then provision the
board with your WiFi details and this PC's IP address. The boards and the
laptop node can run side by side, each as its own node.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Server still "Stopped" | Run `& "$env:LOCALAPPDATA\RuView\bin\sensing-server.exe"` in PowerShell and read the error. |
| No node after Scan Network | Check that `ruview-laptop-node.exe` is running in Task Manager, and read its log. Set your WiFi network's profile to **Private**: the firewall rules for discovery only apply to Private networks. |
| Node log says "access denied" | Turn on Location services for desktop apps (see Tips). |
| Node log says "not connected" | Connect the laptop to a WiFi network. Ethernet-only does not work. |
| Dashboard shows "Reconnecting" | Start the server first, then reload the page. |

## Build provenance

- Server: <https://github.com/ruvnet/RuView> at commit
  `03a897938f65c1215d4612e9a7d800645d27d869`, plus `compat.patch`. The patch:
  - accepts the `--log-level` / `--bind` flags RuView Desktop v0.4.x sends;
  - keeps data in `%LOCALAPPDATA%\RuView\data`;
  - finds `ui\` next to the executable;
  - loads Three.js locally in the web UI.
- Built with Rust 1.89 / MinGW-w64 (`x86_64-pc-windows-gnu`). `ruview-laptop-node`
  was built with stable Rust from `laptop-node/`.
- Tests run in a Linux sandbox. No Windows PC was available, so the Windows
  programs ran under Wine:
  - `laptop-node` unit tests: frame layout, signal mapping, discovery reply.
  - The mDNS advertisement resolved through the same `mdns-sd` library RuView Desktop uses.
  - A synthetic RSSI replay through the real server
    (`laptop-node/examples/pipeline_check.rs`).
  - The Windows server under Wine with the exact flags RuView Desktop v0.4.1 sends.
  - The live web dashboard in headless Chromium.

  Wine has no WiFi hardware, so the Windows WiFi API calls are first exercised
  by the installer's self-test on your PC.
- Checksums: `SHA256SUMS.txt`.
