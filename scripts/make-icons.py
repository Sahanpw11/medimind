"""Draw the MediMind app icons (pulse-line M) with a tiny pure-Python rasteriser. Output: frontend/public/*.png"""
import math, os, struct, zlib
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "public")
PTS = [(0.20, 0.72), (0.20, 0.30), (0.50, 0.60), (0.80, 0.30), (0.80, 0.72)]
TEAL, WHITE = (0, 121, 140), (255, 255, 255)

def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

def render(size, scale, radius):
    stroke = 0.085 * scale / 2
    pts = [(0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale) for x, y in PTS]
    ss, rows = 3, []
    for j in range(size):
        row = bytearray()
        for i in range(size):
            cov = bg = 0
            for sj in range(ss):
                for si in range(ss):
                    x, y = (i + (si + .5) / ss) / size, (j + (sj + .5) / ss) / size
                    if radius:  # rounded-square alpha
                        cx, cy = min(max(x, radius), 1 - radius), min(max(y, radius), 1 - radius)
                        if math.hypot(x - cx, y - cy) > radius: continue
                    bg += 1
                    if min(seg_dist(x, y, pts[k], pts[k + 1]) for k in range(4)) <= stroke: cov += 1
            n = ss * ss
            a = bg / n
            f = cov / bg if bg else 0
            r, g, b = [round(TEAL[c] * (1 - f) + WHITE[c] * f) for c in range(3)]
            row += bytes((r, g, b, round(255 * a)))
        rows.append(b"\x00" + bytes(row))
    return rows

def png(path, size, scale=1.0, radius=0.22):
    raw = b"".join(render(size, scale, radius))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    print("wrote", os.path.basename(path))

os.makedirs(OUT, exist_ok=True)
png(os.path.join(OUT, "icon-192.png"), 192)
png(os.path.join(OUT, "icon-512.png"), 512)
png(os.path.join(OUT, "icon-maskable-512.png"), 512, scale=0.62, radius=0)   # full-bleed, mark inside the safe zone
png(os.path.join(OUT, "apple-touch-icon.png"), 180, scale=0.8, radius=0)      # iOS applies its own mask
