#!/usr/bin/env bash
# Builds the web editor + Swift shell and assembles build/after-thought.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-release}"
APP="$ROOT/build/after-thought.app"

echo "→ web"
(cd "$ROOT/web" && npm install --silent && npm run build --silent)

echo "→ swift ($CONFIG)"
# Release builds run on both Apple silicon and Intel Macs.
ARCHS=()
[[ "$CONFIG" == release ]] && ARCHS=(--arch arm64 --arch x86_64)
(cd "$ROOT/mac" && swift build -c "$CONFIG" ${ARCHS[@]+"${ARCHS[@]}"})
BIN_DIR="$(cd "$ROOT/mac" && swift build -c "$CONFIG" ${ARCHS[@]+"${ARCHS[@]}"} --show-bin-path)"
BIN="$BIN_DIR/AfterThought"

echo "→ bundle"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks"
cp "$BIN" "$APP/Contents/MacOS/AfterThought"
# ditto keeps the framework's symlinks intact.
ditto "$BIN_DIR/Sparkle.framework" "$APP/Contents/Frameworks/Sparkle.framework"
cp -R "$ROOT/web/dist" "$APP/Contents/Resources/web"
cp "$ROOT/mac/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/mac/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"

# Ad-hoc sign so macOS lets it run locally.
codesign --force --deep --sign - "$APP" >/dev/null

echo "✓ $APP"
