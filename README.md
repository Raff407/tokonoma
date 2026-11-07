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
| **Fuji** 富士 | The mountain over a still lake, mirrored row by row, with drifting clouds and a pagoda on the shore. |
| **Kaze** 風 | A sword standing in silver grass under a storm. Gusts roll through the grass, seed fluff drifts on the wind. |
| **Take** 竹 | A bamboo grove in steady rain. The tall stalks sway from the root, a stone lantern glows through the mist. |
| **Sakura** 夜桜 | One old cherry tree at night, shedding petals. They pile up underneath, and your cursor is a small gust. |
| **Yuki** 雪 | A mountain village at night under falling snow. Windows glow and go out one by one, chimney smoke leans with the wind. |
| **Hotaru** 蛍 | Fireflies over a slow stream on a summer night, each pulsing in its own time. They gather near your cursor. |
| **Tsuki** 月 | Tonight's moon in its real phase, behind thin cloud, with a pine and a low ridge underneath. |
| **Nami** 青海波 | The overlapping-scale wave pattern, breathing like a real sea as long swells roll under it. |
| **Momiji** 紅葉 | Red maple leaves riding a dark stream, slipping round the rocks and away from your cursor. |
| **Hoshi** 星 | The whole sky turning around the pole star over a dark ridge. The Milky Way goes with it, and a slow meteor now and then. |
| **Toro** 灯籠流し | Paper lanterns set adrift on a night river below a far temple. Click the water to float another one. |
| **Unkai** 雲海 | A sea of cloud with peaks standing out of it. The sky follows your clock, the mountains wade through the weather. |
| **Tsuru** 鶴 | Red-crowned cranes crossing a winter dusk, past a low vermilion sun, with two more standing in the snow. |
| **Neko** 猫 | A cat asleep on the veranda while it rains in the garden. Bring your cursor close and one eye opens to follow it. |
| **Hanabi** 花火 | Far-off summer fireworks over a river and a footbridge, unhurried, mirrored in the water. |
| **Shoji** 障子 | Sunlit paper screens with the garden's shadow moving on them. Sometimes a sparrow lands on the branch. |
| **Hasu** 蓮 | A lotus pond with real ripples. Rain lands now and then, your cursor leaves a wake, a click drops a stone. |
| **Kiri** 霧 | Mountains in ink wash on pale paper, with mist moving through the valleys, a far temple and one red seal. |
| **Densha** 夜汽車 | The last train crossing a viaduct over flooded paddies, window by window, its lights broken up in the water. |
| **Kurage** 海月 | Moon jellyfish rising through deep indigo water, each on its own slow beat. They turn away from your cursor. |
| **Suisha** 水車 | A water wheel turning beside an old mill. The sky follows your clock and the window lights up when it gets dark. |
| **Yokocho** 横丁 | A narrow lantern alley in the rain, late. The wet road holds a wavering copy of every light. |
| **Ajisai** 紫陽花 | Hydrangeas in the June rains, heads nodding under the drops, and one snail on its way across a leaf. |
| **Tanada** 棚田 | Flooded rice terraces stepping down a hillside and holding the sky. The colours follow your clock. |
| **Shika** 鹿 | A stag in a cedar forest at first light, grazing and looking up, with mist sliding through the trunks. |
| **Fukuro** 梟 | An owl on a branch under a low moon. Its head turns in slow steps and it blinks now and then. |
| **Usagi** 月見 | A rabbit watching the harvest moon from the silver grass, with dumplings set out and one ear that won't stay still. |
| **Nagisa** 渚 | A shoreline seen from above. The tide breathes in and out over the sand, and a small crab crosses now and then. |
| **Isaribi** 漁火 | Squid boats on the night horizon, lamps strung over the sea, and one near boat rocking in silhouette. |
| **Taki** 滝 | A tall waterfall in a mossy gorge, with maples at the top and mist rolling at the foot. |
| **Kazan** 火山 | A volcano smouldering at night over a black lake. Smoke rises and leans, lava threads breathe, nothing erupts. |
| **Onsen** 温泉 | Snow monkeys soaking in a hot spring while it snows. Steam climbs past them and one keeps nodding off. |
| **Tsuyu** 露 | A spider's web hung with dew at dawn. A band of light travels across, and each drop catches it in turn. |
| **Kaki** 柿 | A bare persimmon tree in late autumn with the last of its fruit. Crows sit in it and more cross the dusk. |
| **Kamo** 鴨 | Ducks paddling across a still pond, each with its wake, and willow strands swinging in front. |
| **Himawari** 向日葵 | A sunflower field under a big summer sky. Rows nod as slow gusts pass and towering cloud drifts behind. |
| **Shiro** 城 | A white castle on its stone base above the moat. The sky follows your clock and the windows light up after dark. |
| **Icho** 銀杏 | A ginkgo avenue in November, the road gone gold, with fan-shaped leaves coming down all around. |
| **Tako** 凧 | New Year kites over a village on a bright cold day, leaning on long strings with their tails waving. |
| **Koinobori** 鯉のぼり | Carp streamers flying from a tall pole in May. A wave runs from mouth to tail so the cloth fills and ripples. |
| **Furin** 風鈴 | A glass wind chime under the eaves on a still summer afternoon, stirring when a soft gust comes through. |
| **Kingyo** 金魚 | Goldfish in a glass bowl on a low table by the window, with swaying weed and a few bubbles rising. |
| **Chawan** 茶碗 | A bowl of matcha and an iron kettle in a quiet tea room. Only the steam moves, and the light, very slowly. |
| **Yours** | Drop any video, gif or picture (png, jpg, webp, heic, avif, tiff…) into the library and it gets woven the same way. Gifs play as looping clips. |

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

It lives in the menu bar (the little torii), out of the Dock and Cmd-Tab until
you open it. Open Library… to pick a scene, tweak it with a live preview, import
your own clips, or change when it rests. Closing the library hides it again.

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

### Market

The Market tab lists wallpapers people shared: scenes made by agents through
the MCP server, and imports someone chose to publish. Imports stay private
unless you publish them. Before anything is listed, Tokonoma makes a light,
silent copy, screens its frames on your Mac for nudity, and checks it against
the same rules as every other package; installing runs all of that again. For
now the marketplace is a folder on this Mac (`Registry/`), shared with agents.

The nudity screen uses [NSFWDetector](https://github.com/lovoo/NSFWDetector)'s
17 KB Core ML model by LOVOO (BSD-3-Clause, licence in `Resources/Models`).

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
