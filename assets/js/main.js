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

})();
