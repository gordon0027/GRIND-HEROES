"""Package a self-contained Vite release; never depend on another build's art."""
import argparse
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--dist', type=Path, default=Path('dist'))
args = parser.parse_args()
public = Path('public')
files = sorted(p for p in args.dist.rglob('*') if p.is_file())
if not (args.dist / 'index.html').is_file():
    parser.error('Run npm run build first')
for source in public.rglob('*'):
    if source.is_file():
        packaged = args.dist / source.relative_to(public)
        if not packaged.is_file() or packaged.read_bytes() != source.read_bytes():
            parser.error(f'Missing or changed public asset: {source}')
for bundle in (args.dist / 'assets').glob('index-*'):
    if '/v/bld' in bundle.read_text(encoding='utf8'):
        parser.error(f'Cross-build asset dependency in {bundle}')
with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in files:
        archive.write(path, path.relative_to(args.dist).as_posix())
print(f'{args.output}: {len(files)} files, {args.output.stat().st_size} bytes; self-contained')
