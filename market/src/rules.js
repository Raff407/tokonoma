/*
 * The rules every shared Tokonoma wallpaper is held to. One file, read by
 * the validator, the MCP server (as a resource for whoever is designing),
 * and the app. Change a number here and every checker moves together.
 */
(function (root) {
  'use strict';

  const LIMITS = Object.freeze({
    packageBytes: 600 * 1024,
    sceneBytes: 150 * 1024,
    assetBytes: 256 * 1024,
    assetCount: 8,
    assetSide: 512,
    readmeBytes: 16 * 1024,
    maxLine: 400,
    maxString: 2000,
    maxNeon: 3,
  });

  const RENDER = Object.freeze({
    minMotion: 0.0015,
    maxFlash: 0.12,
    minCoverage: 0.02,
    maxMsPerFrame: 6,
    minPaletteShare: 0.55,
  });

  const WOVEN = Object.freeze(['glyph', 'block', 'dot']);
  const MODES = Object.freeze(['glyph', 'block', 'dot', 'raw']);

  // Reference screen used to describe a wallpaper's grid (a 14" MacBook Pro).
  const REFERENCE = Object.freeze({ width: 1512, height: 982 });

  const GUIDE = `# Tokonoma wallpaper rules

Tokonoma wallpapers are woven: a scene paints a tiny picture (one pixel per
cell) and the kasuri renderer turns every cell into a glyph, block or dot.
Shared wallpapers must look like they belong next to the official ones.

## Look
- Default weave is glyph, block or dot. "raw" may be offered, never the default.
- Subjects from the same world as the official scenes: Japanese landscapes,
  water, ink, weather, gardens, night skies, small animals, seasons.
- Calm, low-contrast palettes: sumi black, washi cream, indigo, vermilion,
  moss, gold. No neon, no rainbow cycling, no pure white flashes.
- Motion is slow and continuous. Nothing flashes faster than a heartbeat.
- No text, logos, words or ads drawn into the scene.
- No photos. Small sprite or texture assets only (≤ ${LIMITS.assetSide}px a side).

## Package
- wallpaper.json, scene.js, optional assets/*.png|jpg|webp, optional README.md.
- The app writes index.html itself; packages cannot ship HTML or CSS.
- scene.js ≤ ${LIMITS.sceneBytes / 1024} KB, readable source (no minified or packed code).
- Whole package ≤ ${LIMITS.packageBytes / 1024} KB.
- Must call Kasuri.run({ defaults, setup, draw }) exactly as the official scenes do.
- Declare a "mode" choice property (glyph/block/dot/raw) and a "cell" range.
- An author name is required; it is shown to everyone who installs it.

## Safety
Scenes may only draw. They may not touch the network, storage, the DOM
outside offscreen canvases, the host app, the clipboard, sound, workers,
or build code from strings. The app also enforces this at runtime: shared
wallpapers run with no network and can only read their own folder.

## Performance
Under ${RENDER.maxMsPerFrame} ms per frame in WebKit at the reference size.
Paint into the cols × rows canvas only; cache anything still into layers.
`;

  const api = Object.freeze({ LIMITS, RENDER, WOVEN, MODES, REFERENCE, GUIDE });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TokonomaRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
