const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/validate.js');

const SCENE = `
(function () {
  const ink = '#1c1a19';
  Kasuri.run({
    defaults: { mode: 'glyph' },
    draw(ctx, t, dt, api) {
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, api.cols, api.rows);
    },
  });
})();
`;

const manifest = (over = {}) => ({
  id: 'paper-moon',
  name: 'Paper moon',
  title: '月',
  description: 'A moon over washi.',
  author: { name: 'Mika', url: 'https://example.com/mika' },
  version: 1,
  properties: [
    { key: 'mode', label: 'weave', type: 'choice', options: ['glyph', 'block', 'dot', 'raw'], default: 'glyph' },
    { key: 'cell', label: 'cell size', type: 'range', min: 4, max: 24, step: 1, default: 9 },
  ],
  ...over,
});

const text = (s) => ({ size: Buffer.byteLength(s), text: s });
const pkg = (over = {}) => ({
  manifest: manifest(over.manifest),
  files: { 'scene.js': text(over.scene ?? SCENE), ...(over.files || {}) },
});

const codes = (r) => r.errors.map((e) => e.code);

// A real 2×3 PNG header (IHDR only is enough for the size parser).
function png(w, h) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return new Uint8Array(b);
}

test('a tidy package passes and reports its facts', () => {
  const r = V.validatePackage(pkg(), { packageBytes: 2048 });
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.facts.author, 'Mika');
  assert.equal(r.facts.packageBytes, 2048);
  assert.equal(r.facts.grid, '168 × 110 cells at 1512 × 982, redrawn to fit any display');
});

test('the scene must be woven by kasuri', () => {
  const r = V.validatePackage(pkg({ scene: 'const x = 1;' }));
  assert.ok(codes(r).includes('not-kasuri'));
});

test('raw pixels cannot be the default look', () => {
  const props = manifest().properties.map((p) => (p.key === 'mode' ? { ...p, default: 'raw' } : p));
  const r = V.validatePackage(pkg({ manifest: { properties: props } }));
  assert.ok(codes(r).includes('off-theme-mode'));
});

test('a weave choice is required', () => {
  const r = V.validatePackage(pkg({ manifest: { properties: [] } }));
  assert.ok(codes(r).includes('off-theme-mode'));
});

for (const [name, snippet] of [
  ['network', "fetch('https://evil.example/x')"],
  ['network', 'new XMLHttpRequest()'],
  ['network', 'new WebSocket(u)'],
  ['code-from-strings', 'eval(src)'],
  ['code-from-strings', 'new Function("return 1")'],
  ['code-from-strings', "setTimeout('alert(1)', 10)"],
  ['host-bridge', 'window.webkit.messageHandlers.tokonoma.postMessage({})'],
  ['dom', 'document.body.appendChild(x)'],
  ['dom', "el.innerHTML = '<img>'"],
  ['dom', "document.createElement('script')"],
  ['storage', 'localStorage.setItem("a", 1)'],
  ['navigation', "location.href = 'x'"],
  ['probing', 'navigator.clipboard.readText()'],
  ['outside-resources', "img.src = 'https://cdn.example/a.png'"],
  ['outside-resources', "img.src = 'data:image/png;base64,AAAA'"],
  ['text', "ctx.fillText('BUY NOW', 0, 0)"],
  ['dynamic-lookup', "window['fe' + 'tch']('x')"],
  ['sound', 'new AudioContext()'],
]) {
  test(`blocks ${name}: ${snippet}`, () => {
    const r = V.validatePackage(pkg({ scene: SCENE + '\n' + snippet + ';\n' }));
    assert.ok(codes(r).includes(name), `${snippet} → ${JSON.stringify(codes(r))}`);
  });
}

test('mentions inside comments do not count', () => {
  const r = V.validatePackage(pkg({ scene: SCENE + '\n// no fetch() here, honest\n/* eval(x) */\n' }));
  assert.deepEqual(r.errors, []);
});

test('minified or packed code is refused', () => {
  const long = 'var a=' + '1+'.repeat(400) + '1;';
  assert.ok(codes(V.validatePackage(pkg({ scene: SCENE + long }))).includes('unreadable'));
  const blob = `const s = "${'A'.repeat(2500)}";`;
  assert.ok(codes(V.validatePackage(pkg({ scene: SCENE + blob }))).includes('unreadable'));
});

test('neon palettes are off theme', () => {
  const neon = "const c = ['#ff00ff', '#00ffff', '#ff0080', '#00ff00', '#8000ff'];";
  assert.ok(codes(V.validatePackage(pkg({ scene: SCENE + neon }))).includes('off-theme-palette'));
});

test('the official palettes count as on theme', () => {
  const official = "const c = ['#d7782a', '#cf4127', '#ee6b3d', '#f4cb5c', '#d33f25', '#ffa860', '#23406b'];";
  assert.deepEqual(V.validatePackage(pkg({ scene: SCENE + official })).errors, []);
});

test('only known files are allowed in a package', () => {
  const r = V.validatePackage(pkg({ files: { 'index.html': text('<html>'), 'evil.sh': text('rm -rf') } }));
  assert.ok(codes(r).includes('unexpected-file'));
  assert.equal(r.errors.filter((e) => e.code === 'unexpected-file').length, 2);
});

test('paths cannot climb out of the package', () => {
  const r = V.validatePackage(pkg({ files: { 'assets/../../x.png': { size: 10, bytes: png(2, 2) } } }));
  assert.ok(codes(r).includes('unexpected-file'));
});

test('small images are fine and their sizes are reported', () => {
  const r = V.validatePackage(pkg({ files: { 'assets/leaf.png': { size: 33, bytes: png(32, 16) } } }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.facts.assets, [{ path: 'assets/leaf.png', width: 32, height: 16, bytes: 33 }]);
});

test('photos smuggled in as assets are refused', () => {
  const r = V.validatePackage(pkg({ files: { 'assets/photo.png': { size: 900, bytes: png(1920, 1080) } } }));
  assert.ok(codes(r).includes('asset-too-big'));
});

test('a file that lies about being a picture is refused', () => {
  const r = V.validatePackage(pkg({ files: { 'assets/x.png': { size: 4, bytes: new Uint8Array([1, 2, 3, 4]) } } }));
  assert.ok(codes(r).includes('bad-asset'));
});

test('assets must be referenced from assets/', () => {
  const r = V.validatePackage(pkg({ scene: SCENE + "\nimg.src = '../koi/media.png';\n" }));
  assert.ok(codes(r).includes('outside-resources'));
});

test('manifest rules mirror the app', () => {
  assert.ok(codes(V.validatePackage(pkg({ manifest: { id: 'Bad ID' } }))).includes('bad-manifest'));
  assert.ok(codes(V.validatePackage(pkg({ manifest: { author: { name: '' } } }))).includes('bad-manifest'));
  assert.ok(codes(V.validatePackage(pkg({ manifest: { author: { name: 'x', url: 'http://plain' } } }))).includes('bad-manifest'));
  const dup = manifest().properties.concat(manifest().properties[1]);
  assert.ok(codes(V.validatePackage(pkg({ manifest: { properties: dup } }))).includes('bad-manifest'));
  const backwards = [manifest().properties[0], { key: 'r', label: 'r', type: 'range', min: 5, max: 1, default: 3 }];
  assert.ok(codes(V.validatePackage(pkg({ manifest: { properties: backwards } }))).includes('bad-manifest'));
  assert.ok(codes(V.validatePackage(pkg({ manifest: { media: 'clip.mp4' } }))).includes('bad-manifest'));
});

test('oversized scenes are refused', () => {
  const r = V.validatePackage(pkg(), { packageBytes: 5 * 1024 * 1024 });
  assert.ok(codes(r).includes('too-big'));
});

test('render metrics from the app are judged against the theme', () => {
  const good = { motion: 0.01, flash: 0.02, coverage: 0.6, paletteShare: 0.9, msPerFrame: 1.4, mode: 'glyph' };
  assert.deepEqual(V.judgeRender(good).errors, []);
  assert.ok(V.judgeRender({ ...good, motion: 0 }).errors.some((e) => e.code === 'still'));
  assert.ok(V.judgeRender({ ...good, flash: 0.4 }).errors.some((e) => e.code === 'flashing'));
  assert.ok(V.judgeRender({ ...good, msPerFrame: 20 }).errors.some((e) => e.code === 'heavy'));
  assert.ok(V.judgeRender({ ...good, paletteShare: 0.2 }).errors.some((e) => e.code === 'off-theme-palette'));
  assert.ok(V.judgeRender({ ...good, coverage: 0.001 }).errors.some((e) => e.code === 'empty'));
});

// Calibration: the official scenes must pass the rules community scenes face.
const fs = require('node:fs');
const path = require('node:path');
for (const id of ['torii', 'koi', 'sumi', 'fuji', 'kaze']) {
  test(`official ${id} passes the shared rules`, () => {
    const dir = path.join(__dirname, '../../Wallpapers', id);
    const scene = fs.readFileSync(path.join(dir, 'scene.js'), 'utf8');
    const official = JSON.parse(fs.readFileSync(path.join(dir, 'wallpaper.json'), 'utf8'));
    const r = V.validatePackage({
      manifest: { ...official, author: { name: 'Tokonoma' } },
      files: { 'scene.js': { size: Buffer.byteLength(scene), text: scene } },
    });
    assert.deepEqual(r.errors, []);
  });
}
