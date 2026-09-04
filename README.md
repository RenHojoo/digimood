# DigiMood

A mood-tracking and journaling app that runs as a web app, installable PWA, and standalone Android APK — fully offline, no server or hosting required.

## Project Structure

```
.
├── .github/workflows/   CI pipeline (APK build on tag push)
├── android/             Capacitor Android wrapper (generated)
├── public/              PWA static assets (icon, manifest, service worker)
├── src/                 Web app source (React + TypeScript + Vite)
├── capacitor.config.ts  Capacitor configuration
├── index.html           App entry point
├── vite.config.ts       Vite build configuration
├── tailwind.config.js   Tailwind CSS configuration
├── postcss.config.js    PostCSS configuration
├── tsconfig.json        TypeScript configuration
└── package.json         Dependencies and scripts
```

## Android APK Installation

1. Go to the _Releases_ page on the GitHub repository.
2. Download the `digimood.apk` file from the latest release.
3. Open the file, allowing "install from unknown sources" in settings.

## APK Build

The APK is built automatically by GitHub _Actions_; no need to install Android tools locally.

### Triggering a Release Build

Tagging a release triggers the build workflow, which compiles the APK in the cloud and attaches it to a new GitHub Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

You can also trigger a build manually from the _Actions_ tab → _"Build Android APK"_ → _"Run Workflow"_.

### Local Build (Optional)

If you have Android Studio installed:

```bash
npm run android
```

This builds the web app, syncs it into the Android project, and opens it in Android Studio, where you can build the APK via _Build_ → _Build Bundle(s)_ / _APK(s)_ → _Build APK(s)_.

## GitHub Push

Every time you make changes and want them live, run these three commands:

```bash
git add -A
git commit -m "describe what you changed"
git push origin main
```
GitHub Pages deploy triggers automatically every time you push to main.
APK build triggers automatically when you push a version tag:
```bash
git tag v1.0.0 && git push origin v1.0.0
```
It builds the web app, syncs it to Android, compiles the APK, uploads it as a downloadable artifact, and attaches it to a GitHub Release.