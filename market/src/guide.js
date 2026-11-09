/*
 * The kasuri API, written for whoever (or whatever agent) is making a scene.
 * Served by the MCP server as tokonoma://kasuri.
 */
'use strict';

module.exports = `# kasuri: writing a Tokonoma scene

A scene is one file, scene.js, wrapped in an IIFE. It paints a tiny picture,
one pixel per cell, into a 2D canvas; kasuri weaves that into glyphs, blocks
or dots on the GPU. You never touch the real screen.

\`\`\`js
(function () {
  'use strict';
  const K = KasuriCore;            // maths helpers (below)
  const state = {};

  function setup(ctx, api) {       // on start and whenever the grid size changes
    // build cached layers here: sky, hills, anything still
  }

  function draw(ctx, t, dt, api) { // every frame; t, dt in seconds (scaled by speed)
    // paint api.cols × api.rows pixels with the normal canvas 2D API
  }

  Kasuri.run({
    defaults: { mode: 'glyph', ramp: 'lines', cell: 9 /* + your own props */ },
    maxFps: 24,                    // ask for fewer frames if you move slowly
    setup,
    draw,
    onProps(props, api) {},        // optional: a setting changed
    onClick(x, y, api) {},         // optional: desktop click, in cells (set "interactive": true)
  });
})();
\`\`\`

## api
- \`api.cols\`, \`api.rows\`: grid size in cells. Design in proportions, not pixels
  (a handy unit is \`U = api.rows / 100\`).
- \`api.props\`: current settings, merged from wallpaper.json defaults.
- \`api.pointer\`: \`{ x, y, active }\` in cells (when "interactive": true).
- \`api.rand()\`: seeded random 0..1. \`api.seed\`: the seed.

## KasuriCore
clamp, lerp, smoothstep, noise2(x, y, seed), fbm(x, y, octaves, seed),
hash2(x, y, seed), rng(seed), parseColor('#hex') → [r,g,b], mixColor(a, b, t),
toHex, paletteAt(hour, stops), hourOf(date), seasonOf(month),
parseSprite(rows, palette) + Kasuri.drawSprite(ctx, sprite, x, y, flip).

## KasuriSky (shared clock-driven sky)
KasuriSky.hour('auto' | 'dawn' | 'day' | 'dusk' | 'night'), KasuriSky.at(hour) →
{ top, low, amb, haze, night }, KasuriSky.sunT(h), KasuriSky.moonT(h).

## Built-in props every scene gets
mode (glyph/block/dot), cell, ramp (lines/ascii/kana/dense/sparse),
gain, dither, boost, tint, invert (for light/paper scenes), bg, speed.

## wallpaper.json
id, name, title (kanji/kana), description, author { name, url }, version,
interactive, properties: [{ key, label, type: range|choice|toggle|color,
min, max, step, options, default }]. Include "mode" and "cell".

## Assets
Optional small images in assets/ (≤ 512px, no photos): \`const img = new Image();
img.src = 'assets/leaf.png';\` then \`ctx.drawImage(img, …)\` once it loads.

## Tips from the official scenes
- Cache the still world into offscreen canvases; redraw only what moves.
- Move slowly. Wind, water, ink, light. Nothing flashes.
- Light/paper scenes: set invert: true and bg to the paper colour.
- Keep a frame under ~2 ms in WebKit; use tokonoma_check to measure.
`;
