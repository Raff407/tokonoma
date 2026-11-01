# Tokonoma

床の間 — the alcove in a Japanese room where a single scroll hangs and gets
changed with the seasons. This is that, for the macOS desktop.

Animated wallpapers for macOS, drawn as glyph grids, ink and pixels. They sit
behind your desktop icons on every display and every Space, and they rest
whenever nobody can see them.

## Scenes

| | |
| --- | --- |
| **Torii** 鳥居 | A shrine gate at the top of mossy steps. Sky follows your clock, trees follow the month, a fox keeps watch. |
| **Koi** 鯉 | A dark pond from above. The fish scatter when your cursor comes near. |
| **Sumi** 墨流し | Suminagashi — ink floated on water. Rings keep landing, a slow current folds them, the cursor combs them. |
| **Fuji** 富士 | The mountain over a still lake, mirrored row by row, with drifting clouds and a pagoda on the shore. |
| **Kaze** 風 | A sword standing in silver grass under a storm. Gusts roll through; the grass parts for the cursor, a click sends a gust. |
| **Yours** | Drop any video, gif or picture into the library and it gets woven the same way. |

Every scene has its own settings (season, wind, fish, inks…) plus the weave:
`glyph`, `block`, `dot` or `raw`, the glyph set, and the cell size.

## Run it

Needs macOS 14+ and Xcode (the `swift` from swiftly clashes with the Xcode 27
SDK, so the scripts call `xcrun swift`).

```bash
scripts/bundle.sh            # builds build/Tokonoma.app
scripts/bundle.sh --install  # and copies it into /Applications
open build/Tokonoma.app
```

It lives in the menu bar (the little torii). Open Library… to pick a scene,
tweak it with a live preview, import your own clips, or change when it rests.

## How it works

```
Wallpapers/
  _lib/kasuri.js      WebGL2 weave: scene pixels → glyphs/blocks/dots, one shader pass
  _lib/kasuri-core.js the pure maths (grid, colour, noise, props), tested in node
  _lib/sky.js         the shared clock-driven sky
  <scene>/            wallpaper.json + index.html + scene.js
Sources/
  TokonomaCore/       manifests, settings, playback policy, importer (tested)
  Tokonoma/Host/      desktop-level windows, WebKit bridge, power + cursor monitors
  Tokonoma/App/       model, menu bar, thumbnails
  Tokonoma/UI/        the library window
```

Each scene paints a tiny picture, one pixel per cell, with the ordinary canvas
API. **kasuri** (絣, the weave where threads are dyed before they meet) uploads
it as a texture and a single fragment shader turns every cell into a glyph from
an atlas, a block or a dot. A 5K display is ~150k cells and the CPU never
touches them.

The app puts one borderless window per screen at the desktop window level,
under the icons, ignoring clicks. It pauses a scene when a window covers it,
when the display sleeps or the Mac locks, in Low Power Mode, and (if you like)
on battery, and drops to a lower frame rate on battery otherwise.

### Make your own

A wallpaper is a folder in `~/Library/Application Support/Tokonoma/Wallpapers`
with a `wallpaper.json` (id, name, entry, properties) and a page that calls
`Kasuri.run({ defaults, setup, draw })`. Properties declared in the manifest
show up as controls in the library automatically.

## Tests

```bash
xcrun swift test        # core logic
cd web && npm test      # kasuri, marbling, sky
```
