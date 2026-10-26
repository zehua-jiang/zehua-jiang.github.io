# zehua-jiang.github.io

Static personal site: no build step. Open `index.html` locally, or run `python3 -m http.server` and visit http://localhost:8000.

- `index.html`: all content (about, research, work, news, background)
- `assets/css/style.css`: styles, with light and dark themes
- `assets/js/main.js`: theme toggle, EN/中文 bio, clipboard buttons, and lightbox
- `assets/js/tile-name.js`: live hero animation with agents assembling “Zehua Jiang” on a transparent canvas, with red outlines marking active tile edits
- `assets/js/name-platformers.js`: original procedural pixel robots that run and jump along the name tiles, using gravity and tile collision
- `assets/img/`: figures from the thesis proposal and papers
- `assets/video/`: browser-ready MP4 demos for 3D PCG and PCGRL+
- `assets/img/pcgrl-plus-*`: six animated map examples and the video poster
- `assets/pdf/`: CV
- `scripts/generate_name_gif.py`: glyph layout and GIF exporter for the matching tile-name assets

Deploy: copy these files to the root of the `zehua-jiang.github.io` repo and push. `.nojekyll` tells GitHub Pages to serve the files as they are.

Project animation sources:
- Multi-agent: the two supplied GIFs, saved as `multiagent-generation.gif` and `multiagent-20-agents.gif`.
- Agentic PCG: hero animations from https://zehua-jiang.github.io/AgenticPCG/ (`assets/light/concat_1x4.gif` and `assets/light/smb_parallel.gif`).
- Local Agentic PCG: hero animations from https://zehua-jiang.github.io/Local-Deployable-AgenticPCG/ (`assets/anim/harness_vs_openloop_pk40-kd32.gif`, `assets/anim/structural_tools_smooth-p1.gif`, and `assets/anim/structural_tools_rooms-p2.gif`).
