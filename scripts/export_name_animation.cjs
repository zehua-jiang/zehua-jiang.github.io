/* Capture the live component with an installed native Canvas; no second physics implementation. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const root = path.resolve(__dirname, '..');
  const out = path.resolve(process.argv[2] || '/private/tmp/zehua-live-frames');
  fs.mkdirSync(out, { recursive: true });
  for (const file of fs.readdirSync(out)) if (/^frame-\d+\.png$/.test(file)) fs.unlinkSync(path.join(out, file));
  const atlas = await loadImage(path.join(root, 'assets/img/zehua-jiang-tileset.png'));
  const loadCallbacks = [];
  Object.defineProperty(atlas, 'src', { configurable: true, get: () => pathToFileURL(path.join(root, 'assets/img/zehua-jiang-tileset.png')).href, set: () => {} });
  atlas.addEventListener = (event, callback) => { if (event === 'load') loadCallbacks.push(callback); };
  const canvas = createCanvas(560, 416);
  canvas.dataset = {};
  let seed = 20261005;
  const seededMath = Object.create(Math);
  seededMath.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let pending = [];
  const sandbox = {
    console, URL, Math: seededMath,
    Image: function () { return atlas; },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: { hidden: false, currentScript: { src: pathToFileURL(path.join(root, 'assets/js/tile-name.js')).href }, getElementById: () => canvas },
    requestAnimationFrame: callback => pending.push(callback),
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const file of ['name-platformers.js', 'tile-name.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context, { filename: file });
  }
  for (const callback of loadCallbacks) callback();
  const save = name => fs.writeFileSync(path.join(out, name), canvas.toBuffer('image/png'));
  let count = 0, holdStart = null, blankStart = null, posterSaved = false;
  const phases = [];
  save(`frame-${String(count++).padStart(5, '0')}.png`);
  for (let tick = 1; tick <= 7200; tick++) {
    const now = tick * 1000 / 60;
    const callbacks = pending; pending = [];
    for (const callback of callbacks) callback(now);
    const phase = canvas.dataset.phase;
    if (phases.at(-1) !== phase) phases.push(phase);
    if (phase === 'hold' && holdStart === null) holdStart = now;
    if (phase === 'hold' && !posterSaved && now - holdStart >= 5000) {
      save('poster.png'); posterSaved = true;
    }
    if (phase === 'blank' && blankStart === null) blankStart = now;
    if (tick % 6 === 0) save(`frame-${String(count++).padStart(5, '0')}.png`);
    if (blankStart !== null && now - blankStart >= 300) {
      if (!posterSaved) throw new Error('No running-player hold was captured');
      const metadata = { width: canvas.width, height: canvas.height, frames: count, delay: 100, phases, holdStart, blankStart, posterTime: holdStart + 5000 };
      fs.writeFileSync(path.join(out, 'capture.json'), JSON.stringify(metadata, null, 2) + '\n');
      console.log(JSON.stringify(metadata));
      return;
    }
  }
  throw new Error('Live component did not complete a build/run/clear cycle within 120 seconds');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
