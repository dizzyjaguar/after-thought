#!/usr/bin/env bash
# Ships a new version: bumps the version, builds, zips, signs the zip for Sparkle,
# adds it to site/public/appcast.xml, then (after you say yes) commits, pushes and
# makes a GitHub release. Apps out there see the update within a day, once the
# site redeploys with the new appcast.
#
#   ./scripts/release.sh 0.2.0 "Split view, and copied notes paste with visible text."
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?usage: release.sh <version> [notes]}"
NOTES="${2:-}"
REPO="dizzyjaguar/after-thought"
PLIST="$ROOT/mac/Info.plist"
APPCAST="$ROOT/site/public/appcast.xml"
SIGN="$ROOT/mac/.build/artifacts/sparkle/Sparkle/bin/sign_update"
pb() { /usr/libexec/PlistBuddy -c "$1" "$PLIST"; }

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version should look like 0.2.0"; exit 1; }
if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
  echo "Commit or stash your changes first, so the release is exactly what's in git."; exit 1
fi
if git -C "$ROOT" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  echo "v$VERSION was already released."; exit 1
fi

# CFBundleVersion is what Sparkle compares, so it goes up by one every release.
BUILD=$(( $(pb "Print :CFBundleVersion") + 1 ))
pb "Set :CFBundleShortVersionString $VERSION"
pb "Set :CFBundleVersion $BUILD"

"$ROOT/scripts/build.sh" release
# The Sparkle tools come with the package; build.sh just fetched it.
ZIP="$ROOT/build/after-thought-$VERSION.zip"
LATEST="$ROOT/build/after-thought.zip"
rm -f "$ZIP" "$LATEST"
ditto -c -k --keepParent "$ROOT/build/after-thought.app" "$ZIP"
cp "$ZIP" "$LATEST"

# Prints: sparkle:edSignature="…" length="…" (signed with the key in your Keychain).
SIGNATURE="$("$SIGN" --account after-thought "$ZIP")"
URL="https://github.com/$REPO/releases/download/v$VERSION/after-thought-$VERSION.zip"
DATE="$(LC_ALL=C date -u "+%a, %d %b %Y %H:%M:%S +0000")"
ESCAPED_NOTES="$(printf '%s' "$NOTES" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')"
ITEM="    <item>
      <title>$VERSION</title>
      <pubDate>$DATE</pubDate>
      <sparkle:version>$BUILD</sparkle:version>
      <sparkle:shortVersionString>$VERSION</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>13.0</sparkle:minimumSystemVersion>
      <description><![CDATA[<p>$ESCAPED_NOTES</p>]]></description>
      <enclosure url=\"$URL\" type=\"application/octet-stream\" $SIGNATURE/>
    </item>"

# Newest first, right after the <language> line.
ITEM="$ITEM" perl -0pi -e 's|(<language>en</language>\n)|$1$ENV{ITEM}\n|' "$APPCAST"

echo
echo "Ready: after-thought $VERSION (build $BUILD)"
echo "  $ZIP"
read -r -p "Commit, push and publish the GitHub release? [y/N] " ok
if [[ "$ok" != [yY] ]]; then
  echo "Stopped. Info.plist and appcast.xml are changed but not committed."
  exit 0
fi

git -C "$ROOT" add "$PLIST" "$APPCAST"
git -C "$ROOT" commit -m "chore: release v$VERSION"
git -C "$ROOT" push
gh release create "v$VERSION" "$ZIP" "$LATEST" --repo "$REPO" --target main \
  --title "after-thought $VERSION" --notes "${NOTES:-after-thought $VERSION}"
echo "✓ Released v$VERSION. Apps pick it up once after-thought.dev redeploys."
