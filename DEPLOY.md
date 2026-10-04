# Deploying Raahi

Three deliverables, one repository:

| Part | Where it runs | How |
|---|---|---|
| API + admin panel (`apps/server`) | Vercel | Import this repo, set **Root Directory = `apps/server`**, add env vars below |
| Database | Supabase Postgres | Already provisioned; schema migrates itself on first request |
| Android app (`apps/mobile`) | Play Store / APK | GitHub Actions builds signed APK + AAB on every push to `main` and on `v*` tags |

---

## 1. Vercel (API + admin)

1. Vercel → **Add New Project** → import `Shahroz-Hussain-Dev/TASKS`.
2. **Root Directory**: `apps/server`. Framework preset: Next.js (auto-detected). Build command and install command: leave default (pnpm is detected from the lockfile).
3. **Environment variables** (Production + Preview):

| Name | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.umbtirrmoodhnmjakhqz:Ghauri%401024@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| `JWT_SECRET` | any 32+ random characters (`openssl rand -base64 48`) — see the value handed over with the delivery, or generate your own |
| `GEMINI_API_KEY` | your Google Gemini Developer API key (`AQ.…`) |
| `ADMIN_EMAIL` | `admin@raahi.pk` (or your own) |
| `ADMIN_PASSWORD` | a strong password — the first admin account is created with it on first boot |
| `APP_PUBLIC_URL` | your deployment URL, e.g. `https://raahi-server.vercel.app` (add after the first deploy) |

   Optional: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to store images in Supabase Storage instead of Postgres (create a private bucket named `raahi-files`). `GEMINI_MODEL` / `GEMINI_VISION_MODEL` default to `gemini-2.5-flash`.

4. Deploy. The first request runs the SQL migrations (guarded by an advisory lock) and seeds the settings row and the admin user. Check `https://<your-app>.vercel.app/api/health` → `{"ok":true,"db":true}`.
5. Admin panel: `https://<your-app>.vercel.app/admin` → sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Go to **Settings** and fill in the real JazzCash/EasyPaisa/bank details drivers should pay the PKR 1,000 subscription to, and confirm today's petrol price.

Why the pooler URL: Supabase's direct host (`db.<ref>.supabase.co`) is IPv6-only and Vercel functions are IPv4-only. The app also accepts the direct URL and rewrites it to the pooler automatically, trying `aws-0`/`aws-1` hosts across regions until one authenticates.

Name the Vercel project **`raahi-server`** if it is available — the pre-built APK points at `https://raahi-server.vercel.app` by default. Any other URL works too: set the repo variable `API_URL` (step 2 below) or change it inside the app (Profile → long-press the version → Server).

## 2. Android app

### One-time setup (GitHub → Settings)
- **Variables** → `API_URL` = your Vercel URL (e.g. `https://raahi-server.vercel.app`).
- **Secrets** (for Play-Store signing; optional for test builds):
  - `ANDROID_KEYSTORE_BASE64` — `base64 -w0 raahi-upload.jks`
  - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

  Create the keystore once and keep it safe (see `apps/mobile/android-signing.md`):
  ```bash
  keytool -genkeypair -v -keystore raahi-upload.jks -alias raahi -keyalg RSA -keysize 2048 -validity 10000
  ```
  Without the secrets the workflow still produces an APK/AAB signed with a debug key (fine for sideloading and internal testing, not for Play Store upload).

### Build
- A ready-to-install build is committed at `releases/raahi-1.0.0.apk` (and `releases/raahi-1.0.0.aab`), signed with a debug key and pointed at `https://raahi-server.vercel.app`. Use it for testing on real phones today; rebuild through CI with your upload key for the Play Store.
- Push to `main` (or run the **Android** workflow manually) → download `raahi-release.apk` / `raahi-release.aab` from the workflow artifacts.
- Tag a release (`git tag v1.0.0 && git push --tags`) → a GitHub Release is created with both files attached.
- Locally: `pnpm install && pnpm android:build` (needs JDK 21 + Android SDK 36; output in `apps/mobile/android/app/build/outputs/`).

### Play Store
Upload the `.aab` to Play Console (app id `pk.raahi.app`, target SDK 36). Fill in the Data-safety form: the app collects phone number, name, optional email, precise location (foreground; background only during an active ride for drivers), photos (driver documents) and uses them for the ride service only. Provide the privacy policy URL `https://<your-app>.vercel.app/privacy`.

## 3. Day-to-day operations
- **Petrol price**: Admin → Settings → Petrol price (OGRA notifies changes on the 1st and 16th). Fares update instantly.
- **Driver approval**: Admin → Drivers → filter *Under review*. Gemini pre-verifies every document; approve when satisfied.
- **Subscriptions**: test mode (`Auto-approve receipts`) is ON by default. Turn it off in Settings when you start collecting real payments; receipts then wait for your approval.
- **Support**: Admin → Support shows conversations users escalated from the AI assistant.
- **Database backups**: Supabase dashboard → Database → Backups.

## 4. Local development
```bash
pnpm install
cp apps/server/.env.example apps/server/.env.local   # fill values
pnpm dev:server    # http://localhost:3000  (API + admin)
pnpm dev:mobile    # http://localhost:5173  (mobile UI in the browser; set Server to http://localhost:3000)
```
