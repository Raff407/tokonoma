# Tokonoma — rules for working on this repo

Read this before changing anything. It is the agreed shape of the project;
when a change contradicts it, update this file in the same commit.

## What this is

A free, private Wallpaper Engine for macOS. Animated scenes are painted small
and woven into glyphs/blocks/dots by **kasuri** (WebGL2), shown behind the
desktop icons by a native Swift app. Agents can make new scenes through an
MCP server; a scene can travel as a `.tokonoma` package file, installed locally
after the checks. The repo is public. There is no marketplace: publishing and the
Market tab were removed until a hosted, signed registry exists. That code was
scrubbed from the public history and lives only locally, in
`~/Documents/Tokonoma-Marketplace` (branch `marketplace`, no remote: never push it here).
The repo is MIT licensed.

```
Wallpapers/_lib/        kasuri.js, kasuri-core.js, sky.js, media.js/.html
Wallpapers/<scene>/     wallpaper.json + index.html + scene.js (+ helpers)
Sources/TokonomaCore/   pure logic: manifest, settings, policy, importer, community,
                        media prep, nudity screen
Resources/Models/       NSFW.mlmodel (LOVOO NSFWDetector, BSD-3) + its licence
Sources/Tokonoma/Host/  desktop windows, WebKit bridge, monitors, network lock
Sources/Tokonoma/App/   model, menus, thumbnails, --inspect, agent server
Sources/Tokonoma/UI/    SwiftUI library window (Theme.swift holds the tokens)
market/                 rules.js + validate.js (shared checks), package, MCP server
web/test, Tests/        node:test and Swift Testing suites
scripts/                bundle.sh, bench.swift, make-icon.swift
```

## Commands

```bash
xcrun swift test                      # Swift core (plain `swift` is a broken swiftly toolchain)
cd web && npm test                    # kasuri, marbling, sky
cd market && npm test                 # validator, packages
xcrun swift scripts/bench.swift       # ms/frame of every scene in real WebKit
scripts/bundle.sh --install           # build, sign, copy to /Applications
python3 -m http.server 8765 --directory Wallpapers   # preview scenes; ?mode=raw&cell=4
```

- Writes to `.git`, `swift build`, `gh` and `/Applications` need the Bash sandbox off.
- npm: pass `--cache "$TMPDIR/npm-cache"` (`~/.npm` has root-owned files; don't chown).
- `tokonoma.step(1/30, n)` in a page renders frames by hand when the pane is hidden.

## Git

- Author is always Raff (`152933632+Raff407@users.noreply.github.com`). Never add
  Co-Authored-By or any AI attribution, in commits, PRs or comments.
- Many small commits, messages short, lowercase and human: `koi pond, fish run from the cursor`,
  `save settings once sliders settle`. No `feat(scope):` prefixes.
- Repo: `Raff407/tokonoma` (private), branch `main`. Ask Raff before git operations
  unless he has already asked for them in the current request.

## Look of the app (unslop direction)

- Product: a free live-wallpaper host; one woven scene behind your icons.
- Character: quiet, exact, a little ceremonial. World: a tokonoma alcove at night.
- Neutrals from `Ink` in Theme.swift only. **Shu `#D6452C` is the only accent and means
  "on"**: the hanko seal on what's hanging, switches that are on, slider fill. Selection
  stays neutral. System blue never appears.
- Type: SF Pro for words (sentence case), SF Mono for values/counts/status (lowercase),
  Hiragino Mincho for kanji only. Weights 400/500.
- Controls: `ShuToggleStyle`, `ChoiceBar` (≤ 4 options), `MenuChoice`, `SettingRow`,
  `QuietButtonStyle`, `PrimaryButtonStyle` (one per screen). 4pt grid, rows 36pt.
- No emoji, gradients on chrome, glows or bouncy motion. The live preview is the one rich thing.

## Scenes

- Paint `api.cols × api.rows` pixels only; cache anything still into layers.
- Budget: under ~2 ms/frame in `bench.swift`; never over 6 (the community limit).
  Ask for `maxFps` 20–24 if motion is slow. No per-frame allocation in hot loops.
- Palette: ink, washi, indigo, vermilion, moss, gold. No neon, nothing flashes.
- Default weave glyph/block/dot. Raw is not offered: the "mode" choice lists only glyph/block/dot
  (the validator refuses raw; old manifests and saved settings that ask for it get glyph).
  kasuri still draws `?mode=raw` for debug previews. Declare `mode` and `cell` properties.
- Chinese scenes carry `"culture": "chinese"` in wallpaper.json (the validator accepts nothing else). They show
  in the Chinese tab only, not the Library tab; favourites, rotation and the menu bar still see them.
- Interactive scenes set `"interactive": true` and use `api.pointer` / `onClick`.
- Adding a built-in: folder + manifest + index.html, then add the id to
  `AppModel.builtInOrder`, `ShippedWallpaperTests`, `market/src/server.js` EXAMPLES,
  `market/test/validate.test.js` calibration list, `scripts/bench.swift`.
- Official scenes must pass `market/src/validate.js` like any community scene.
- New built-ins aren't interactive: no `interactive`, `api.pointer` or `onClick`. Raff finds them
  heavy, and any scene marked interactive starts the global mouse monitors (`PointerTracker`).
  No per-frame loop over every cell or over thousands of points either.
- Retiring a built-in: delete it from the lists above and add its id to `BundleSync.retired`,
  which removes the copy older builds left in the library.

## Dock and Cmd-Tab

- `LSUIElement` is on: the app runs as wallpaper plus menu-bar torii, with no Dock icon
  and nothing in Cmd-Tab. `openLibrary` switches to `.regular`; closing the library
  switches back to `.accessory`. Minimised or hidden still counts as open.
- Opening by hand shows the library. A login launch doesn't (`LaunchIntent`: login flag,
  or within 60 s of logging in). AppKit invents a plain `oapp` event for shell launches,
  so running the binary is not a fair test of a login launch.
- `DesktopWindow.canHide = false`, so hiding the app never takes the wallpaper with it.
- The menu-bar menu lists favourites plus whatever is hanging, never the whole library
  (it outgrew the screen at 100 scenes). With two or more favourites, Next and rotation
  step through only them (`Settings.rotationPool`).

## Importing media

- `MediaPrep`: animated gif/apng/webp/heics become an H.264 `media.mp4` (WebKit
  freezes an off-screen animated `<img>` on frame one). Stills WebKit can't draw
  (heic, avif, tiff, bmp, psd…) become JPEG/PNG. Clips are capped at 1920px, stills 3840px.
- Imports stay on this Mac; nothing can be published.

## Battery

Pause when covered, asleep, locked, Low Power Mode, critically hot; half fps when hot;
1× pixels on battery/low power/heat (`PlaybackPolicy.renderScale`). Thumbnail and
preview web views are freed when idle. Don't add timers or polling that run while paused
(the one exception: the 10 s power watchdog on untrusted community pages).

## Community wallpapers and agents — security model (don't weaken)

1. `market/src/validate.js` + `rules.js` is the single rulebook. It runs in the MCP
   server and in the app via JavaScriptCore before install.
2. Packages hold only `wallpaper.json`, `scene.js`, `README.md`, small `assets/` images.
   The app writes `index.html` itself. Fingerprint = SHA-256 of the body string.
3. At runtime every web view has the `NetworkLock` content rules (no http/ws/ftp).
   Community scenes get kasuri injected as user scripts and read access to their own
   folder only. Verified by a hostile test scene: both escapes blocked.
4. `.origin.json` is written by the app, never taken from a package. No package is ever
   marked verified.
5. Installs always go through the review sheet with the third-party warning, author,
   size, grid, images and checks. Agents can't install silently (`tokonoma_try` opens the sheet).
6. HTTP MCP listens on 127.0.0.1 only, checks Host, needs the key in
   `~/Library/Application Support/Tokonoma/agent-token`.
7. Media packages (`"kind": "media"`) hold one `media.mp4|jpg|png|webp` and no code.
   Always woven: their mode choice may only offer glyph/block/dot. ≤ 12 MB, clips
   ≤ 1920px, 60 s and silent.
8. Nudity screen (`SafetyScreen`, on device): every media frame sampled, every image
   asset, and the `--inspect` render. Threshold is `SAFETY.maxNsfw` in rules.js, judged by
   `judgeScreen`. It runs before every install. If the model can't load, nothing is installed.
9. Runtime lockdown (`Lockdown.swift`, WallpaperHost): WebRTC, media devices and
   DNS prefetch off in the engine; RTC/WebTransport/Worker constructors removed in
   every frame; NetworkLock blocks every URL except file/data/blob/about; navigation
   only to the page itself (no frames, popups, custom schemes); page error text never
   reaches the app UI for community pages; capture() must be a modest real JPEG.
10. A web process keeps every file grant it ever had: `WallpaperHost` swaps in a fresh
   web view (own non-persistent data store) whenever the readable root changes.
11. kasuri freezes `window.tokonoma` (non-writable, non-configurable) and runs inspect
   and capture on native functions captured before scene code, so scenes can't fake checks.
12. Community pages are watched from outside: `PowerWatch` stops one that keeps a core
   busy (~30 s over budget) and restarts are capped per load.
13. Versions are integers. Downloads must match the listed sha256. An install
   never replaces another author's wallpaper. Packages over 24 MB aren't parsed.
14. `scripts/redteam.sh` runs a hostile scene (network, WebRTC, files, frames, popups,
   replacing inspect, reading the library after a trusted page). Run it after touching
   Host/, kasuri.js or NetworkLock. It must say "every escape blocked".

## Known limits (not fixed yet)

- Bringing back a marketplace needs real accounts and a signed index first.
- Media and images from packages are decoded by ImageIO/AVFoundation inside the app
  process (not sandboxed). A sandboxed XPC decoder would contain a decoder exploit.
- Scenes are screened for nudity from their images at install; a scene that draws something explicit later (by date, or after minutes)
  isn't caught. The static checker is lint; the runtime lockdown is the real wall.
- The HTTP MCP key can ride in the query string (for ChatGPT); prefer the header.

## Gotchas

- WebKit content-rule regexes have no `|`; write one rule per scheme.
- Hidden (windowless) WKWebViews don't decode video: imported videos get a native
  `poster.jpg` so thumbnails work.
- `Settings` clashes with SwiftUI's `Settings`; use `TokonomaCore.Settings`.
- The Agents pane needs Node.js on the user's Mac; say so plainly when it's missing.
- Community media pages get kasuri + media.js injected at document start, so media.js
  waits for DOMContentLoaded before reading `<body data-media>`.
- Two `.sheet` modifiers sit on LibraryView (install review) works on macOS 14.
