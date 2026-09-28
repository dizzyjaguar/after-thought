#!/usr/bin/env bash
# Builds the web editor + Swift shell and assembles build/after-thought.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-release}"
APP="$ROOT/build/after-thought.app"

echo "→ web"
(cd "$ROOT/web" && npm install --silent && npm run build --silent)

echo "→ swift ($CONFIG)"
(cd "$ROOT/mac" && swift build -c "$CONFIG")
BIN="$(cd "$ROOT/mac" && swift build -c "$CONFIG" --show-bin-path)/AfterThought"

echo "→ bundle"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/AfterThought"
cp -R "$ROOT/web/dist" "$APP/Contents/Resources/web"
cp "$ROOT/mac/Info.plist" "$APP/Contents/Info.plist"

# Ad-hoc sign so macOS lets it run locally.
codesign --force --deep --sign - "$APP" >/dev/null

echo "✓ $APP"
