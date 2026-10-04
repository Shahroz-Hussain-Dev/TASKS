<p align="center">
  <img src="apps/server/public/icon.svg" width="96" alt="Raahi" />
</p>
<h1 align="center">Raahi — Your ride. Your price.</h1>
<p align="center">Fair-price ride hailing for Pakistan. Passengers name their fare, nearby drivers bid, the passenger picks. 100% of every fare goes to the driver.</p>

## What's inside

```
apps/server     Next.js 15 — REST API + admin panel (Vercel)
apps/mobile     React 19 + Vite + Capacitor 8 — Android app for passengers & drivers (APK/AAB)
packages/shared Domain: fare engine, vehicle catalogue, zod schemas, DTO types
docs/           API contract (API.md) and design/UX spec (DESIGN.md)
legacy/         Previous unrelated project kept for reference
```

### Features
- **Bidding marketplace (inDrive model)** — passenger offers a fare inside an engine-computed fair range; drivers accept or counter-offer within 60 s; passenger chooses; atomic acceptance; live tracking; in-ride chat; two-way ratings; cancellations with reasons.
- **Fare engine** — `distance ÷ vehicle km/L × OGRA petrol price + PKR 100 driver floor`; category averages for passengers, the driver's actual car for their personal break-even; admin-tunable multipliers and petrol price.
- **Driver onboarding & KYC** — CNIC front/back, selfie, driving license, route permit, vehicle registration, vehicle photo. Every image is verified by **Gemini** (type match, legibility, extracted name/CNIC/expiry, issues) and surfaced to admins for the final call.
- **Driver subscription** — PKR 1,000 / 30 days; receipt screenshot upload; auto-approved in test mode; zero commission on rides.
- **Admin panel** — dashboard, approvals with document gallery + AI verdicts, live map, rides, customers, subscriptions, support inbox, settings, audit log.
- **AI support** — streaming Gemini assistant with user context, escalation to humans.
- **Free map stack** — OpenFreeMap vector tiles, OSRM routing, Photon search, Nominatim reverse geocoding. No paid keys.
- **Security** — bcrypt, rotating refresh tokens, DB-backed login lockout, zod validation everywhere, sharp re-encoding of uploads (EXIF stripped), owner-scoped file access, audit trail, strict security headers.

## Quick start
See **[DEPLOY.md](DEPLOY.md)** for Vercel, Supabase and Play Store steps.

```bash
pnpm install
pnpm dev:server   # API + admin at http://localhost:3000
pnpm dev:mobile   # app UI at http://localhost:5173
pnpm test && pnpm typecheck && pnpm lint
pnpm android:build
```

## Architecture notes
- Serverless-friendly Postgres access (`postgres.js`, no prepared statements) with automatic Supabase pooler resolution and self-migration on first request.
- Realtime is implemented with adaptive short polling (2.5–5 s) — reliable on Vercel's request/response model and cheap at this scale; no websockets or third-party realtime keys required.
- Images are stored in Postgres by default (zero-config) and in Supabase Storage when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set.
