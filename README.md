# zehua-jiang.github.io

Static personal site: no build step. Open `index.html` locally, or run `python3 -m http.server` and visit http://localhost:8000.

- `index.html`: all content (research, work, publications, news, about)
- `assets/css/style.css`: styles, with light and dark themes
- `assets/js/main.js`: theme toggle, publication filter, EN/中文 bio, and lightbox
- `assets/js/tile-name.js`: live hero animation with agents assembling “Zehua Jiang” on a transparent canvas, with red outlines marking active tile edits
- `assets/js/name-platformers.js`: original procedural pixel robots that run and jump along the name tiles, using gravity and tile collision
- `assets/img/`: figures from the thesis proposal and papers
- `assets/pdf/`: CV
- `scripts/generate_name_gif.py`: glyph layout and GIF exporter for the matching tile-name assets

Deploy: copy these files to the root of the `zehua-jiang.github.io` repo and push. `.nojekyll` tells GitHub Pages to serve the files as they are.
