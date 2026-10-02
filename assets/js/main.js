(() => {
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  /* ---------- theme ---------- */
  document.getElementById('themeToggle').addEventListener('click', () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('theme', root.dataset.theme);
  });

  /* ---------- chip groups ---------- */
  function chipGroup(container, attr, onSelect) {
    const chips = container.querySelectorAll('.chip');
    chips.forEach(chip => chip.addEventListener('click', () => {
      chips.forEach(c => { c.classList.toggle('active', c === chip); c.setAttribute('aria-selected', c === chip); });
      onSelect(chip.dataset[attr]);
    }));
  }

  chipGroup(document.querySelector('.pub-filter'), 'filter', f => {
    document.querySelectorAll('#pubList li').forEach(li => { li.hidden = f !== 'all' && li.dataset.cat !== f; });
  });

  const setLang = lang => {
    document.querySelectorAll('[data-lang-panel]').forEach(p => { p.hidden = p.dataset.langPanel !== lang; });
    store.set('lang', lang);
  };
  chipGroup(document.querySelector('.lang-switch'), 'lang', setLang);
  if (store.get('lang') === 'zh') document.querySelector('.lang-switch [data-lang="zh"]').click();

  /* ---------- lightbox ---------- */
  const box = document.getElementById('lightbox');
  const boxImg = box.querySelector('img');
  document.querySelectorAll('#apcgGallery button').forEach(btn => btn.addEventListener('click', () => {
    boxImg.src = btn.dataset.full;
    boxImg.alt = btn.querySelector('img').alt;
    box.showModal();
  }));
  box.addEventListener('click', () => box.close());

  /* ---------- reveal + active nav ---------- */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.source, .arc-item, .pubs li, .finding');
  if ('IntersectionObserver' in window && !reduced) {
    revealEls.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(el => io.observe(el));
  }
  const navLinks = [...document.querySelectorAll('.nav a')];
  if ('IntersectionObserver' in window) {
    const navIO = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) navIO.observe(s); });
  }

  /* ---------- hero demo: hill-climbing level editor ---------- */
  const canvas = document.getElementById('levelCanvas');
  const ctx = canvas.getContext('2d');
  const N = 13, C = canvas.width / N;
  const DOOR_A = [0, 3], DOOR_B = [N - 1, 9]; // [row, col] on top and bottom borders
  const EPISODE = 320;
  const $ = id => document.getElementById(id);
  const els = { step: $('statStep'), path: $('statPath'), kept: $('statKept'), log: $('demoLog') };
  const COLORS = { floor: '#3b2333', wall: '#b7a198', mortar: '#8b766e', wallTop: '#cfbcb2', path: '#5fe09a', door: '#3fd6d0', keep: '#7fe0a8', drop: '#ef7f7f' };

  let grid, path, step, kept, flash;

  const isBorder = (r, c) => r === 0 || c === 0 || r === N - 1 || c === N - 1;
  const isDoor = (r, c) => (r === DOOR_A[0] && c === DOOR_A[1]) || (r === DOOR_B[0] && c === DOOR_B[1]);

  function shortestPath(g) {
    const prev = new Int16Array(N * N).fill(-1);
    const start = DOOR_A[0] * N + DOOR_A[1], goal = DOOR_B[0] * N + DOOR_B[1];
    const q = [start]; prev[start] = start;
    for (let i = 0; i < q.length; i++) {
      const cur = q[i];
      if (cur === goal) break;
      const r = (cur / N) | 0, c = cur % N;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
        const n = nr * N + nc;
        if (prev[n] !== -1 || g[n]) continue;
        prev[n] = cur; q.push(n);
      }
    }
    if (prev[goal] === -1) return null;
    const out = [];
    for (let n = goal; n !== start; n = prev[n]) out.push(n);
    out.push(start);
    return out.reverse();
  }

  function reset() {
    do {
      grid = new Uint8Array(N * N);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        grid[r * N + c] = isBorder(r, c) ? (isDoor(r, c) ? 0 : 1) : (Math.random() < 0.2 ? 1 : 0);
      }
      path = shortestPath(grid);
    } while (!path);
    step = 0; kept = 0; flash = null;
    els.log.innerHTML = '';
    log('sys', '> generator.noise(p=0.20)  doors connected');
    log('sys', `> target: maximize door-to-door path (now ${path.length - 1})`);
    updateStats();
    draw(0);
  }

  function log(cls, text) {
    const li = document.createElement('li');
    li.className = cls; li.textContent = text;
    els.log.appendChild(li);
    while (els.log.children.length > 4) els.log.firstChild.remove();
  }

  function updateStats() {
    els.step.textContent = step;
    els.path.textContent = path.length - 1;
    els.kept.textContent = kept;
  }

  function tick(quiet) {
    // Most proposals block a tile on the current path (forcing a detour); the rest are random.
    let i;
    const inner = path.filter(n => !isBorder((n / N) | 0, n % N));
    if (inner.length && Math.random() < 0.6) i = inner[(Math.random() * inner.length) | 0];
    else i = (1 + ((Math.random() * (N - 2)) | 0)) * N + 1 + ((Math.random() * (N - 2)) | 0);
    const r = (i / N) | 0, c = i % N;
    const before = path.length - 1;
    grid[i] ^= 1;
    const cand = shortestPath(grid);
    const after = cand ? cand.length - 1 : -1;
    const tile = grid[i] ? 'wall' : 'floor';
    step++;
    let accepted = false;
    if (after > before || (after === before && Math.random() < 0.35)) {
      path = cand; accepted = true;
      if (after > before) kept++;
    } else {
      grid[i] ^= 1;
    }
    if (!quiet) {
      flash = { i, ok: accepted, t: performance.now() };
      const tag = `edit(${String(r).padStart(2)},${String(c).padStart(2)} → ${tile.padEnd(5)})`;
      if (after < 0) log('drop', `${tag}  disconnected  discard`);
      else if (after > before) log('keep', `${tag}  path ${before}→${after}  keep`);
      else if (!accepted) log('drop', `${tag}  path ${before}→${after}  discard`);
      updateStats();
    }
  }

  function drawWall(x, y) {
    ctx.fillStyle = COLORS.wall; ctx.fillRect(x, y, C, C);
    ctx.fillStyle = COLORS.mortar;
    const h = C / 4;
    for (let k = 1; k < 4; k++) ctx.fillRect(x, y + k * h - 1, C, 1.5);
    for (let k = 0; k < 4; k++) {
      const off = k % 2 ? C / 2 : 0;
      ctx.fillRect(x + off, y + k * h, 1.5, h);
    }
    ctx.fillStyle = COLORS.wallTop; ctx.fillRect(x, y, C, 1.5);
  }

  function draw(now) {
    ctx.fillStyle = COLORS.floor; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = c * C, y = r * C;
      if (grid[r * N + c]) drawWall(x, y);
      if (isDoor(r, c)) {
        ctx.fillStyle = COLORS.door; ctx.fillRect(x + 4, y + 4, C - 8, C - 8);
        ctx.fillStyle = '#1b6e6b'; ctx.fillRect(x + 9, y + 9, C - 18, C - 18);
      }
    }
    ctx.fillStyle = COLORS.path;
    for (let k = 1; k < path.length - 1; k++) {
      const n = path[k], x = (n % N) * C + C / 2, y = ((n / N) | 0) * C + C / 2;
      ctx.beginPath(); ctx.arc(x, y, C * 0.14, 0, Math.PI * 2); ctx.fill();
    }
    if (flash) {
      const a = 1 - Math.min(1, (now - flash.t) / 420);
      if (a > 0) {
        const x = (flash.i % N) * C, y = ((flash.i / N) | 0) * C;
        ctx.globalAlpha = a;
        ctx.strokeStyle = flash.ok ? COLORS.keep : COLORS.drop; ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, C - 3, C - 3);
        ctx.globalAlpha = 1;
      }
    }
  }

  reset();

  if (reduced) {
    for (let k = 0; k < EPISODE; k++) tick(true);
    log('sys', `> done · path ${path.length - 1}`);
    updateStats();
    draw(0);
    return;
  }

  let visible = true, last = 0, pauseUntil = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    if (pauseUntil) {
      if (now < pauseUntil) { draw(now); return; }
      pauseUntil = 0; reset();
    }
    if (now - last > 70) {
      last = now;
      tick(false);
      if (step >= EPISODE) {
        log('sys', `> stop · final path ${path.length - 1} · ${kept} improving edits`);
        pauseUntil = now + 3200;
      }
    }
    draw(now);
  }
  requestAnimationFrame(loop);
})();
