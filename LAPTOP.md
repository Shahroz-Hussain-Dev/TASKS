# Running the Raahi backend on your laptop (port 5555 + ngrok)

Use this when you want to test the Android app against a backend running on your
own machine instead of Vercel. ngrok gives your laptop a public HTTPS address and
forwards it to port 5555; the "laptop" APK is built to talk to that address.

## 1. One-time setup

Requirements: Node 20+, pnpm 9 (`npm i -g pnpm`), ngrok.

```bash
git clone https://github.com/Shahroz-Hussain-Dev/TASKS.git raahi
cd raahi
pnpm install
cp apps/server/.env.example apps/server/.env.local
```

Open `apps/server/.env.local` and fill in:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Supabase pooler URL (same as on Vercel) |
| `JWT_SECRET` | any 32+ random characters |
| `GEMINI_API_KEY` | your Gemini key |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the first admin login |
| `APP_PUBLIC_URL` | your ngrok address, e.g. `https://hooked-penny-unsanguinely.ngrok-free.dev` |

## 2. Start the backend on port 5555

```bash
pnpm laptop
```

That builds the server once and starts it on `http://localhost:5555`
(`pnpm laptop:dev` runs the hot-reloading dev server instead). The first request
migrates the database and creates the admin account. Check:

```
http://localhost:5555/api/health   ->  {"ok":true,"db":true}
```

## 3. Forward it with ngrok

```bash
ngrok http 5555
```

Keep that terminal open. The app expects the address shown under *Forwarding*
(the `https://…ngrok-free.dev` one). Free ngrok domains normally answer apps with
an HTML warning page; Raahi sends the `ngrok-skip-browser-warning` header on every
request so the app goes straight through.

## 4. Install the matching APK

`releases/raahi-1.0.0-laptop.apk` is built with the backend address
`https://hooked-penny-unsanguinely.ngrok-free.dev`. If your ngrok address changes,
either rebuild (`VITE_API_URL=https://<new-address> pnpm android:build`) or change
the address inside the app: Profile → long-press the version number → Server.

The admin panel is at `https://<your-ngrok-address>/admin`.
