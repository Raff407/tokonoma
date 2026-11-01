#!/usr/bin/env bash
# Builds build/Tokonoma.app: release binary, wallpapers, icon, ad-hoc signature.
#   scripts/bundle.sh            build the app
#   scripts/bundle.sh --install  also copy it into /Applications
set -euo pipefail
cd "$(dirname "$0")/.."

APP=build/Tokonoma.app
SWIFT="xcrun swift"

echo "› compiling"
$SWIFT build -c release --product Tokonoma
BIN="$($SWIFT build -c release --show-bin-path)/Tokonoma"

echo "› assembling $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/Tokonoma"
cp Resources/Info.plist "$APP/Contents/Info.plist"
rsync -a --exclude '_sample' --exclude '.DS_Store' Wallpapers/ "$APP/Contents/Resources/Wallpapers/"
mkdir -p "$APP/Contents/Resources/Market"
cp market/src/rules.js market/src/validate.js "$APP/Contents/Resources/Market/"

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
