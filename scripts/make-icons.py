# Genera le icone PNG della PWA (manubrio bianco su fondo arancio) senza dipendenze esterne.
# Uso: python3 scripts/make-icons.py public/icons
import os
import struct
import sys
import zlib

BG = (0xE4, 0x57, 0x2E)  # --primary
FG = (255, 255, 255)
# Rettangoli in coordinate 0..1 (x0, y0, x1, y1): barra, dischi interni, dischi esterni.
# Il disegno sta nel 60% centrale, così l'icona funziona anche come "maskable".
RECTS = [
    (0.28, 0.465, 0.72, 0.535),
    (0.25, 0.32, 0.32, 0.68), (0.68, 0.32, 0.75, 0.68),
    (0.195, 0.39, 0.25, 0.61), (0.75, 0.39, 0.805, 0.61),
]


def inside(x, y):
    return any(a <= x <= c and b <= y <= d for a, b, c, d in RECTS)


def png(size, path, ss=4):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            hits = sum(
                inside((px + (i + 0.5) / ss) / size, (py + (j + 0.5) / ss) / size)
                for i in range(ss)
                for j in range(ss)
            )
            t = hits / (ss * ss)
            row += bytes(round(BG[k] * (1 - t) + FG[k] * t) for k in range(3))
        rows.append(bytes(row))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))

    with open(path, 'wb') as f:
        f.write(
            b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
            + chunk(b'IEND', b'')
        )


out = sys.argv[1] if len(sys.argv) > 1 else 'public/icons'
os.makedirs(out, exist_ok=True)
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    png(size, os.path.join(out, name))
    print('scritto', os.path.join(out, name))
