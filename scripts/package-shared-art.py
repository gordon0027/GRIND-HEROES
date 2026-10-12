"""Package UI/code while reusing a retained iDos build's unchanged art.

Use only when storage quota prevents a self-contained release. The art build
must remain in storage. Root-relative URLs keep Phaser requests on the active
DEV/PROD domain, avoiding cross-origin canvas loading failures.
"""
import argparse
import re
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--art-build', required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--dist', type=Path, default=Path('dist'))
args = parser.parse_args()
if not re.fullmatch(r'bld[0-9a-f]+', args.art_build):
    parser.error('art-build must be an iDos BuildId')
base = f'/v/{args.art_build}/assets/'
js = next((args.dist / 'assets').glob('index-*.js'))
css = next((args.dist / 'assets').glob('index-*.css'))
bundle = js.read_text(encoding='utf8')
bundle = bundle.replace('./assets/', '__SHARED_ART__').replace('assets/', '__SHARED_ART__')
bundle = bundle.replace('__SHARED_ART__', base)
# gearImage's generated canonical path is already rooted after the replacement.
# Fail on a changed bundle shape so a release cannot silently break inventory.
bundle, joins = re.subn(r'if\((\w+)\)return`\./\$\{\1\}`;', r'if(\1)return \1;', bundle)
if joins != 1:
    raise RuntimeError(f'Expected one inventory icon base join, got {joins}')
styles = css.read_text(encoding='utf8').replace('../assets/', base)
with zipfile.ZipFile(args.output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in ['index.html', 'sw.js']:
        archive.write(args.dist / name, name)
    archive.writestr('assets/' + js.name, bundle)
    archive.writestr('assets/' + css.name, styles)
print(f'{args.output}: {args.output.stat().st_size} bytes; shared art {args.art_build}')
