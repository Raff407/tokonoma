const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = require('../src/package.js');

const SCENE = `Kasuri.run({ defaults: { mode: 'glyph' }, draw(ctx, t, dt, api) { ctx.fillStyle = '#1c1a19'; ctx.fillRect(0, 0, api.cols, api.rows); } });\n`;

function folder(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokonoma-pkg-'));
  const manifest = {
    id: over.id || 'paper-moon',
    name: 'Paper moon',
    author: { name: over.author || 'Mika' },
    version: over.version || 1,
    properties: [
      { key: 'mode', label: 'weave', type: 'choice', options: ['glyph', 'block', 'dot'], default: 'glyph' },
      { key: 'cell', label: 'cell size', type: 'range', min: 4, max: 24, step: 1, default: 9 },
    ],
  };
  fs.writeFileSync(path.join(dir, 'wallpaper.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, 'scene.js'), over.scene || SCENE);
  fs.writeFileSync(path.join(dir, 'index.html'), '<!-- local preview, never packed -->');
  fs.writeFileSync(path.join(dir, '.DS_Store'), 'junk');
  return dir;
}

test('pack then unpack round-trips and leaves preview files out', () => {
  const { text, report } = P.pack(folder());
  assert.equal(report.ok, true);
  const pkg = P.unpack(text);
  assert.equal(pkg.manifest.id, 'paper-moon');
  assert.deepEqual(Object.keys(pkg.files), ['scene.js']);
  assert.equal(pkg.files['scene.js'].text, SCENE);
});

test('pack refuses a package that fails the checks', () => {
  assert.throws(() => P.pack(folder({ scene: "fetch('https://x.example')" })), /network/);
});

test('a tampered package is caught by its hash', () => {
  const { text } = P.pack(folder());
  const doc = JSON.parse(text);
  doc.body = doc.body.replace('#1c1a19', '#ff00ff');
  assert.throws(() => P.unpack(JSON.stringify(doc)), /do not match/);
});

test('junk that is not a package is refused', () => {
  assert.throws(() => P.unpack('{"hello":1}'), /not a Tokonoma package/);
  assert.throws(() => P.unpack('nope'), /not a Tokonoma package/);
});

test('files are decoded to sizes the validator can trust', () => {
  const dir = folder();
  fs.mkdirSync(path.join(dir, 'assets'));
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(16, 16);
  png.writeUInt32BE(16, 20);
  fs.writeFileSync(path.join(dir, 'assets', 'dot.png'), png);
  const pkg = P.unpack(P.pack(dir).text);
  assert.equal(pkg.files['assets/dot.png'].size, 33);
  assert.ok(pkg.files['assets/dot.png'].bytes instanceof Uint8Array);
});
