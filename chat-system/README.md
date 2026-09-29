# Pigeon – serverless one-to-one chat and calls (desktop + Android)

Pigeon is a private, one-to-one chat that works between a **desktop app** (Windows / Linux / macOS) and an **Android app**, from anywhere in the world, with no server of your own to run.

Everything – text, photos, voice notes, files of any size and **whole folders (no zipping)** – travels **directly from one device to the other** over an encrypted WebRTC data channel. The only third party involved is a tiny public "signalling" service that helps the two devices find each other; it never sees message contents or files.

```
chat-system/
├── app/        shared web UI + networking core (vanilla JS, bundled with esbuild)
├── desktop/    Electron wrapper → Windows installer / portable exe, Linux AppImage/deb, macOS dmg
├── mobile/     Capacitor wrapper → Android APK (plus a small native plugin for folder picking,
│               opening received files and keeping the connection alive in the background)
├── tools/      icon generator + end-to-end test (two headless browsers chatting through a local PeerJS server)
└── README.md
```

## Downloads

Every push that touches `chat-system/` runs the GitHub Actions workflow `.github/workflows/chat-system.yml`, which builds all installers and publishes them as a **GitHub Release** on the repository's *Releases* page:

| Platform | File |
| --- | --- |
| Android | `Pigeon.apk` |
| Windows | `Pigeon-Setup-<version>.exe` (installer) or `Pigeon-Portable-<version>.exe` (no install) |
| Linux | `Pigeon-<version>-linux-x86_64.AppImage` or `.deb` |
| macOS | `Pigeon-<version>-mac-*.dmg` |

The same files are also attached to each workflow run as artifacts.

## Install

**Windows laptop** – download `Pigeon-Setup-<version>.exe` and run it. It is a one-click installer that creates a desktop shortcut. The build is not code-signed, so Windows SmartScreen shows a warning the first time: click **More info → Run anyway**.

**Android phone** – download `Pigeon.apk` on the phone and open it. Android asks you to allow installs from your browser or file manager (*Install unknown apps*) – allow it once and tap *Install*. The app asks for microphone and camera (voice notes, calls) and notification permissions when first needed.

**Linux** – `chmod +x Pigeon-*.AppImage && ./Pigeon-*.AppImage`, or install the `.deb`.

**macOS** – open the dmg and drag Pigeon to Applications. The app is unsigned: right-click → **Open** the first time.

## Pairing two devices (first run)

1. Open Pigeon on both devices and enter a display name.
2. Each device shows **Your ID** (8 characters, e.g. `K7PQ2MWX`). Tap *Copy* or *Share* to send it to the other person by any channel.
3. On one device type the other's ID in **Friend's ID** and press *Add*.
4. The other device shows *New chat request → Accept*. Done – the contact turns green when both are online.

From then on the two devices connect automatically whenever both are online.

## What you can send

- Text (with delivery ticks ✓ sent / ✓✓ delivered; messages typed while the other side is offline are queued and sent when they come back)
- Photos and images (inline preview, tap to open), video, audio
- **Voice notes** – tap 🎤, record, tap ✔
- **Any file**, any size – streamed in 64 KB chunks with back-pressure, progress bar, speed and cancel
- **Whole folders** – tap 📁 (desktop: also drag & drop a folder onto the chat). The folder structure is recreated on the receiving side exactly, no zipping
- Paste an image from the clipboard on desktop to send it
- **Voice and video calls** – 📞 / 🎥 in the chat header (enabled while the contact is online). The other side gets a ringing screen with *Answer*, *Answer with video* and *Decline*. In-call controls: mute, camera on/off, switch camera (Android), speaker/earpiece (Android), hang up. Calls are logged in the chat (duration, missed, declined). Media goes peer to peer over the same encrypted WebRTC session as messages.

Received files are saved to:

- Desktop: `Downloads/Pigeon/<contact>/…` (*Open* / *Show in folder* buttons on each message)
- Android: `Documents/Pigeon/<contact>/…` (visible to any file manager / gallery; *Open* button opens with the default app)

## How it works

- **Identity**: each install generates a random 8-character ID (stored locally). No accounts, no phone numbers.
- **Signalling**: the app registers its ID with a PeerJS signalling server (default: the free public `0.peerjs.com`). This exchanges only the small WebRTC handshake (SDP/ICE) messages needed to open a direct connection. You can point the app at any other PeerJS server in *Settings → Advanced*.
- **Transport**: a reliable, ordered WebRTC data channel (DTLS-encrypted end to end). NAT traversal uses public STUN servers; when a direct path is impossible (symmetric NAT, strict firewalls) traffic is relayed through a free public TURN server – still encrypted end to end, the relay only sees ciphertext.
- **Storage**: contacts and chat history live in the device's local IndexedDB; nothing is stored anywhere else.
- **Background (Android)**: a low-priority foreground service keeps the connection alive when the app is not on screen, and incoming messages post a notification.

### Protocol (over the data channel)

JSON text frames for control: `hello`, `msg`, `ack`, `typing`, `ping`/`pong`, `offer` (file/folder manifest), `accept`/`reject`, `fstart`/`fend` (per file), `done`, `complete`, `cancel`, and `call-decline`/`call-busy`/`call-end` for calls (the media itself is a PeerJS media connection next to the data channel). Binary frames are raw file chunks that belong to the current `fstart`ed file. One transfer at a time per direction; text messages interleave freely.

## Limitations (by design of a serverless system)

- **Both devices must be online at the same time** to exchange anything. There is no server to hold messages while the other side is offline; the sender's queue delivers them as soon as the contact reappears.
- No multi-device sync and no group chats – strictly one-to-one.
- Your ID is not reserved on the public signalling server: if you are offline for a long time and someone else happens to generate the same 8-character ID (1 in ~10¹²) you'll be asked to generate a new one.
- Android kills background apps aggressively on some phones (Xiaomi, Huawei, Samsung power saving). Exempt Pigeon from battery optimisation if you want to receive while the screen is off.
- The public PeerJS cloud and the free TURN relay are third-party best-effort services. You can self-host both (PeerJS server is `npm i -g peer && peerjs --port 9000`) and change them in *Settings*.

## Building from source

Requirements: Node 22, and for Android JDK 21 + Android SDK (platform 36, build-tools 36.0.0).

```bash
# 1. shared web app (both wrappers use app/www)
cd chat-system/app && npm ci && npm run build

# 2. desktop
cd ../desktop && npm ci
npm start                      # run it
npm run build:win              # Windows installer + portable (needs wine when run on Linux)
npm run build:linux            # AppImage + deb
npm run build:mac              # dmg (on macOS)

# 3. android
cd ../mobile && npm ci
npm run build:apk              # → mobile/Pigeon.apk (release, signed)
```

The Android release build is signed with the development keystore in `mobile/keystore/` so that every build installs over the previous one. For a store release replace it (env vars `PIGEON_KEYSTORE`, `PIGEON_KEYSTORE_PASS`, `PIGEON_KEY_ALIAS`, `PIGEON_KEY_PASS`).

### Tests

`node tools/e2e.mjs` (needs `playwright-core`, `peer` and `express` installed somewhere reachable via `PW_REQUIRE_FROM=<path to a package.json>` and a Chromium at `CHROMIUM_PATH`). It launches a local PeerJS server and two headless browsers that pair, exchange text, a 3 MB file with integrity check, an image, a nested folder, a voice note recorded from a fake microphone, a video call (ring, answer, media both ways, mute, hang up, call log), a declined call, and verifies offline queueing and history persistence.

`node tools/gen-icons.mjs` regenerates all launcher/installer icons from the SVG in the script.
