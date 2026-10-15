/* Four local editors converge on a tile mask; no prerecorded frame sequence. */
window.animateTileName = function (canvas) {
  const glyphs = {
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111', '00000', '00000'],
    e: ['00000', '00000', '01110', '10001', '11111', '10000', '01111', '00000', '00000'],
    h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001', '00000', '00000'],
    u: ['00000', '00000', '10001', '10001', '10001', '10001', '01111', '00000', '00000'],
    a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111', '00000', '00000'],
    J: ['11111', '00010', '00010', '00010', '00010', '10010', '01100', '00000', '00000'],
    i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110', '00000', '00000'],
    n: ['00000', '00000', '11110', '10001', '10001', '10001', '10001', '00000', '00000'],
    g: ['00000', '00000', '01111', '10001', '10001', '10001', '01111', '00001', '01110'],
  };
  const cols = 35, rows = 26, tile = 16;
  const target = new Uint8Array(cols * rows);
  ['Zehua', 'Jiang'].forEach((line, row) => {
    [...line].forEach((letter, col) => {
      glyphs[letter].forEach((bits, y) => {
        [...bits].forEach((bit, x) => { target[(3 + row * 11 + y) * cols + 3 + col * 6 + x] = Number(bit); });
      });
    });
  });

  canvas.width = cols * tile;
  canvas.height = rows * tile;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sprite = new Image();
  // Resolve against this script, so the component works on nested Pages too.
  sprite.src = new URL('../img/zehua-jiang-tileset.png', document.currentScript.src).href;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const grid = new Uint8Array(target.length);
  const empty = new Uint8Array(target.length);
  const editors = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const cells = [];
    for (let y = 2 + row * 11; y < 13 + row * 11; y++) {
      for (let x = col ? 17 : 2; x < (col ? 33 : 17); x++) cells.push(y * cols + x);
    }
    editors.push({ cells, x: col ? 25 : 9, y: 6 + row * 11, wait: Math.random() * 100, destination: -1, active: true, flash: 0 });
  }
  const runners = window.createNameRunners({ cols, rows, tile, grid, lines: [{ startRow: 3, endRow: 12 }, { startRow: 14, endRow: 23 }] });

  function draw() {
    canvas.dataset.phase = reduced.matches ? 'static' : phase;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < grid.length; i++) {
      if (grid[i]) ctx.drawImage(sprite, 0, 0, tile, tile, (i % cols) * tile, Math.floor(i / cols) * tile, tile, tile);
    }
    if (!reduced.matches) {
      ctx.strokeStyle = '#ff354f';
      ctx.lineWidth = 2;
      for (const editor of editors) {
        const editing = (phase === 'build' || phase === 'clear') && editor.active;
        if (!editing && editor.flash <= 0) continue;
        ctx.globalAlpha = editing ? 1 : editor.flash / 160;
        ctx.strokeRect(editor.x * tile + 1, editor.y * tile + 1, tile - 2, tile - 2);
      }
      ctx.globalAlpha = 1;
      if (phase === 'hold') runners.draw(ctx);
    }
  }

  let goal = target, phase = 'build', pause = 0, visible = true, last = 0;
  function reset() {
    grid.fill(0);
    // Sparse starting noise is restricted to the same editable area as the name.
    for (const editor of editors) {
      for (const i of editor.cells) grid[i] = Number(Math.random() < 0.055);
      editor.destination = -1;
      editor.wait = Math.random() * 130;
      editor.active = true;
      editor.flash = 0;
    }
    goal = target; phase = 'build'; pause = 0;
  }

  function edit(editor) {
    if (editor.destination < 0 || grid[editor.destination] === goal[editor.destination]) {
      let best = Infinity;
      editor.destination = -1;
      for (const i of editor.cells) {
        if (grid[i] === goal[i]) continue;
        const distance = Math.abs(i % cols - editor.x) + Math.abs(Math.floor(i / cols) - editor.y);
        const score = distance + Math.random() * 2.5;
        if (score < best) { best = score; editor.destination = i; }
      }
    }
    editor.active = editor.destination >= 0;
    if (!editor.active) return;
    const x = editor.destination % cols, y = Math.floor(editor.destination / cols);
    // Walk locally before editing, instead of scanning entire letters in lockstep.
    if (editor.x !== x && (editor.y === y || Math.random() < 0.5)) editor.x += Math.sign(x - editor.x);
    else if (editor.y !== y) editor.y += Math.sign(y - editor.y);
    if (editor.x === x && editor.y === y) {
      grid[editor.destination] = goal[editor.destination];
      editor.destination = -1;
      editor.flash = 160;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 60) : 0;
    last = now;
    if (!visible || document.hidden || reduced.matches) return;
    for (const editor of editors) editor.flash = Math.max(0, editor.flash - dt);
    if (phase === 'hold') {
      runners.update(dt);
      pause = Math.max(0, pause - dt);
      if (pause > 0 || !runners.finished) { draw(); return; }
      phase = 'clear'; goal = empty;
    }
    if (pause > 0) {
      pause -= dt;
      if (pause > 0) { draw(); return; }
      if (phase === 'blank') reset();
    }
    for (const editor of editors) {
      editor.wait -= dt;
      if (editor.wait <= 0) {
        edit(editor);
        editor.wait = (phase === 'clear' ? 14 : 25) + Math.random() * 45;
      }
    }
    if (grid.every((value, i) => value === goal[i])) {
      phase = phase === 'build' ? 'hold' : 'blank';
      pause = phase === 'hold' ? 10000 : 450;
      if (phase === 'hold') runners.reset();
    }
    draw();
  }

  sprite.addEventListener('load', () => {
    reset();
    if (reduced.matches) grid.set(target);
    draw();
    requestAnimationFrame(frame);
  });
  sprite.addEventListener('error', () => {
    const fallback = document.createElement('img');
    fallback.src = new URL('../img/zehua-jiang-tiles.png', sprite.src).href;
    fallback.alt = 'Zehua Jiang';
    canvas.replaceWith(fallback);
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { grid.set(target); if (sprite.complete && sprite.naturalWidth) draw(); }
    else { reset(); last = 0; }
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);
};

const nameCanvas = document.getElementById('nameCanvas');
if (nameCanvas) window.animateTileName(nameCanvas);
