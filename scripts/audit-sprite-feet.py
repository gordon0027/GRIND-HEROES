"""Inspect PNG alpha bounds. Bottom pixels may be weapons, not feet.

Use the contact sheet to choose actual foot anchors manually for humanoids.
The JSON is diagnostic source geometry, not an automatic ground-anchor generator.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
paths = list((root / 'public/assets/heroes').glob('*/spritesheet.png'))
paths += list((root / 'public/assets/pets').glob('*/spritesheet.png'))
paths += list((root / 'public/assets/enemies').rglob('*.png'))
rows, records = [], {}
for path in paths:
    im = Image.open(path).convert('RGBA')
    if im.width % 12 or im.height % 4:
        continue
    w, h = im.width // 12, im.height // 4
    bounds, feet = [], []
    for frame in range(48):
        crop = im.crop(((frame%12)*w, (frame//12)*h, (frame%12+1)*w, (frame//12+1)*h))
        alpha = crop.getchannel('A').point(lambda a: 255 if a >= 96 else 0)
        b = alpha.getbbox()
        bounds.append(b)
        feet.append(b[3] if b else h)
    key = str(path.relative_to(root / 'public')).replace('\\', '/')
    records[key] = {'frameWidth':w,'frameHeight':h,'feet':feet,'bounds':bounds}
    row = Image.new('RGBA', (800, 290), '#53616b')
    draw = ImageDraw.Draw(row)
    draw.text((4,4),key,fill='white')
    for j,frame in enumerate([0,12,24,35,47]):
        crop=im.crop(((frame%12)*w,(frame//12)*h,(frame%12+1)*w,(frame//12+1)*h))
        crop.thumbnail((155,245))
        row.alpha_composite(crop,(j*160,30))
    rows.append(row)
out = root / 'artifacts/combat-polish'
out.mkdir(parents=True,exist_ok=True)
(out/'sprite-bounds.json').write_text(json.dumps(records,indent=2))
sheet=Image.new('RGBA',(800,290*len(rows)))
for i,row in enumerate(rows):sheet.alpha_composite(row,(0,i*290))
sheet.convert('RGB').save(out/'sprite-audit.jpg')
print(json.dumps({k:{'idle':v['feet'][:12],'run':v['feet'][12:24],'attack':v['feet'][24:36],'death':v['feet'][36:]} for k,v in records.items()},indent=2))
