#!/usr/bin/env bash
# Runs a hostile scene in the real app sandbox (same isolation as a community
# install) and fails if any escape works: network (incl. WebRTC/STUN), files
# outside its folder, frames, popups. Needs the internet so escapes can be tried.
#   scripts/redteam.sh [path/to/Tokonoma]
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${1:-$(xcrun swift build --show-bin-path)/Tokonoma}"
# --warm runs a built-in with whole-library access in the same host first and
# stages the probe inside that library, like a real community install, so
# "otherWallpaper" (../torii) tests that nothing carries over between pages.
# Not under $TMPDIR: the web sandbox lets pages read temp files anyway.
LIB="$(mktemp -d "$PWD/.build/redteam-lib.XXXXXX")"
trap 'rm -rf "$LIB"' EXIT
cp -R Wallpapers/torii Wallpapers/_lib "$LIB/"
OUT="$("$BIN" --inspect scripts/redteam --warm "$LIB" --probe 2>/dev/null | tail -1)"
node -e '
const m = (JSON.parse(process.argv[1]).metrics || {}).probe;
if (!m) { console.error("probe never ran:", process.argv[1]); process.exit(1); }
const mustBlock = ["https", "http", "fileEtc", "fileHome", "otherWallpaper", "customScheme", "websocket", "img"];
const bad = [];
for (const k of mustBlock) if (!String(m[k]).startsWith("blocked")) bad.push(`${k}: ${m[k]}`);
for (const k of ["webrtc", "webrtcViaIframe"]) if (!/no RTCPeerConnection|candidates: (none|host)?$/.test(m[k])) bad.push(`${k}: ${m[k]}`);
if (m.iframe !== "no load") bad.push(`iframe: ${m.iframe}`);
if (m.open !== "null") bad.push(`window.open: ${m.open}`);
if (m.replaceInspect !== "blocked") bad.push(`scene replaced tokonoma.inspect: ${m.replaceInspect}`);
if (!String(m.ownFile).startsWith("READ")) bad.push("own folder unreadable (probe broken?)");
if (bad.length) { console.error("ESCAPES:\n  " + bad.join("\n  ")); process.exit(1); }
console.log("red team: every escape blocked (" + Object.keys(m).length + " probes)");
' "$OUT"
