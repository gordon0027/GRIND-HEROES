"""Reduce deployed pixel-art PNG size without touching source assets.

Run after ``npm run build`` and before packaging ``dist``. Requires Pillow.
Backgrounds are intentionally left true-colour to preserve gradients.
"""

from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image


root = Path(__file__).resolve().parents[1] / "dist" / "assets"
before = after = changed = 0
for path in root.rglob("*.png"):
    size = path.stat().st_size
    before += size
    if size < 100_000 or "backgrounds" in path.parts:
        after += size
        continue
    with Image.open(path) as source:
        if source.mode not in ("RGBA", "RGB"):
            after += size
            continue
        original_size = source.size
        reduced = source.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
        with NamedTemporaryFile(dir=path.parent, suffix=".png", delete=False) as temp:
            candidate = Path(temp.name)
        try:
            reduced.save(candidate, optimize=True)
            with Image.open(candidate) as check:
                if check.size != original_size:
                    raise ValueError(f"PNG dimensions changed: {path}")
            candidate_size = candidate.stat().st_size
            if candidate_size * 5 < size * 4:
                candidate.replace(path)
                after += candidate_size
                changed += 1
            else:
                after += size
        finally:
            candidate.unlink(missing_ok=True)

print(f"Optimized {changed} PNGs: {before:,} -> {after:,} bytes")
