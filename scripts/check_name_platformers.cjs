// Run: node scripts/check_name_platformers.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/name-platformers.js'), 'utf8'), context);
// Use the live component's actual completed letter mask as the collision map.
const source = fs.readFileSync(path.join(root, 'assets/js/tile-name.js'), 'utf8');
const glyphLiteral = source.match(/const glyphs = (\{[\s\S]*?\n  \});/)[1];
const glyphs = vm.runInNewContext('(' + glyphLiteral + ')');
const grid = new Uint8Array(35 * 26);
['Zehua', 'Jiang'].forEach((line, r) => [...line].forEach((c, k) => {
  glyphs[c].forEach((bits, y) => [...bits].forEach((bit, x) => {
    grid[(3 + r * 11 + y) * 35 + 3 + k * 6 + x] = Number(bit);
  }));
}));
const original = grid.slice();
for (const dt of [1000 / 120, 1000 / 60, 1000 / 30, 60]) {
  const runners = context.window.createNameRunners({ cols: 35, rows: 26, tile: 16, grid,
    lines: [{ startRow: 3, endRow: 12 }, { startRow: 14, endRow: 23 }] });
  runners.reset();
  assert.equal(runners.players.length, 4);
  let time = 0;
  for (; time < 40000 && !runners.finished; time += dt) {
    runners.update(dt);
    for (const p of runners.players) {
      assert(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert(p.y >= 14, 'jump should stay inside canvas at the top');
      for (let y = Math.floor((p.y - 13.9) / 16); y <= Math.floor((p.y - .1) / 16); y++) {
        for (let x = Math.floor((p.x - 4.9) / 16); x <= Math.floor((p.x + 4.9) / 16); x++) {
          assert(!grid[y * 35 + x], 'robot body must not pass through a letter tile');
        }
      }
      if (p.grounded) {
        const tileY = Math.round(p.y / 16);
        assert([...Array(2)].some((_, i) => grid[tileY * 35 + Math.floor((p.x + (i ? 4.9 : -4.9)) / 16)]), 'landing needs solid tiles');
      }
    }
  }
  assert(runners.finished, `runners stalled at dt=${dt}: ${JSON.stringify(runners.players)}`);
  for (const p of runners.players) {
    assert(p.jumps >= 5 && p.landings >= 4, 'players should jump and land repeatedly');
    assert(p.platform === p.platforms.length - 1, 'each player must cross all the way to the final letter');
    assert(p.distance > 440, 'players must really move across the name');
  }
  assert.deepEqual(grid, original, 'running must never edit the name');
  let rectangles = 0;
  runners.reset(); runners.update(16);
  runners.draw({ fillRect(x, y, w, h) { assert(w > 0 && h > 0); rectangles++; } });
  assert(rectangles > 10, 'original robot pixels should render');
  console.log(`${dt.toFixed(1)} ms frames: four robots crossed and landed in ${(time / 1000).toFixed(2)} s`);
}
