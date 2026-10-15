// Run with: node scripts/check_name_animation.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function simulate(seed, reducedMotion = false) {
  let rendered = new Set(), raf, onload, preferenceChanged, outlines = 0;
  const preference = { matches: reducedMotion, addEventListener(_, fn) { preferenceChanged = fn; } };
  const canvas = { dataset: {}, getContext: () => ({
    clearRect() { rendered = new Set(); outlines = 0; },
    strokeRect() { outlines++; },
    fillRect() {}, save() {}, restore() {}, translate() {}, scale() {},
    drawImage(_sprite, sx, sy, sw, sh, x, y) {
      assert.deepEqual([sx, sy, sw, sh], [0, 0, 16, 16]);
      rendered.add(`${x / 16},${y / 16}`);
    },
  }) };
  const math = Object.create(Math);
  math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const context = {
    window: {}, document: { currentScript: { src: 'http://localhost/assets/js/tile-name.js' }, getElementById: () => canvas },
    Image: class { complete = true; naturalWidth = 48; addEventListener(event, fn) { if (event === 'load') onload = fn; } },
    URL, Math: math, matchMedia: () => preference, requestAnimationFrame: fn => { raf = fn; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/name-platformers.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/tile-name.js'), 'utf8'), context);
  onload();
  assert.equal(canvas.width, 560); assert.equal(canvas.height, 416);
  return { rendered: () => [...rendered].sort().join(';'), outlines: () => outlines, phase: () => canvas.dataset.phase, step: t => raf(t), changeReduced(value) { preference.matches = value; preferenceChanged(); } };
}

// The reduced-motion name is the reference for the fully converged rendering.
const expected = simulate(1, true).rendered();
assert(expected.length > 0);
// Cross-check the live mask against the independently exported title-case glyphs.
const exporter = fs.readFileSync(path.join(__dirname, 'generate_name_gif.py'), 'utf8');
const glyphs = Object.fromEntries([...exporter.matchAll(/"([A-Za-z])": (\[[^\n]+\])/g)].map(m => [m[1], JSON.parse(m[2])]));
const exportedMask = [];
['Zehua', 'Jiang'].forEach((line, row) => [...line].forEach((letter, col) => {
  glyphs[letter].forEach((bits, y) => [...bits].forEach((bit, x) => {
    if (bit === '1') exportedMask.push(`${3 + col * 6 + x},${3 + row * 11 + y}`);
  }));
}));
assert.equal(expected, exportedMask.sort().join(';'));
for (let seed = 1; seed <= 12; seed++) {
  const animation = simulate(seed);
  let firstHold = -1, secondHold = -1, cleared = false, editingShown = false, cleanHold = false;
  for (let frame = 1; frame <= 3600; frame++) {
    animation.step(frame * 1000 / 60);
    const current = animation.rendered();
    if (animation.phase() === 'build' && animation.outlines() > 0) editingShown = true;
    if (animation.phase() === 'hold' && animation.outlines() === 0) cleanHold = true;
    if (current === expected && firstHold < 0) firstHold = frame;
    if (firstHold >= 0 && current === '') cleared = true;
    if (cleared && current === expected) { secondHold = frame; break; }
  }
  assert(firstHold > 0 && firstHold < 1200, `seed ${seed}: no finished name within 20s`);
  assert(secondHold > firstHold, `seed ${seed}: loop did not rebuild the exact name`);
  assert(editingShown && cleanHold, 'Editor outlines must appear during edits and disappear during the run.');
  animation.changeReduced(true);
  animation.step(100000);
  assert.equal(animation.rendered(), expected);
  assert.equal(animation.outlines(), 0);
}
console.log('12 seeds: exact name converges, clears and rebuilds; reduced-motion rendering matches.');
