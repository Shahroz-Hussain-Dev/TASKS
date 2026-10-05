# Raahi — Android release signing

Release builds of the Raahi Android app are signed with an **upload key** that
lives outside the repository. `apps/mobile/android/app/build.gradle` reads
`apps/mobile/android/keystore.properties` at build time; when that file is
absent it falls back to the debug keystore so `gradlew assembleRelease` still
succeeds locally and in CI (the resulting APK/AAB is installable but **cannot**
be uploaded to Google Play).

Both `*.jks` and `keystore.properties` are gitignored. Never commit either.

## 1. Create the upload keystore (once)

Run this on a trusted machine with JDK 17+ installed:

```bash
keytool -genkeypair -v \
  -keystore raahi-upload.jks \
  -storetype JKS \
  -alias raahi-upload \
  -keyalg RSA -keysize 4096 \
  -validity 10000 \
  -dname "CN=Raahi, OU=Mobile, O=Raahi, L=Lahore, ST=Punjab, C=PK"
```

You will be asked for a keystore password and a key password. Use long, random
values and store them (plus the `.jks` file) in the team password manager.
Losing this key means a new one must be registered with Google Play
(see §4), so keep at least one offline backup.

To inspect the key later:

```bash
keytool -list -v -keystore raahi-upload.jks -alias raahi-upload
```

## 2. Local builds: `keystore.properties`

Copy the keystore to `apps/mobile/android/app/raahi-upload.jks` and create
`apps/mobile/android/keystore.properties`:

```properties
storeFile=app/raahi-upload.jks
storePassword=<keystore password>
keyAlias=raahi-upload
keyPassword=<key password>
```

`storeFile` is resolved relative to `apps/mobile/android/`. The build fails
fast with a clear message when a key is missing or the file does not exist.

Then build:

```bash
cd apps/mobile
pnpm build && pnpm exec cap sync android
cd android && ./gradlew assembleRelease bundleRelease
```

Outputs:

- `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

Confirm the signer before uploading:

```bash
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```

## 3. CI: GitHub Actions secrets

`.github/workflows/android.yml` builds on every push to `main`, on `v*` tags
and on manual dispatch. It signs with the upload key only when **all four**
repository secrets are present; otherwise it warns and signs with the debug key.

| Secret                      | Value                                              |
| --------------------------- | -------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 raahi-upload.jks` (single line)        |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password                                  |
| `ANDROID_KEY_ALIAS`         | `raahi-upload`                                     |
| `ANDROID_KEY_PASSWORD`      | key password                                       |

Optional repository **variable** `API_URL` sets `VITE_API_URL` for the web
bundle (defaults to `https://raahi-server.vercel.app`).

Set them with the GitHub CLI:

```bash
gh secret set ANDROID_KEYSTORE_BASE64 --body "$(base64 -w0 raahi-upload.jks)"
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS --body raahi-upload
gh secret set ANDROID_KEY_PASSWORD
gh variable set API_URL --body https://api.raahi.pk
```

The workflow decodes the keystore to `android/app/raahi-upload.jks`, writes
`android/keystore.properties`, runs `assembleRelease bundleRelease`, renames the
outputs to `raahi-release.apk` / `raahi-release.aab`, uploads both as workflow
artifacts, deletes the signing material, and on a `v*` tag attaches both files
to a GitHub Release.

## 4. Google Play App Signing

Enrol the app in **Play App Signing** when creating the Play Console listing.
Google then holds the *app signing key* that end users see, and the key created
above is only the *upload key*. Upload the `.aab` (not the APK) for every
release.

- If the upload key is ever lost or leaked, request an upload-key reset in Play
  Console → Setup → App integrity; Google re-registers a new upload key without
  affecting installed users.
- `versionCode` in `apps/mobile/android/app/build.gradle` must increase with
  every Play upload; bump `versionName` alongside it for humans.
- Package name `pk.raahi.app` and the signing certificate cannot change after
  the first production release.

## 5. Permissions declared for Play review

The manifest requests background location (`ACCESS_BACKGROUND_LOCATION`) and a
location foreground service for drivers sharing live trips. Play requires a
declaration and a short in-app demonstration video for background location;
prepare these before the first production submission.
