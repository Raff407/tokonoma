#!/usr/bin/env bash
# Builds build/Tokonoma.app: release binary, wallpapers, icon, ad-hoc signature.
#   scripts/bundle.sh            build the app
#   scripts/bundle.sh --install  also copy it into /Applications
set -euo pipefail
cd "$(dirname "$0")/.."

APP=build/Tokonoma.app
SWIFT="xcrun swift"

echo "› compiling"
# Universal: one download runs on Apple silicon and Intel Macs.
ARCHS="--arch arm64 --arch x86_64"
$SWIFT build -c release --product Tokonoma $ARCHS
BIN="$($SWIFT build -c release $ARCHS --show-bin-path)/Tokonoma"

echo "› assembling $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/Tokonoma"
cp Resources/Info.plist "$APP/Contents/Info.plist"
rsync -a --exclude '_sample' --exclude '.DS_Store' Wallpapers/ "$APP/Contents/Resources/Wallpapers/"
# The market package: validator for installs, MCP server for agents.
[[ -d market/node_modules ]] || (cd market && npm ci --omit=dev --cache "${TMPDIR:-/tmp}/npm-cache")
rsync -a --exclude '.claude' --exclude '.DS_Store' --exclude 'test' market/ "$APP/Contents/Resources/market/"

# The nudity screen's classifier (NSFWDetector by LOVOO, BSD-3), compiled once here.
mkdir -p "$APP/Contents/Resources/Models"
xcrun coremlcompiler compile Resources/Models/NSFW.mlmodel "$APP/Contents/Resources/Models" >/dev/null
cp Resources/Models/NSFW-LICENSE "$APP/Contents/Resources/Models/"

echo "› drawing icon"
rm -rf build/AppIcon.iconset
$SWIFT scripts/make-icon.swift build/AppIcon.iconset >/dev/null
iconutil -c icns build/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"

echo "› signing (ad hoc)"
codesign --force --deep --sign - "$APP" >/dev/null

if [[ "${1:-}" == "--install" ]]; then
  echo "› installing to /Applications"
  rm -rf /Applications/Tokonoma.app
  cp -R "$APP" /Applications/
fi
echo "✓ $APP"
