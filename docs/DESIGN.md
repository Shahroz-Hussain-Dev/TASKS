# Raahi — design & UX specification

Raahi is a fair-price ride-hailing app for Pakistan (inDrive model): the passenger names a fare, nearby drivers accept or counter-bid, the passenger picks a driver. 100% of the fare goes to the driver; drivers pay PKR 1,000 / month.

## 1. Visual language
- **Mood**: night-time premium fintech. Deep ink surfaces, emerald brand accent, amber for money/attention. Calm, decisive, no clutter. Think "a product Apple would ship if it made inDrive".
- **Palette** (Tailwind tokens from `apps/mobile/src/styles/global.css`): `ink-950…ink-50` surfaces/text, `brand-300…700` emerald, `amber-300…500` money, `rose-400/500` danger, `sky-400` user location, `violet-400` info.
- **Type**: `font-display` (Sora) for headings & numbers, `font-sans` (Manrope) for body. Sizes: display 28–34px, title 22px, body 15–16px, caption 12.5–13.5px. Tight letter-spacing on display.
- **Shape**: cards `rounded-3xl`, controls `rounded-2xl`, chips/pills full. Borders `border-white/6…12`. Shadows `shadow-card`, floating `shadow-float`, brand glow `shadow-glow`.
- **Surfaces**: solid `bg-ink-800` cards for content; `.glass` cards when floating over the map. Use `.aurora` blobs (2–3 max, brand + amber + violet, low opacity) behind hero/empty states.
- **Icons**: `lucide-react`, strokeWidth 2–2.2, 18–22px. No emoji in UI chrome (emoji allowed only inside notification copy).
- **Copy**: short, warm, confident, British/Pakistani English. "Offer", "fare", "PKR 450" (use `pkr()` or `<Money>`). Never lorem ipsum; every string is final product copy.

## 2. Motion rules (the signature)
- Page transitions are handled by `App.tsx` (`pageVariants`). Screens do NOT animate their root.
- Inside a screen, wrap content in `motion.div variants={stagger()} initial="hidden" animate="show"` and give children `variants={item.up | item.down | item.left | item.right | item.scale}`. Vary directions: header from top (`item.down`), hero from left, cards from bottom, side actions from right. 60–90 ms stagger.
- Springs only (`spring`, `springSoft`, `springBouncy` from `lib/motion.ts`); durations ≤ 450 ms for layout, continuous loops allowed for ambient art.
- Every tappable element uses `Button`/`IconButton`/`Chip`/`Card onClick` (they include whileTap). Use `haptic.*` on important actions (bid sent → `success`, error → `error`).
- Lists: `AnimatePresence` with `layout` on items so bids/requests slide in and reorder smoothly.
- Numbers that change (fares, earnings, timers) use `<Money>` or `motion` counters — never jump.
- Bottom sheets via `<Sheet>` (drag-to-dismiss). Map overlays slide up from bottom (`item.up`) and fade.
- Respect `prefers-reduced-motion` implicitly (framer handles) — never block interaction on an animation.

## 3. Layout & platform
- Full-height screens: `<Screen>` (scrollable, safe-area padded) or custom `h-full relative` for map screens. Honour `var(--safe-top)` / `var(--safe-bottom)`.
- Map screens: `<MapView>` fills the screen; floating glass top bar and bottom panel. Keep map padding so pins are not hidden under panels (`padding={{ bottom: 300 }}`).
- Tab shells (`CustomerShell`, `DriverShell`): floating glass tab bar at the bottom (3 tabs max), animated active pill (`layoutId`), hidden on sub-screens.
- Inputs: `Input` from ui; phone fields use `inputMode="tel"`, prefix `+92`; money fields `inputMode="numeric"`.
- Errors: inline under fields; network/server errors via `useToast()`; empty states via `EmptyState` with an illustration where it helps.
- Loading: skeletons (`Skeleton`) for lists; `Button loading` for actions; never a blank screen.
- Images that need auth: `<AuthImage src={dto.url}>` or `<Avatar src>`.
- Data: `@tanstack/react-query`. Polling intervals from docs/API.md; pause polling when `document.hidden` via `refetchIntervalInBackground: false`.

## 4. Customer flows (inDrive parity)
1. **Home** (`/c/home`): map centred on GPS (sky `UserDot`), nearby online drivers as `CarMarker`s (from `GET /api/requests/active` → not available; omit drivers or show none). Floating search card "Where to?" with recent/saved places → `/c/plan`. Shows active request/ride banner if one exists (`GET /api/requests/active`) and routes to it.
2. **Plan ride** (`/c/plan`): pickup (defaults to GPS reverse-geocoded) and drop-off fields → `PlaceSearch` sheet (Photon autocomplete via `api.geo.search`, debounced 350 ms, "Choose on map" option → draggable centre pin + reverse geocode). Once both set: quote (`api.rides.quote`) → map fits route (`RouteLine`), category carousel (Moto, Rickshaw, Ride, Ride AC, Comfort) each showing recommended fare and seats, offer stepper pre-filled with recommended fare, chips `-10 / +10 / +50`, slider clamped to `[min,max]` with a visible "Fair range" bar and a fuel-cost explainer ("Covers ~2.1 L petrol + driver's PKR 100"). Passengers count, note field. CTA "Find a driver for PKR X" → `api.requests.create` → `/c/request/:id`.
3. **Bidding** (`/c/request/:id`): poll `api.requests.get` every 2.5 s. Top: map with route + driver `CarMarker`s from bids. Centre: `RadarSearch` while no bids with "Sending your offer to nearby drivers…" and request countdown. Bids list: card per bid (slides in from the right, newest on top): avatar, name, rating ★ 4.9 (123), car + plate, ETA, price (highlight "Your price" vs "+PKR 50"), 60 s countdown ring (from `expiresAt`), buttons **Accept** / **Decline** (decline = hide locally). Bottom: "Raise your fare" chips (+20/+50/+100 → `api.requests.updateOffer`) and Cancel (→ `api.requests.cancel`). On accept → `api.requests.accept` → `/c/ride/:id`. If `request.status` becomes `accepted` with `rideId`, navigate; `expired`/`cancelled` → explain + back.
4. **Ride** (`/c/ride/:id`): poll `api.rides.get` every 3 s. Map: driver `CarMarker` (heading), route, pins. Panel: status headline ("Driver is on the way" / "Driver has arrived" / "Heading to destination"), driver card (call button `tel:`, chat → `/rides/:id/chat` with unread badge), fare, plate big & bold, PIN not needed. Actions: Cancel (`CancelSheet`, only before in_progress), Share trip (Web Share API with map link), SOS (tel:15 + 1122). On `completed` → `RatingSheet` then `/c/home`. On cancelled → toast + home.
5. **Rides history** (`/c/rides`): paginated list grouped by date; each row → `/rides/:id` (`RideDetailScreen`: route thumbnail map, breakdown, rating, "Report an issue" → `/support`).
6. **Profile** (`/profile`): avatar upload (`pickImage` → `api.files.upload('avatar')` → `api.me.update`), name/email edit, change password, notifications, support, server settings (long-press version), logout, delete account.

## 5. Driver flows
1. **Onboarding wizard** (`/d/onboarding/*`), 5 steps with progress rail at top (animated): (1) Personal details & KYC: CNIC, city, license no., expiry, emergency contact → `api.driver.details`. (2) Vehicle: category → catalog search (`api.vehicleCatalog`) with km/L shown, or custom model (make, model, km/L), year, colour, plate → `api.driver.vehicle`. (3) Documents: grid of 7 tiles (`DOCUMENT_META`): selfie (camera only), CNIC front/back, driving license, route permit, vehicle registration, vehicle photo. Each tile: capture via `pickImage` → upload (`api.files.upload('document')`) → `api.driver.attachDocument` → show AI verdict chip (Verified ✓ / Needs review / Rejected) with the Gemini summary; retake allowed. (4) Subscription: payment instructions from `api.config()` (JazzCash/EasyPaisa/bank, PKR 1,000), method picker, transaction ref, receipt screenshot upload → `api.driver.subscription` (auto-approved in test mode; show "Active until <date>"). (5) Review & submit → `api.driver.submit`; status screen for `under_review` (animated clock + "usually within 24h"), `rejected` (reasons + fix buttons), `approved` (confetti burst → go to Home).
   The wizard resumes at the first incomplete step using `driver.onboarding`. `DriverShell` redirects to the wizard whenever `driver.status !== 'approved'`.
2. **Home** (`/d/home`): map with own `CarMarker` (heading) following GPS; big **Go online** toggle (pill that morphs; `api.driver.presence`); while online, `watchLocation` → `api.driver.location` every 5 s (throttle) and poll `api.driver.feed` every 3 s. Request cards stack at the bottom (newest slides in from the right with a ping sound-free haptic): pickup → dropoff addresses, distance to pickup + ETA, trip km/min, **customer offer** big in amber, personal economics line ("Fuel ≈ PKR 280 · you keep PKR 220"), buttons **Accept PKR X** (bid = offer) and **Offer price** (opens bid composer) → `/d/request/:id`. Shows "Your offer sent — waiting" state with countdown when `myBid` pending, with Withdraw. Subscription expiry banner when `daysLeft ≤ 5`.
3. **Request detail / bid composer** (`/d/request/:id`): full route map, customer card (name, rating), chips `Accept at PKR X`, `+10% / +20% / +30%` and custom stepper clamped to `[min,max]`; ETA stepper (auto from distance); live economics (`driverEconomics`) showing net earning and PKR/min; **Send offer** → `api.driver.placeBid`. On accepted (poll feed/bids or `/api/rides/active`) → `/d/ride/:id`.
4. **Ride** (`/d/ride/:id`): map with route to pickup then to drop-off; step CTA that morphs: **Navigate** (opens `geo:` / Google Maps intent URL `https://www.google.com/maps/dir/?api=1&destination=lat,lng`), **I've arrived** → `arrived`, **Start trip** → `start`, **Complete trip** → `complete` (shows fare collected PKR X, "Collect cash", then `RatingSheet` for the passenger). Call/chat passenger. Cancel via `CancelSheet` (driver reasons).
5. **Earnings** (`/d/earnings`): today/week/month tiles (`Money`), 30-day bar chart (SVG, animated bars), acceptance rate, rating, total rides; subscription card with renew CTA → `/d/subscription`.
6. **Subscription** (`/d/subscription`): current status, history, renew flow (same as wizard step 4).
7. **Rides** (`/d/rides`): history list.

## 6. Shared screens
- **Welcome** (`/welcome`): full-bleed animated carousel (3 slides using `CityScene`, `BiddingScene`, `SafetyScene`/`EarningsScene`), parallax on swipe, animated `LogoMark`, dots; bottom: two role cards "I need a ride" / "I want to drive" (hover/tap lift) → login with role; "Create account" links. Long-press logo → `/settings/server`.
- **Login** (`/auth/login?role=`): phone + password, role segmented control, inline validation using shared zod schemas (`loginSchema`), "Create account". Error toast on 401/429 with server message.
- **Signup customer**: full name, phone, email (optional), password + confirm, terms line. **Signup driver**: full name, phone, password → lands in onboarding wizard.
- **Support** (`/support`): chat UI with Gemini assistant (streamed via `api.support.send`), typing indicator, suggested questions chips, "Talk to a human" → `api.support.escalate` (then show admin replies from `api.support.tickets` polled every 10 s).
- **Notifications** (`/notifications`): list with unread dots, mark all read, tap → deep link via `data.rideId/requestId`.
- **Ride detail** (`/rides/:id`), **Ride chat** (`/rides/:id/chat`): bubbles (mine right brand, theirs left glass), quick replies ("I'm here", "2 minutes", "Call me"), poll every 2 s.
- **Server settings** (`/settings/server`): current API URL, test connection (`api.health`), save.

## 7. Admin panel (Next.js, `/admin`)
Dark, dense, same tokens. Sidebar (Dashboard, Drivers, Customers, Rides, Live map, Subscriptions, Support, Settings, Audit) with animated active indicator; top bar with search + admin menu. Dashboard: KPI tiles (animated counters), 14-day rides/GMV area chart (recharts), category mix donut, live activity. Drivers: table with status filter, drawer/page with document gallery (zoomable images via `/api/files/:id` — same-origin cookie auth), Gemini verdict panels (confidence bar, extracted fields, issues), approve/reject with reason, re-verify. Subscriptions: receipt viewer, approve/reject. Rides: table + detail with route map (MapLibre). Live map: online drivers + open requests + active rides. Settings: petrol price (with fare preview calculator calling `/api/admin/fare/preview`), multipliers, subscription price, payment instructions, auto-approve toggle. Support: escalated tickets, reply. Audit log table.
