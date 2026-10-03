# Fixing RuView Desktop: "Sensing Server: Stopped"

## Why it happens

RuView Desktop v0.4.1 is only the control panel. Its **Start Server** button
starts a second program, `wifi-densepose-sensing-server.exe`. The Windows
installer (`.msi` / `.exe`) does not include that program, so the server
never starts. There is a second bug too: v0.4.1 always passes a `--log-level`
flag that the upstream server rejects. Because of that, even an official
server build exits as soon as it starts.

This folder contains a Windows build of the RuView sensing server. It was
built from the RuView source (`ruvnet/RuView`, `v2/crates/wifi-densepose-sensing-server`)
with a small compatibility patch (`compat.patch`). The patch makes the server:

- accept `--log-level` and `--bind`, the flags that RuView Desktop v0.4.x sends;
- keep its data in `%LOCALAPPDATA%\RuView\data`, because the RuView install
  folder in Program Files is read-only.

## Install (Windows 10/11)

1. Download this `ruview-fix` folder. On GitHub, open each file and click
   **Download raw file**. You need at least `sensing-server.exe` and
   `install-sensing-server.ps1`, saved in the same folder.
2. Right-click `install-sensing-server.ps1` and choose **Run with PowerShell**.
   If Windows blocks it, open PowerShell in that folder and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-sensing-server.ps1
   ```
   Accept the administrator prompt. The script:
   - finds your RuView Desktop folder and copies the server there;
   - also copies it to `%LOCALAPPDATA%\RuView\bin` and adds that folder to your PATH;
   - lets ESP32 boards on your home network send data to the server. It sets
     `RUVIEW_UDP_BIND=0.0.0.0` and `RUVIEW_UDP_ALLOW=<your subnet>`, for
     example `192.168.1.0/24`. Without these, the server accepts data only
     from the PC itself;
   - opens Windows Firewall for UDP 5005/5006 (ESP32 CSI and discovery);
   - checks that the server starts on your PC.
3. Close RuView Desktop completely, then open it again.
4. Open **Sensing** and click **Start Server**. The Dashboard should now
   show the server as **Running**.

If SmartScreen warns about `sensing-server.exe`, click **More info → Run anyway**.
The file is unsigned because it was built from source.

## About "No nodes found"

That message is expected, and you cannot fix it with software alone.
RuView senses people by reading WiFi Channel State Information (CSI) from
**ESP32-S3 (or ESP32-C6) boards** running the RuView firmware. A normal
laptop's WiFi card cannot provide CSI. **Nodes** and **Discovery** list
those boards, so they show 0 until a board is on your network.

With no boards connected, the server runs in **simulated** mode. It produces
demo sensing data that is labelled `simulated`, so you can explore the app.
To get real sensing:

1. Buy an ESP32-S3 dev board (about $9; 3–6 of them for a room mesh).
2. Connect it over USB and go to **Flash** in RuView Desktop. Select the COM
   port and flash the `esp32-csi-node` firmware from
   <https://github.com/ruvnet/RuView/releases> (the `*-esp32` releases).
3. Provision it with your WiFi name and password, and set the target IP to
   your PC's IP address (`ipconfig` → IPv4 address).
4. Click **Scan Network**. The node appears, and the running server switches
   from `simulated` to `esp32` automatically when the first CSI frame arrives.

The PC and the ESP32 boards must be on the same 2.4 GHz WiFi network. Set the
network profile to **Private**, because the firewall rules only apply to
Private/Domain networks.

## Running the server by hand (troubleshooting)

```powershell
& "$env:LOCALAPPDATA\RuView\bin\sensing-server.exe" --source simulated
```

Then open <http://127.0.0.1:8080/health> in a browser. If it returns JSON, the
server works. The server's own web UI and API are on port 8080, and the live
WebSocket stream is on port 8765.

## Build provenance

- Source: <https://github.com/ruvnet/RuView> at commit `03a897938f65c1215d4612e9a7d800645d27d869`, plus `compat.patch`
- Built with: Rust 1.89, `cargo build --release -p wifi-densepose-sensing-server --bin sensing-server --target x86_64-pc-windows-gnu` (MinGW-w64)
- Tested under Wine with the exact flags RuView Desktop v0.4.1 sends
  (`--http-port 8080 --ws-port 8765 --udp-port 5005 --log-level info`):
  `/health` returned `{"status":"ok","source":"simulated"}`, and the UDP
  receiver bound on `0.0.0.0:5005` with the subnet allowlist active.
- SHA-256: see `sensing-server.exe.sha256`
