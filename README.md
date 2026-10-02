# zehua-jiang.github.io

Static personal site: no build step. Open `index.html` locally, or run `python3 -m http.server` and visit http://localhost:8000.

- `index.html`: all content (research, work, publications, news, about)
- `assets/css/style.css`: styles, with light and dark themes
- `assets/js/main.js`: theme toggle, publication filter, EN/中文 bio, lightbox, and the hero demo (a hill-climbing level editor)
- `assets/img/`: figures from the thesis proposal and papers
- `assets/pdf/`: CV

Deploy: copy these files to the root of the `zehua-jiang.github.io` repo and push. `.nojekyll` tells GitHub Pages to serve the files as they are.
