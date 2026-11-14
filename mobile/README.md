# CropAI mobile (Flutter, Android)

The Android app of the CropAI platform. It uses the **same** backend as the website (Next.js
API on port 3000), so the same phone-number account, the same AgriSmart India v1 model, the same
reports in PostgreSQL and the same Mitra assistant. The app contains no AI model, no database
access and no secrets.

Full documentation: [`docs/mobile/`](../docs/mobile/) (start with `FINAL_MOBILE_IMPLEMENTATION_AUDIT.md`).

## Requirements

Flutter 3.50.0 (stable) · Dart 3.14 · Android SDK 36 · JDK 17–21. On this machine Flutter is at
`C:\src\flutter` and the SDK at `%LOCALAPPDATA%\Android\Sdk` (both on the user PATH).

## Run against your computer's backend

```powershell
# repo root: start the backend (it listens on all interfaces)
npm run dev
# write mobile/config/dev.local.json with this PC's Wi-Fi IP (phone and PC on the same Wi-Fi)
npm run mobile:lan-ip

cd mobile
flutter pub get
flutter run --flavor dev --dart-define-from-file=config/dev.local.json          # phone on Wi-Fi
flutter run --flavor dev --dart-define-from-file=config/emulator.json           # Android emulator (10.0.2.2)
adb reverse tcp:3000 tcp:3000
flutter run --flavor dev --dart-define-from-file=config/usb-reverse.json        # phone over USB
```

Never build a phone APK with `http://localhost:3000` (on a phone that is the phone itself) —
the app refuses it unless `ALLOW_LOOPBACK=true` (USB reverse only).

## Build an installable APK

```powershell
cd mobile
flutter analyze
flutter test
flutter build apk --release --flavor dev --dart-define-from-file=config/dev.local.json --target-platform android-arm,android-arm64
# -> build/app/outputs/flutter-apk/app-dev-release.apk
```

Signing: `android/key.properties` + `android/keystore/*.jks` (local, git-ignored). Without them
release builds are signed with the debug key. Staging/production: copy
`config/staging.example.json` / `config/prod.example.json`, set an `https://` URL, build with
`--flavor staging` / `--flavor prod` (HTTP is rejected in those builds).

## Tests

```powershell
flutter test test/core test/features test/widgets      # unit + widget (no backend needed)

# real backend + real model (dev database only):
npm run mobile:test-session                             # repo root; prints accessToken/refreshToken
flutter test test/acceptance --dart-define=E2E_API_BASE_URL=http://<PC IP>:3000 `
  --dart-define=E2E_REFRESH_TOKEN=<refreshToken> --dart-define=E2E_ACCESS_TOKEN=<accessToken>

# on a device/emulator (full UI journey):
flutter test integration_test --flavor dev --dart-define=E2E_API_BASE_URL=http://10.0.2.2:3000 --dart-define=E2E_REFRESH_TOKEN=<refreshToken>
```

## Structure

`lib/core` (config, the single ApiClient, storage, routing, theme, localisation, permissions),
`lib/shared` (widgets, animations, models), `lib/features/*` (authentication, onboarding, home,
crops, camera, diagnosis, weather, assistant, reports, profile, government_resources,
notifications, volunteer). State: Riverpod 3. Navigation: go_router. Text: `lib/core/localization/arb`
(English + Hindi).
