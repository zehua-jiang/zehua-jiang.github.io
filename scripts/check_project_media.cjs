// Run with: node scripts/check_project_media.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const sources = [...html.matchAll(/(?:src|poster)="(assets\/[^\"]+)"/g)];
for (const [, path] of sources) assert(fs.existsSync(path.split(/[?#]/)[0]), `Missing ${path}`);
const gifs = new Set(sources.map(([, path]) => path.split(/[?#]/)[0]).filter(path => path.endsWith('.gif')));
const infiniteLoop = Buffer.from('21ff0b4e45545343415045322e300301000000', 'hex');
for (const path of gifs) {
  assert(fs.readFileSync(path).includes(infiniteLoop), `${path} must loop indefinitely`);
}
console.log(`All media paths exist; all ${gifs.size} referenced GIFs loop indefinitely.`);
