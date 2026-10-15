// Run with: node scripts/check_copy.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const decode = text => text.replace(/&(amp|lt|gt|quot|#x27);/g, (_, key) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'" })[key]);
const citations = Object.fromEntries([...html.matchAll(/<code id="([^"]+)">([\s\S]*?)<\/code>/g)].map(([, id, text]) => [id, { textContent: decode(text) }]));
const buttons = [...html.matchAll(/<button[^>]+data-copy-(text|target)="([^"]+)"/g)].map(([, kind, value]) => ({
  dataset: { [kind === 'text' ? 'copyText' : 'copyTarget']: value },
  addEventListener(_, handler) { this.click = handler; },
}));
assert.equal(Object.keys(citations).length, 5);
assert.equal(buttons.length, 7);
const noOp = () => {};
const empty = { querySelectorAll: () => [], addEventListener: noOp, querySelector: () => ({}) };
const status = { textContent: '' };
let copied, denied = false, timer;
vm.runInNewContext(fs.readFileSync('assets/js/main.js', 'utf8'), {
  document: {
    documentElement: { dataset: {} },
    getElementById: id => id === 'copyStatus' ? status : citations[id] || empty,
    querySelector: () => empty,
    querySelectorAll: selector => selector === '[data-copy-text], [data-copy-target]' ? buttons : [],
  },
  window: {}, localStorage: { getItem: () => null }, matchMedia: () => ({ matches: true }),
  navigator: { clipboard: { async writeText(text) { if (denied) throw Error('Denied'); copied = text; } } },
  clearTimeout: noOp, setTimeout: fn => { timer = fn; },
});
(async () => {
  for (const button of buttons) {
    await button.click();
    assert.equal(copied, button.dataset.copyText || citations[button.dataset.copyTarget].textContent);
    assert.equal(status.textContent, button.dataset.copyText ? 'Email address copied.' : 'BibTeX copied.');
  }
  assert(citations['bibtex-agentic'].textContent.includes('\\url{https://ssrn.com/abstract=6499021}'));
  denied = true;
  await buttons[0].click();
  assert.match(status.textContent, /Could not copy/);
  timer();
  assert.equal(status.textContent, '');
  console.log('Both email buttons and all five citations copy exact text; clipboard denial shows feedback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
