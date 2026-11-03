# Axiom Browser (Flutter)

Axiom Browser - Flutter port of the Axiom AI browser start page.
A dark-themed browser/search app with optional AI-powered answers and voice search.

> **Note on the project type**: Even though the original description said
> "kotlin browser UI", this is actually a **Flutter (Dart)** app. The
> `android/` folder contains a small amount of Kotlin (just
> `MainActivity.kt`, which is the standard Flutter template entry point),
> but all of the UI and logic live in `lib/*.dart`. So you build & run it
> with `flutter run`, **not** Android Studio's "Run Kotlin" command.

## Features

- Dark Material 3 UI
- Voice search (via `speech_to_text`)
- AI-powered answer page with citations (calls a configurable backend)
- URL launcher for opening results externally
- Cross-platform: Android, iOS, Web, Windows, macOS, Linux

## Requirements

| Tool          | Version        |
| ------------- | -------------- |
| Flutter       | >= 3.3.0       |
| Dart          | >= 3.3.0       |
| Android Studio| Hedgehog or newer (mainly for the Android SDK) |
| JDK           | 17             |

Check with:
```bash
flutter doctor -v
```

## Setup

```bash
# 1. Install dependencies
flutter pub get

# 2. Run on a connected device / emulator
flutter run
```

If you only want a debug APK:
```bash
flutter build apk --debug
```

## Android permissions

Already configured in `android/app/src/main/AndroidManifest.xml`:
- `INTERNET` - to call the API and load pages
- `RECORD_AUDIO` - for voice search
- `<queries>` block - so `url_launcher` and `speech_to_text` can find the
  browser / speech recognizer apps

## Backend (AI-powered search)

The AI search button (the icon in the search bar) calls `POST /search/answer`
and renders the response with citations. See `lib/api.dart` and
`lib/answer_page.dart`.

Default URLs:
- Android emulator: `http://10.0.2.2:8000`
- Everything else:  `http://localhost:8000`

Override at runtime:
```bash
flutter run --dart-define=AXIOM_API=http://192.168.1.10:8000
```

## Build error on Windows? (Kotlin daemon)

If you hit `IllegalStateException: Storage for [...] is already registered`
while building on Windows, see `docs/FIX_GUIDE.md` in this repo's parent
folder (`axiom_browser_fix/`). TL;DR:

```powershell
# from project root (the folder containing pubspec.yaml)
flutter clean
Remove-Item -Recurse -Force build, .dart_tool, android\.gradle, android\.kotlin, android\app\build -ErrorAction SilentlyContinue
flutter pub get
flutter run
```

The patched `android/gradle.properties` in this repo already sets
`kotlin.compiler.execution.strategy=in-process` and
`kotlin.incremental=false`, which prevent the issue from recurring.

## Project structure

```
lib/
  main.dart            # App entry, theme, routing
  browser_page.dart    # Main browser UI
  answer_page.dart     # AI answer + citations UI
  api.dart             # HTTP client to the AI backend
  theme.dart           # AxiomColors, AxiomTextStyles
  utils.dart           # Misc helpers
assets/
  image1.jpg           # Background / hero image
android/               # Android platform code (Kotlin + Gradle)
windows/               # Windows desktop platform code (C++)
web/                   # Web build assets
```

## Pushing to GitHub

See `docs/PUSH_TO_GITHUB.md` for the safe, token-free workflow using
`gh auth login` (interactive browser flow). **Never paste a GitHub PAT
into a terminal command or chat - use git credential manager instead.**
