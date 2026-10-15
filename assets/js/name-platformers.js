/* Original little pixel robots. Letter tiles are their actual collision map. */
window.createNameRunners = function ({ cols, rows, tile, grid, lines }) {
  const width = 10, height = 14, gravity = 520;
  const colors = ['#f4eee1', '#65c6bb', '#dfb865', '#a9d6d0'];
  let players = [];

  function surfaces(line) {
    const result = [];
    for (let x = 0; x < cols; x++) {
      let top = -1;
      for (let y = line.startRow; y < line.endRow; y++) {
        if (grid[y * cols + x]) { top = y * tile; break; }
      }
      if (top < 0) continue;
      const last = result[result.length - 1];
      if (last && last.end === x * tile && last.y === top) last.end += tile;
      else result.push({ start: x * tile, end: (x + 1) * tile, y: top });
    }
    return result;
  }

  function reset() {
    players = [];
    lines.forEach((line, row) => {
      const platforms = surfaces(line);
      if (!platforms.length) return;
      for (let n = 0; n < 2; n++) {
        players.push({ x: platforms[0].start + tile / 2, y: platforms[0].y,
          vx: 0, vy: 0, grounded: true, platform: 0, platforms,
          speed: 64 + n * 12, delay: n * 1100 + row * 320,
          color: colors[row * 2 + n], done: false, elapsed: 0,
          jumps: 0, landings: 0, exiting: false });
      }
    });
  }

  function solid(x, y) {
    return x >= 0 && x < cols && y >= 0 && y < rows && grid[y * cols + x];
  }

  function jump(p) {
    const next = p.platforms[p.platform + 1];
    if (!next) {
      p.exiting = true;
      p.vx = p.speed;
      p.vy = -160;
    } else {
      // Solve a ballistic arc, leaving headroom above the next actual surface.
      const apex = Math.min(p.y, next.y) - 25;
      const up = Math.sqrt(2 * gravity * (p.y - apex));
      const flight = (up + Math.sqrt(up * up + 2 * gravity * (next.y - p.y))) / gravity;
      p.vx = ((next.start + next.end) / 2 - p.x) / flight;
      p.vy = -up;
    }
    p.grounded = false;
    p.jumps++;
  }

  function step(p, dt) {
    if (p.done) return;
    if (p.delay > 0) { p.delay -= dt * 1000; return; }
    p.elapsed += dt;
    if (p.grounded) {
      p.vx = p.speed;
      const current = p.platforms[p.platform];
      if (p.x >= Math.max(current.start + width / 2, current.end - tile * .75)) jump(p);
    }

    const oldX = p.x;
    p.x += p.vx * dt;
    // Horizontal walls stop a runner until the jump clears their top.
    const left = Math.floor((p.x - width / 2 + .1) / tile);
    const right = Math.floor((p.x + width / 2 - .1) / tile);
    for (let y = Math.floor((p.y - height + .1) / tile); y <= Math.floor((p.y - .1) / tile); y++) {
      if (p.vx > 0 && solid(right, y)) p.x = Math.min(p.x, right * tile - width / 2);
      else if (p.vx < 0 && solid(left, y)) p.x = Math.max(p.x, (left + 1) * tile + width / 2);
    }

    const oldY = p.y;
    p.vy += gravity * dt;
    p.y += p.vy * dt;
    p.grounded = false;
    const x0 = Math.floor((p.x - width / 2 + .1) / tile);
    const x1 = Math.floor((p.x + width / 2 - .1) / tile);
    if (p.vy >= 0) {
      for (let y = Math.max(0, Math.floor(oldY / tile)); y <= Math.floor(p.y / tile); y++) {
        if (y * tile < oldY - .01) continue;
        if (Array.from({ length: x1 - x0 + 1 }, (_, i) => solid(x0 + i, y)).some(Boolean)) {
          p.y = y * tile; p.vy = 0; p.grounded = true;
          if (oldY < p.y - .01) p.landings++;
          const index = p.platforms.findIndex(s => s.y === p.y && p.x + width / 2 > s.start && p.x - width / 2 < s.end);
          if (index >= 0) p.platform = index;
          break;
        }
      }
    } else {
      const oldHead = oldY - height, newHead = p.y - height;
      for (let y = Math.floor(oldHead / tile); y >= Math.floor(newHead / tile); y--) {
        if ((y + 1) * tile > oldHead + .01) continue;
        for (let x = x0; x <= x1; x++) if (solid(x, y)) {
          p.y = (y + 1) * tile + height; p.vy = 0;
        }
      }
    }
    if (p.x > cols * tile + width || p.exiting && p.y > rows * tile + height) p.done = true;
    // No teleporting: stalled movement remains subject to gravity and collision.
    p.distance = (p.distance || 0) + Math.max(0, p.x - oldX);
  }

  function update(dtMs) {
    // Small physics steps keep collision reliable after slower browser frames.
    let remaining = Math.max(0, Math.min(dtMs, 100)) / 1000;
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 120);
      players.forEach(p => step(p, dt));
      remaining -= dt;
    }
  }

  function draw(ctx) {
    for (const p of players) {
      if (p.done || p.delay > 0) continue;
      const x = Math.round(p.x - width / 2), y = Math.round(p.y - height);
      const stride = p.grounded ? Math.floor(p.elapsed * 10) % 2 : 2;
      ctx.fillStyle = '#303c43';
      ctx.fillRect(x + 1, y + 2, 8, 7); // squared robot head, no human costume
      ctx.fillStyle = p.color;
      ctx.fillRect(x + 4, y, 2, 2); // antenna
      ctx.fillRect(x, y + 3, 1, 3); ctx.fillRect(x + 9, y + 3, 1, 3);
      ctx.fillRect(x + 2, y + 3, 6, 3);
      ctx.fillRect(x + 2, y + 9, 6, 3);
      ctx.fillRect(x, y + (stride === 2 ? 8 : 10), 2, 2);
      ctx.fillRect(x + 8, y + (stride === 2 ? 8 : 10), 2, 2);
      ctx.fillRect(x + (stride === 1 ? 1 : 2), y + 12, 3, 2);
      ctx.fillRect(x + (stride === 0 ? 6 : 5), y + 12, 3, 2);
      ctx.fillStyle = '#303c43';
      ctx.fillRect(x + 3, y + 4, 1, 1); ctx.fillRect(x + 6, y + 4, 1, 1);
      ctx.fillStyle = '#f4eee1'; ctx.fillRect(x + 4, y + 10, 2, 1);
    }
  }

  return { reset, update, draw, get finished() { return players.every(p => p.done); },
    get players() { return players; } };
};
