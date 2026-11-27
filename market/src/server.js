#!/usr/bin/env node
/*
 * Tokonoma MCP server — lets an AI assistant (or anyone with an MCP client)
 * design, check and package woven wallpapers on this Mac.
 *
 * Every path through it runs the same validator the app runs, and trying a
 * wallpaper always hands it to the app, which shows the checks and asks first.
 *
 * Two ways in:
 *   stdio  (Claude Code/Desktop, Codex, Cursor, Gemini CLI…)
 *            claude mcp add tokonoma -- node /path/to/market/src/server.js
 *   HTTP   (ChatGPT and other URL-based agents)
 *            node server.js --http [port]   → http://127.0.0.1:7428/mcp?key=<token>
 *          Listens on localhost only and needs the token saved in
 *          ~/Library/Application Support/Tokonoma/agent-token.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const http = require('node:http');
const crypto = require('node:crypto');
const { z } = require('zod');

const R = require('./rules.js');
const V = require('./validate.js');
const P = require('./package.js');
const S = require('./studio.js');
const KASURI_GUIDE = require('./guide.js');

const SCENES = path.join(__dirname, '..', '..', 'Wallpapers');
const EXAMPLES = ['torii', 'koi', 'fuji', 'kaze', 'take', 'sakura', 'yuki', 'hotaru', 'tsuki', 'nami', 'momiji', 'hoshi', 'toro', 'unkai', 'tsuru', 'neko', 'hanabi', 'shoji', 'hasu', 'kiri', 'densha', 'kurage', 'suisha', 'yokocho', 'ajisai', 'tanada', 'shika', 'fukuro', 'usagi', 'nagisa', 'isaribi', 'taki', 'kazan', 'onsen', 'tsuyu', 'kaki', 'kamo', 'himawari', 'shiro', 'icho', 'tako', 'koinobori', 'furin', 'kingyo', 'chawan', 'jihanki', 'kintsugi', 'tombo', 'kaeru', 'komorebi', 'suzume', 'tanuki', 'kitsune', 'iruka', 'kujira', 'umigame', 'sango', 'todai', 'minato', 'hashi', 'gojunoto', 'yamadera', 'kane', 'koke', 'shishi', 'bonsai', 'ikebana', 'maneki', 'orizuru', 'yatai', 'kotatsu', 'kissaten', 'fumikiri', 'basutei', 'yakei', 'kasa', 'matsuri', 'uma', 'hakucho', 'sagi', 'tsubame', 'ume', 'tsubaki', 'ayame', 'higan', 'fujidana', 'matsu', 'kakashi', 'kamakura', 'tsurara', 'ryuhyo', 'tanabata', 'niji', 'meoto', 'sakyu', 'kabuto', 'jizo', 'enso', 'asanoha', 'konbini', 'kinkaku', 'itsukushima', 'inari', 'shinkansen', 'sento', 'ramen', 'chochin', 'karesansui', 'kodo', 'hanaikada', 'nanohana', 'susuki', 'juhyo', 'shirakawa', 'kiyomizu', 'tawa', 'kosaten', 'izakaya', 'sakagura', 'kadomatsu', 'hatsuhinode', 'sansui', 'byobu', 'aizome', 'saru', 'cho', 'medaka', 'kani', 'inoshishi', 'mejiro', 'kawasemi', 'yudachi', 'oboro', 'kogarashi', 'karasu', 'danchi', 'kanransha', 'sakamichi', 'inaho', 'chabatake', 'uzushio', 'ryusei', 'teruteru', 'temari', 'koma', 'sensu', 'irori', 'andon', 'tsukubai', 'shodo', 'engawa', 'mikan', 'ginkaku', 'matsumoto', 'todaiji', 'nikko', 'kegon', 'kenrokuen', 'togetsukyo', 'kintaikyo', 'yakushima', 'kamikochi', 'ashinoko', 'shuri', 'ishigaki', 'asakusa', 'yukimatsuri', 'otaru', 'takayama', 'kurashiki', 'kawagoe', 'tsumago', 'ginzan', 'gion', 'kotohira', 'nachi', 'aso', 'sakurajima', 'oirase', 'nemophila', 'furano', 'kazurabashi', 'ropeway', 'hatsuyuki', 'tsuyukusa', 'kinmokusei', 'sazanka', 'nadeshiko', 'kikyo', 'hagi', 'suisen', 'yamabuki', 'fuyubotan', 'tsutsuji', 'asagao', 'shigure', 'nyudogumo', 'yuyake', 'akatsuki', 'shimobashira', 'tsuyuake', 'kitsutsuki', 'hibari', 'uguisu', 'semi', 'takotsubo', 'ayu', 'umineko', 'washi', 'kamoshika', 'risu', 'suzumushi', 'oshidori', 'momonga', 'kiji', 'tokonoma', 'furoshiki', 'kokeshi', 'hinadan', 'koto', 'nabe', 'wagashi', 'tokkuri', 'shippo', 'uroko', 'kikko', 'kasuri', 'ichimatsu', 'dojo', 'kyoshitsu', 'minka', 'shotengai', 'hiraizumi', 'izumo', 'yoshino', 'daibutsu', 'rishiri', 'yukinootani', 'hanamizuki', 'kohan', 'kasumi', 'chinden', 'kakigori', 'enoshima', 'tsuwano', 'kushiro', 'aoiike', 'nohbutai', 'komainu', 'emaki', 'senko', 'hikokigumo', 'taue', 'himeji', 'shirakami', 'ouchijuku', 'inuyama', 'hakone', 'ine', 'amanohashidate', 'hirosaki', 'matsushima', 'akiyoshi', 'hakuba', 'biwako', 'shimanami', 'sado', 'tsunoshima', 'chureito', 'onomichi', 'tomonoura', 'tokyo', 'osaka', 'biei', 'bandai', 'shirakaba', 'miho', 'hokusai', 'bokashi', 'yuzen', 'sashiko', 'kumiko', 'kamifusen', 'kamisuki', 'urushi', 'kiriko', 'noren', 'tatami', 'fusuma', 'kama', 'mokuhan', 'ranma', 'mizuhiki', 'yukata', 'tenugui', 'shoin', 'kamon', 'yagasuri', 'tsuboniwa', 'harusame', 'natsuyasumi', 'akikusa', 'yukiakari', 'haruichiban', 'mangetsu', 'obon', 'hatsumode', 'kagero', 'nowaki', 'tsukiyo', 'asagiri', 'tasogare', 'sakurafubuki', 'shiosai', 'aozora', 'kirisame', 'ryokan', 'eki', 'ishidoro', 'chashitsu', 'toge', 'kawara', 'kusaridoi', 'yukimi', 'hanami', 'sudare', 'seto', 'daimonji', 'nebuta', 'imari', 'oribe', 'satoyama', 'hamabe', 'kuroana', 'changcheng', 'gugong', 'xihu', 'guilin', 'huangshan', 'zhangjiajie', 'lijiang', 'sanxia', 'jiuzhaigou', 'suzhou', 'longji', 'yuanyang', 'dunhuang', 'shamo', 'pingyao', 'hongcun', 'wuzhen', 'tulou', 'shanghai', 'hukou', 'taishan', 'emeishan', 'shilin', 'chengqiang', 'yihe', 'tiantan', 'lugou', 'wuyi', 'shuimo', 'gongbi', 'qinghua', 'qingci', 'jingtailan', 'diaoqi', 'jianzhi', 'piying', 'fengzheng', 'denglong', 'sichou', 'yunjin', 'suxiu', 'zhuanke', 'tuanshan', 'chuanghua', 'yuemen', 'wajian', 'qingtong', 'yubi', 'yantai', 'bimo', 'gongfucha', 'zisha', 'chunjie', 'yuanxiao', 'qingming', 'longzhou', 'zhongqiu', 'chongyang', 'dongzhi', 'niulang', 'helian', 'meihua', 'mudan', 'zhulin', 'songshi', 'xiongmao', 'yunlong', 'fenghuang', 'xiangyun', 'jiangnan', 'chayuan', 'baota', 'yuhuo', 'fengqiao', 'xuezhong', 'hanshan', 'taiji', 'kongming', 'shuiyue', 'chaguan'];

const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e.message || e) }] });
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function describe(report, render) {
  const f = report.facts;
  const lines = [
    `${f.name} (${f.id}) by ${f.author || 'unknown'}`,
    `size ${kb(f.packageBytes)} · scene ${kb(f.sceneBytes)} · ${f.assets.length} image(s) ${kb(f.assetBytes)}`,
    `grid ${f.grid}`,
    ...f.assets.map((a) => `  ${a.path} ${a.width}×${a.height}`),
  ];
  if (render) {
    const m = render.metrics;
    lines.push(`render ${m.msPerFrame.toFixed(2)} ms/frame · motion ${m.motion.toFixed(4)} · flash ${m.flash.toFixed(3)} · coverage ${(m.coverage * 100).toFixed(0)}% · palette ${(m.paletteShare * 100).toFixed(0)}%`);
  } else {
    lines.push('render checks skipped: install Tokonoma.app to run them');
  }
  const problems = [...report.errors, ...(render ? V.judgeRender(render.metrics).errors : [])];
  lines.push(problems.length ? 'problems:' : 'all checks passed');
  for (const p of problems) lines.push(`  - ${p.code}: ${p.message}`);
  for (const w of report.warnings) lines.push(`  ~ ${w.code}: ${w.message}`);
  return { ok: problems.length === 0, summary: lines.join('\n') };
}

function checkFolder(folder) {
  const pkg = P.readFolder(folder);
  const draft = P.encode(pkg);
  const report = V.validatePackage(pkg, { packageBytes: Buffer.byteLength(draft, 'utf8') });
  let render = null;
  try {
    render = S.inspect(folder);
  } catch (e) {
    report.warnings.push({ code: 'render-failed', message: e.message });
  }
  return { report, render, ...describe(report, render) };
}

function buildServer() {
  const server = new McpServer({ name: 'tokonoma', version: '0.2.0' });
  server.registerResource('rules', 'tokonoma://rules', {
    title: 'Tokonoma wallpaper rules',
    description: 'Look, safety and performance rules every shared wallpaper must follow',
    mimeType: 'text/markdown',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: R.GUIDE }] }));

  server.registerTool('tokonoma_rules', {
    title: 'Read the house rules',
    description: 'The look, safety and performance rules for Tokonoma wallpapers. Read these before designing one.',
  }, async () => text(R.GUIDE));

  server.registerTool('tokonoma_new_wallpaper', {
    title: 'Start a wallpaper',
    description: 'Create a new wallpaper folder from the on-theme starter (fireflies at dusk) with a local preview page.',
    inputSchema: {
      id: z.string().describe('lowercase-with-dashes, 3–40 characters'),
      name: z.string(),
      author: z.string().describe('shown to everyone who installs it'),
      title: z.string().optional().describe('short kanji or kana title, e.g. 蛍'),
      description: z.string().optional(),
      folder: z.string().optional().describe('parent folder; defaults to ~/Tokonoma Studio'),
    },
  }, async (args) => {
    try {
      const dir = S.newWallpaper(args);
      return text(`Created ${dir}\nEdit scene.js and wallpaper.json, open index.html in a browser to preview, then run tokonoma_check.`);
    } catch (e) {
      return fail(e);
    }
  });

  server.registerTool('tokonoma_check', {
    title: 'Check a wallpaper',
    description: 'Run the safety, size and on-theme checks on a wallpaper folder. Also renders it in WebKit when Tokonoma.app is installed.',
    inputSchema: { folder: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ folder }) => {
    try {
      return text(checkFolder(folder).summary);
    } catch (e) {
      return fail(e);
    }
  });

  server.registerTool('tokonoma_preview', {
    title: 'Preview a wallpaper',
    description: 'Render a still of the wallpaper the way the desktop will show it.',
    inputSchema: { folder: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ folder }) => {
    try {
      const render = S.inspect(folder);
      if (!render) return fail(new Error('Tokonoma.app is not installed, so there is nothing to render with.'));
      const data = fs.readFileSync(render.image).toString('base64');
      fs.rmSync(render.image, { force: true });
      return { content: [{ type: 'image', data, mimeType: 'image/jpeg' }] };
    } catch (e) {
      return fail(e);
    }
  });

  server.registerTool('tokonoma_pack', {
    title: 'Package a wallpaper',
    description: 'Check the folder and write a .tokonoma package next to it (refuses if any check fails).',
    inputSchema: { folder: z.string(), out: z.string().optional() },
  }, async ({ folder, out }) => {
    try {
      const checked = checkFolder(folder);
      if (!checked.ok) return fail(new Error('Not packed.\n' + checked.summary));
      const { text: packed, report } = P.pack(folder);
      const target = out || path.join(path.dirname(path.resolve(folder)), `${report.facts.id}.tokonoma`);
      fs.writeFileSync(target, packed);
      return text(`Wrote ${target}\n${checked.summary}`);
    } catch (e) {
      return fail(e);
    }
  });

  server.registerResource('kasuri', 'tokonoma://kasuri', {
    title: 'kasuri scene API',
    description: 'How to write scene.js: the run loop, helpers, props and tips',
    mimeType: 'text/markdown',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: KASURI_GUIDE }] }));

  server.registerTool('tokonoma_guide', {
    title: 'Read the scene API',
    description: 'How to write scene.js with kasuri: run loop, helpers, built-in props, wallpaper.json fields and tips.',
  }, async () => text(KASURI_GUIDE));

  server.registerTool('tokonoma_example', {
    title: 'Read an official scene',
    description: 'Source of an official Tokonoma wallpaper (scene.js and wallpaper.json), the best reference for the house style.',
    inputSchema: { scene: z.enum(EXAMPLES) },
    annotations: { readOnlyHint: true },
  }, async ({ scene }) => {
    try {
      const dir = path.join(SCENES, scene);
      const files = fs.readdirSync(dir).filter((f) => /\.(js|json)$/.test(f));
      return text(files.map((f) => `// ===== ${scene}/${f} =====\n${fs.readFileSync(path.join(dir, f), 'utf8')}`).join('\n\n'));
    } catch (e) {
      return fail(e);
    }
  });

  server.registerTool('tokonoma_try', {
    title: 'Try it on this Mac',
    description: 'Check the folder, package it and open it in the Tokonoma app, which shows the details and asks before installing.',
    inputSchema: { folder: z.string() },
  }, async ({ folder }) => {
    try {
      const checked = checkFolder(folder);
      if (!checked.ok) return fail(new Error('Not sent to the app.\n' + checked.summary));
      const { text: packed, report } = P.pack(folder);
      const target = path.join(os.tmpdir(), `${report.facts.id}.tokonoma`);
      fs.writeFileSync(target, packed);
      const opened = spawnSync('open', ['-a', 'Tokonoma', target]);
      if (opened.status !== 0) return fail(new Error(`Packed to ${target}, but Tokonoma isn't installed to open it.`));
      return text(`Opened in Tokonoma. Choose Install there to put it on the desktop.\n${checked.summary}`);
    } catch (e) {
      return fail(e);
    }
  });

  return server;
}

// ---- transports -----------------------------------------------------------

function agentToken() {
  const file = path.join(os.homedir(), 'Library', 'Application Support', 'Tokonoma', 'agent-token');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {}
  const token = crypto.randomBytes(24).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token + '\n', { mode: 0o600 });
  return token;
}

function serveHTTP(port) {
  const token = agentToken();
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, ...(process.env.TOKONOMA_PUBLIC_HOST ? [process.env.TOKONOMA_PUBLIC_HOST] : [])]);
  // Hashing both sides first gives equal-length buffers, so the comparison
  // can't throw on odd input and still takes the same time either way.
  const digest = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();
  const expected = digest(token);
  const httpServer = http.createServer(async (req, res) => {
    // Host check first: it stops a web page in your browser reaching this through DNS rebinding.
    if (!allowedHosts.has(req.headers.host)) {
      res.writeHead(404).end();
      return;
    }
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host}`);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (url.pathname !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('key') || '';
    const sameToken = crypto.timingSafeEqual(digest(given), expected);
    if (!sameToken) {
      res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'missing or wrong key' }));
      return;
    }
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        res.writeHead(413).end();
        return;
      }
    }
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      res.writeHead(400).end();
      return;
    }
    // Stateless: a fresh server per request keeps agents from sharing state.
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  httpServer.listen(port, '127.0.0.1', () => {
    process.stderr.write(`tokonoma mcp listening on http://127.0.0.1:${port}/mcp?key=${token}\n`);
  });
}

const httpFlag = process.argv.indexOf('--http');
if (httpFlag !== -1) {
  serveHTTP(Number(process.argv[httpFlag + 1]) || 7428);
} else {
  buildServer().connect(new StdioServerTransport()).catch((e) => {
    process.stderr.write(`tokonoma mcp: ${e.stack || e}\n`);
    process.exit(1);
  });
}
