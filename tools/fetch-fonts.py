import os, re, urllib.request, pathlib

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
OUT = pathlib.Path('packages/ui/src/fonts')
OUT.mkdir(parents=True, exist_ok=True)
WANT = {'cyrillic', 'cyrillic-ext', 'latin', 'latin-ext'}

# Both are variable fonts, so one file per subset carries every weight in the range.
# Unbounded: display type (headlines, big numbers). Onest: everything else, typing line included.
FAMILIES = [
    ('unbounded', 'Unbounded:wght@400..800'),
    ('onest', 'Onest:wght@400..700'),
]

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(req, timeout=60).read()

blocks_out = []
for slug, spec in FAMILIES:
    css = get(f'https://fonts.googleapis.com/css2?family={spec}&display=swap').decode('utf-8')
    parts = re.split(r'/\*\s*([a-z0-9\-]+)\s*\*/', css)
    # parts: [pre, subset, block, subset, block, ...]
    for i in range(1, len(parts), 2):  # step over [subset, block] pairs; the last block is a block too
        subset, block = parts[i], parts[i + 1]
        if subset not in WANT:
            continue
        m = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)", block)
        if not m:
            continue
        url = m.group(1)
        weight = re.search(r'font-weight:\s*([^;]+);', block)
        w = (weight.group(1).strip().replace(' ', '-') if weight else '400')
        name = f'{slug}-{w}-{subset}.woff2'
        target = OUT / name
        if not target.exists():
            target.write_bytes(get(url))
        blocks_out.append(f'/* {subset} */\n' + block.replace(url, f'./fonts/{name}').strip())

header = """/*
 * Self-hosted, subset webfonts: Unbounded (display) and Onest (interface and typing line). Both are
 * SIL OFL 1.1 and variable, so one file per subset covers every weight in the range.
 *
 * Served from our own origin: no third-party request, and practice works offline after the first
 * load. Only the Cyrillic and Latin subsets are kept; the others are dead weight for a Ukrainian
 * and English product, and `unicode-range` means a page only downloads the subsets it renders.
 *
 * Generated; regenerate with tools/fetch-fonts.py rather than editing by hand.
 */

"""
pathlib.Path('packages/ui/src/fonts.css').write_text(header + '\n\n'.join(blocks_out) + '\n', encoding='utf-8')
total = sum(f.stat().st_size for f in OUT.glob('*.woff2'))
print(f'{len(list(OUT.glob("*.woff2")))} files, {total/1024:.0f} KB total')
