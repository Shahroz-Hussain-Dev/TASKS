# Raahi — design & UX specification (v2 "Sunrise")

Raahi is a fair-price ride-hailing app for Pakistan (inDrive model): the passenger names a fare, nearby drivers accept or counter-bid, the passenger picks a driver. 100% of the fare goes to the driver; drivers pay PKR 1,000 / month. v2 replaces the dark fintech look with a **light, warm, friendly, unmistakably premium** identity built around a 3D cartoon assistant ("Buddy") and voice booking.

## 1. Identity: "Sunrise"
Mood words: warm, soft, playful-but-grown-up, generous whitespace, tactile. Think a premium toy brand meets a modern bank: cream paper, coral sun, teal water, sticker-like cards, jelly buttons, a cartoon mascot that reacts to what you do. Nothing may look like a generic Tailwind template: no plain grey borders, no 8px-radius boxes, no default blue.

### Palette (tokens in `apps/mobile/src/styles/global.css`)
| Token | Hex | Use |
|---|---|---|
| `paper-50` | #FFFBF5 | app background (warm cream) |
| `paper-100` | #FFF4E8 | section bands, chips background |
| `paper-200` | #F6E9D8 | hairlines, dividers |
| `card` | #FFFFFF | cards |
| `ink-900` | #1F1B2D | headings |
| `ink-700` | #3C3650 | body |
| `ink-500` | #6B6478 | secondary text |
| `ink-300` | #A39CB0 | placeholders, disabled |
| `coral-500` | #FF6B4A | primary action, passenger brand |
| `coral-600` | #F2552F | pressed / shadow edge |
| `coral-100` | #FFE9E2 | tint |
| `teal-500` | #12A594 | driver brand, success-ish, map route |
| `teal-600` | #0E8A7B | pressed |
| `teal-100` | #DCF4EF | tint |
| `sun-500` | #FFC53D | money, highlights |
| `sun-100` | #FFF2CC | tint |
| `lavender-500` | #8B7CF6 | comfort tier, info |
| `lavender-100` | #ECE9FF | tint |
| `sky-500` | #3DA9FC | moto tier, user location |
| `sky-100` | #E1F1FF | tint |
| `mint-500` | #2FBF71 | success |
| `rose-500` | #F4537E | danger |

Category colours: Moto = sky, Rickshaw = sun, Ride = coral, Ride AC = teal, Comfort = lavender — each category chip/card uses its tint background + 500 icon.
Gradients: `sunrise` (coral → sun, 135°) for hero/primary surfaces; `lagoon` (teal → sky) for driver surfaces. Use sparingly (one per screen).

### Typography
- Display: **Fredoka** (`font-display`, weights 500–600) — rounded, friendly, big (28–36px titles with -0.01em tracking).
- Body: **Nunito** (`font-sans`, 400–800) — 15–16px body, 13px captions, bold labels.
- Numbers (fares) in Fredoka 600, tabular.

### Icons
**Phosphor Icons, duotone weight** (`@phosphor-icons/react`, `weight="duotone"`), 22–26px, coloured with the surface's accent (duotone layer at 25%). Lucide is not used in the mobile app any more. Tab bar icons switch to `fill` weight when active.

### Shape & depth
- Cards: radius 28px, white, **pillow shadow** `0 10px 30px -12px rgb(63 42 20 / 0.18), 0 1px 0 rgb(255 255 255) inset`, no visible border (optional 1px `paper-200` hairline on busy screens).
- **Jelly buttons**: 56px pill, solid colour with a 4px darker bottom edge (`box-shadow: 0 4px 0 <600>`), on tap translateY(3px) + edge 1px (squash). Secondary = cream fill with ink text and `paper-200` edge. Icon buttons 48px circles with the same edge treatment.
- **Sticker cards**: highlighted items (recommended fare, winning bid, "You're online") get a slight rotation (-1.5°/+1°) and a thick white outline (`outline: 4px solid white`) over a tinted blob background.
- Blobs: organic shapes (`border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%`) in tints behind hero elements and empty states, slowly morphing (`@keyframes blob`).
- Inputs: 56px, cream fill `paper-100`, radius 20px, 2px coral focus ring with offset, duotone leading icon.
- Chips: 40px pills, tint background + 500 text; selected = solid 500 + white text with a tiny bounce.
- Status bar/safe areas: light status bar (dark icons). Background always `paper-50`; map screens show the map edge-to-edge under floating cards.

## 2. Motion (the signature) — `apps/mobile/src/lib/motion.ts`
- **Page transitions** (`pageVariants`): incoming page rises from 24px with scale 0.97 → 1 and a spring overshoot (stiffness 380, damping 30), outgoing drops 12px and fades in 180ms. Back navigation reverses direction. Route groups keep tab shells mounted.
- **Jelly**: every tappable uses `pressJelly` (whileTap scale 0.96 + translateY 3px). Primary CTAs idle with a very subtle breathing scale (1 → 1.015, 3 s) when they are the next step.
- **Stagger in from different edges**: `stagger()` + `item.up/down/left/right/pop` — headers from top, hero from left, cards from bottom, side actions from right, chips `pop` (scale 0.6 → 1 bouncy).
- **Shared layout**: tab indicator, category selection and the fare "thumb" use `layoutId` morphs.
- **Lists**: `AnimatePresence` + `layout` so bids/requests slide in and reorder.
- **Numbers**: `<Money>` springs; countdown rings animate `pathLength`.
- **Delight moments**: confetti (canvas-confetti) on driver approval and ride completion; Buddy jumps when a bid arrives; haptics on all key actions.
- Durations ≤ 450ms for layout; ambient loops allowed (blobs, Buddy idle). Respect reduced motion.

## 3. Buddy — the 3D assistant (`apps/mobile/src/components/buddy/`)
A small round cartoon character rendered with react-three-fiber (procedural geometry, toon-shaded, no external models): cream body, coral cheeks, big friendly eyes, a tiny teal driver's cap, an antenna ending in a glowing location pin, stubby arms. Soft contact shadow. States drive animation:
- `idle`: gentle bob + blink every 3–5 s + occasional head tilt.
- `listening`: leans forward, antenna pin pulses coral, ears (cap) wiggle.
- `thinking`: looks up, slow spin of a small halo of dots.
- `speaking`: bounces with the speech, mouth bars animate.
- `happy`: jump + spin + confetti; `sad`: droop (ride cancelled).
Exports: `<Buddy state size />` (canvas, transparent), `<BuddyBubble />` (floating 64px button bottom-right on Home screens that opens the Assistant sheet; shows a speech bubble hint "Say where you want to go" the first time).

## 4. Voice assistant (Assistant sheet + `/api/assistant/chat`)
- Open from the Buddy bubble or the mic in the "Where to?" card. Full-height sheet: Buddy (large) at top, transcript bubbles, suggestion chips, bottom: big mic jelly button (press to talk; waveform while listening), text input fallback.
- Speech-to-text: `@capacitor-community/speech-recognition` on Android, Web Speech API on web; language from Settings (English (Pakistan) / Urdu). Text-to-speech: `@capacitor-community/text-to-speech` / `speechSynthesis`, toggle in Settings.
- Brain: POST `/api/assistant/chat` with the running transcript + context (role, GPS, active request/ride). The server runs Gemini with function tools (search places, quote, create request with the recommended or user-stated offer within the fair range, raise offer, cancel, go online/offline for drivers, FAQ). The assistant asks one question at a time (destination → category → confirm fare), then acts and returns `{ reply, actions, suggestions }`; the app speaks the reply, renders chips for suggestions and performs actions (navigate to the bidding screen).
- Header `X-Assistant-Key`: when the user saved their own Gemini key in Settings it is sent and used instead of the server key.

## 5. Settings tab (`/settings`)
Rows: AI assistant (key field with show/hide, "Test key"), Voice (language, auto-speak replies), Appearance (Buddy on home: on/off), Notifications, Server (hidden behind long-press as before), About. Light cards, duotone icons.

## 6. Screens — same flows as v1, restyled
All flows from v1 stay identical in behaviour (customer: home → plan → bidding → ride → rate; driver: onboarding → online → feed → bid → ride → earnings; shared: welcome, auth, profile, notifications, support, ride detail/chat). Restyle rules:
- Welcome: cream background with morphing blobs, Buddy waving (3D) as the hero, three sticker-style story cards, role cards as big jelly buttons (coral "I need a ride", teal "I want to drive").
- Home (customer): light map (custom light palette, see Map.tsx), cream top greeting card with Buddy bubble, "Where to?" sticker card with mic.
- Plan ride: category carousel of tinted sticker cards with duotone icons; fare composer as a sun-tinted card with a big Fredoka amount and a rainbow range bar.
- Bidding: coral radar, bid cards as white pillows sliding in from the right with countdown rings; Accept = coral jelly.
- Ride: status pill morphs colour per state; driver card with large plate "sticker".
- Driver home: teal identity (online toggle is a teal jelly pill), request cards with sun-tinted offer.
- Earnings: teal hero card, playful bar chart with rounded bars.
- Onboarding: step rail as a path with Buddy walking along it; document tiles as polaroids (slight rotation, white frame).
- Support: Buddy as the agent avatar, bubbles in cream/teal.
Copy stays warm and short. Emoji still not used in UI chrome.

## 7. Admin panel
Admin keeps its own tokens but moves to the same light "Sunrise" palette (paper background, ink text, coral/teal accents, Fredoka/Nunito, Phosphor icons) so the brand is one system. Dense tables keep 12–13px type; charts use coral/teal/sun/lavender/sky.
