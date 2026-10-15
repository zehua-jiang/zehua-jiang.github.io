"""Rebuild the live transparent GIF: python3 scripts/generate_name_gif.py.

Pass a PNG frame directory to encode an existing live capture, or --tile-only
to rebuild the older tile-only two-row and banner variants.

Tiles were extracted, without recoloring, from the user-supplied reference GIF
(uploaded with a .mov extension). Four spatial workers correct local differences on a shared tile board.
"""

from pathlib import Path
import random

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "assets" / "img"
TILE = 16
DELAY = 50
EDITOR_COLOR = (255, 53, 79)  # #ff354f
GLYPHS = {
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111", "00000", "00000"],
    "e": ["00000", "00000", "01110", "10001", "11111", "10000", "01111", "00000", "00000"],
    "h": ["10000", "10000", "10110", "11001", "10001", "10001", "10001", "00000", "00000"],
    "u": ["00000", "00000", "10001", "10001", "10001", "10001", "01111", "00000", "00000"],
    "a": ["00000", "00000", "01110", "00001", "01111", "10001", "01111", "00000", "00000"],
    "J": ["11111", "00010", "00010", "00010", "00010", "10010", "01100", "00000", "00000"],
    "i": ["00100", "00000", "01100", "00100", "00100", "00100", "01110", "00000", "00000"],
    "n": ["00000", "00000", "11110", "10001", "10001", "10001", "10001", "00000", "00000"],
    "g": ["00000", "00000", "01111", "10001", "10001", "10001", "01111", "00001", "01110"],
}


def render_name(lines, stem):
    """Four independently scheduled workers repair a shared tile board."""
    rng = random.Random(20261005)
    widths = [sum(4 if c == " " else 6 for c in line) - 1 for line in lines]
    cols, rows = max(widths) + 6, len(lines) * 11 + 4
    atlas = Image.open(OUT / "zehua-jiang-tileset.png").convert("RGB")
    brick, floor = [atlas.crop((i * TILE, 0, (i + 1) * TILE, TILE)) for i in range(2)]
    base = Image.new("RGB", (cols * TILE, rows * TILE))
    for y in range(rows):
        for x in range(cols):
            base.paste(floor, (x * TILE, y * TILE))

    target = set()
    for line_index, line in enumerate(lines):
        x, y = (cols - widths[line_index]) // 2, 3 + line_index * 11
        for char in line:
            if char == " ":
                x += 4
                continue
            target.update((x + dx, y + dy) for dy, row in enumerate(GLYPHS[char])
                          for dx, value in enumerate(row) if value == "1")
            x += 6
    assert " ".join(lines) == "Zehua Jiang"

    # Start with sparse noise anywhere inside the board. Each worker owns one
    # quadrant, reads the current errors, and chooses a nearby error to repair.
    cells = [(x, y) for y in range(1, rows - 1) for x in range(1, cols - 1)]
    current = {p for p in cells if rng.random() < 0.045}
    workers = []
    for quadrant in range(4):
        region = {p for p in cells if (p[0] >= cols // 2) + 2 * (p[1] >= rows // 2) == quadrant}
        workers.append({"region": region, "position": rng.choice(sorted(region)),
                        "due": rng.randint(0, 7), "active_until": -1})

    # Blended versions of the original sprite give the reset a quiet fade.
    fades = [Image.blend(floor, brick, n / 10) for n in range(11)]
    tile_colors = set().union(*(set(tile.get_flattened_data()) for tile in fades))
    colors = sorted(tile_colors | {EDITOR_COLOR})
    assert len(colors) <= 256
    assert not any(g > r and g > b for r, g, b in colors)
    allowed = set(colors)

    def draw(walls, opacity=10, cursors=()):
        frame = base.copy()
        for x, y in walls:
            frame.paste(fades[opacity], (x * TILE, y * TILE))
        pen = ImageDraw.Draw(frame)
        for x, y in cursors:
            pen.rectangle((x * TILE, y * TILE, (x + 1) * TILE - 1, (y + 1) * TILE - 1),
                          outline=EDITOR_COLOR, width=2)
        return frame

    def validate_frame(frame):
        # Red pixels may only form up to four 2px active edit boxes.
        pixels = frame.get_flattened_data()
        overlay_pixels = [(index % frame.width, index // frame.width)
                          for index, color in enumerate(pixels) if color == EDITOR_COLOR]
        assert len(overlay_pixels) <= 4 * (TILE * TILE - (TILE - 4) ** 2)
        assert all(x % TILE < 2 or x % TILE >= TILE - 2 or
                   y % TILE < 2 or y % TILE >= TILE - 2 for x, y in overlay_pixels)
        # Every outer tile remains floor; there is no perimeter.
        assert set(pixels) <= allowed, "Unexpected path/cursor color"
        for box in ((0, 0, frame.width, TILE), (0, frame.height - TILE, frame.width, frame.height),
                    (0, 0, TILE, frame.height), (frame.width - TILE, 0, frame.width, frame.height)):
            assert frame.crop(box).tobytes() == base.crop(box).tobytes(), "Unexpected border tile"

    frames = [draw(current) for _ in range(6)]
    tick = 0
    initial_errors = len(current ^ target)
    repairs = 0
    while current != target:
        for worker in workers:
            if tick < worker["due"]:
                continue
            errors = (current ^ target) & worker["region"]
            if not errors:
                continue
            px, py = worker["position"]
            nearby = sorted(errors, key=lambda p: (abs(p[0] - px) + abs(p[1] - py), p))[:6]
            cell = rng.choice(nearby)
            current.symmetric_difference_update({cell})
            worker["position"] = cell
            worker["active_until"] = tick + 2  # 100 ms at the 50 ms frame interval.
            worker["due"] = tick + rng.randint(1, 4)
            if rng.random() < 0.08:
                worker["due"] += rng.randint(2, 6)
            repairs += 1
        cursors = [w["position"] for w in workers if tick < w["active_until"]]
        frames.append(draw(current, cursors=cursors))
        tick += 1
        assert tick < 1000, "Workers failed to converge"
    assert repairs == initial_errors and current == target
    while any(tick < w["active_until"] for w in workers):
        frames.append(draw(current, cursors=[w["position"] for w in workers
                                             if tick < w["active_until"]]))
        tick += 1
    poster = draw(current)
    poster.save(OUT / f"{stem}.png")
    frames.extend(poster.copy() for _ in range(60))
    frames.extend(draw(target, opacity) for opacity in range(9, -1, -1))
    frames.extend(base.copy() for _ in range(6))
    for frame in frames:
        validate_frame(frame)

    palette = Image.new("P", (1, 1))
    palette.putpalette([v for color in colors for v in color] + [0] * (768 - len(colors) * 3))
    encoded_frames = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    gif = OUT / f"{stem}.gif"
    encoded_frames[0].save(gif, save_all=True, append_images=encoded_frames[1:],
                           duration=DELAY, loop=0, optimize=True, disposal=1)

    # Check every decoded frame, including optimized duplicate frames. The exact
    # finished mask must appear for at least three seconds before the fade.
    with Image.open(gif) as encoded:
        assert encoded.size == poster.size and encoded.info["loop"] == 0
        duration, hold_duration = 0, 0
        for index in range(encoded.n_frames):
            encoded.seek(index)
            decoded = encoded.convert("RGB")
            validate_frame(decoded)
            frame_duration = encoded.info["duration"]
            duration += frame_duration
            if decoded.tobytes() == poster.tobytes():
                hold_duration += frame_duration
                finished_mask = set()
                for x, y in cells:
                    tile = decoded.crop((x * TILE, y * TILE, (x + 1) * TILE, (y + 1) * TILE))
                    assert tile.tobytes() in (brick.tobytes(), floor.tobytes())
                    if tile.tobytes() == brick.tobytes():
                        finished_mask.add((x, y))
                assert finished_mask == target, "Finished spelling differs from target"
        assert duration == len(frames) * DELAY and hold_duration >= 3000
        assert decoded.tobytes() == base.tobytes(), "Reset must finish on plain floor"
        print(f"{gif.name}: {encoded.size}, {duration / 1000:.1f}s, {gif.stat().st_size / 1024:.0f} KiB; "
              f"4 workers repaired {repairs} cells; all frames clean; exact hold {hold_duration / 1000:.2f}s")


def encode_live_frames(directory):
    """Encode captured live JavaScript frames, with transparent pixels cleared."""
    from collections import Counter
    import json

    files = sorted(directory.glob("frame-*.png"))
    metadata = json.loads((directory / "capture.json").read_text())
    assert len(files) == metadata["frames"] and "hold" in metadata["phases"]
    assert metadata["blankStart"] - metadata["holdStart"] >= 10000
    colors = Counter()
    for capture_index, file in enumerate(files):
        with Image.open(file) as frame:
            rgba_frame = frame.convert("RGBA")
            assert all(rgba_frame.getpixel(corner)[3] == 0 for corner in
                       ((0, 0), (frame.width - 1, 0), (0, frame.height - 1),
                        (frame.width - 1, frame.height - 1))), "Canvas background must be transparent"
            visible_colors = rgba_frame.getcolors(65536)
            assert not any(color[:3] in {(0, 172, 0), (71, 127, 65), (83, 102, 77)}
                           and color[3] >= 128 for _, color in visible_colors), "Original green dots returned"
            time = capture_index * metadata["delay"]
            if metadata["holdStart"] + 200 <= time < metadata["holdStart"] + 10000:
                assert not any(color[0] >= 240 and color[1] < 100 and color[2] < 120
                               and color[3] >= 128 for _, color in visible_colors), "Editor box during player run"
            for count, rgba in visible_colors:
                if rgba[3] >= 128:
                    colors[rgba[:3]] += count
    # One palette for the entire clip prevents sprite colors changing per frame.
    palette_colors = [color for color, _ in colors.most_common(255)]
    palette_colors.extend([palette_colors[0]] * (255 - len(palette_colors)))
    palette = Image.new("P", (1, 1))
    palette.putpalette([component for color in palette_colors + [palette_colors[0]] for component in color])
    final_palette = [0, 0, 0] + [component for color in palette_colors for component in color]
    frames = []
    for file in files:
        with Image.open(file) as captured:
            rgba = captured.convert("RGBA")
            frame = rgba.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE)
            # Reserve index zero for transparency; all visible colors start at 1.
            frame = frame.point([1 + (index if index < 255 else 0) for index in range(256)])
            frame.putpalette(final_palette)
            frame.paste(0, mask=rgba.getchannel("A").point(lambda alpha: 255 if alpha < 128 else 0))
            frame.info["transparency"] = 0
            frames.append(frame)
    destination = OUT / "zehua-jiang-tiles.gif"
    frames[0].save(destination, save_all=True, append_images=frames[1:], duration=metadata["delay"],
                   loop=0, transparency=0, disposal=2, optimize=False)
    with Image.open(directory / "poster.png") as poster:
        assert poster.mode == "RGBA" and poster.getchannel("A").getextrema() == (0, 255)
        poster.save(OUT / "zehua-jiang-tiles.png")
    # Validate decoded transparency against every source frame. Disposal=2 must
    # remove a player completely from its previous position, without trails.
    with Image.open(destination) as encoded:
        assert encoded.size == (metadata["width"], metadata["height"])
        elapsed = 0
        for index in range(encoded.n_frames):
            encoded.seek(index)
            decoded = encoded.convert("RGBA")
            for source in range(elapsed // metadata["delay"],
                                (elapsed + encoded.info["duration"]) // metadata["delay"]):
                with Image.open(files[source]) as captured:
                    expected = captured.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0)
                    assert decoded.getchannel("A").tobytes() == expected.tobytes(), "Transparent player trail"
            elapsed += encoded.info["duration"]
        assert elapsed == len(files) * metadata["delay"]
        assert decoded.getchannel("A").getextrema() == (0, 0), "Final blank frame must be transparent"
    print(f"{destination.name}: {encoded.size}, {elapsed / 1000:.1f}s, "
          f"{destination.stat().st_size / 1024:.0f} KiB; live JS frames; transparency/trails verified")


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["--tile-only"]:
        render_name(["Zehua", "Jiang"], "zehua-jiang-tiles")
        render_name(["Zehua Jiang"], "zehua-jiang-tiles-banner")
    elif len(sys.argv) > 1:
        encode_live_frames(Path(sys.argv[1]))
    else:
        import os
        import shutil
        import subprocess
        import tempfile
        runtime = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node"
        node = runtime / "bin/node"
        if not node.exists():
            node = shutil.which("node")
        assert node, "Node.js is required to capture the actual live animation"
        env = os.environ.copy()
        if (runtime / "node_modules").exists():
            env["NODE_PATH"] = str(runtime / "node_modules")
        with tempfile.TemporaryDirectory(prefix="zehua-live-frames-") as directory:
            subprocess.run([str(node), str(Path(__file__).with_name("export_name_animation.cjs")), directory],
                           check=True, env=env)
            encode_live_frames(Path(directory))
