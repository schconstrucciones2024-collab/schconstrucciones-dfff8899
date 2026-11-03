"""Materiales de las paredes del apartado "Sistemas constructivos": OSB, lana de vidrio, membrana hidrófuga,
ladrillos, revoques. Procedurales (se calculan, no son fotos), tileables, 1 repetición = 1 m."""
import numpy as np
from texlib import *


def _strands(rng, count, length_px, width_px, ang_sd, colors, h_levels, mode_angle=0.0):
    """Dibuja `count` virutas rectangulares. Devuelve (color RGB 0..1, altura, id de viruta normalizado)."""
    S = 2
    imgs = []
    return None


def osb_tile(seed=61):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    from PIL import Image, ImageDraw
    SS = 2
    M = N * SS
    col = Image.new("RGB", (M, M), (150, 110, 60))
    hgt = Image.new("L", (M, M), 100)
    dc, dh = ImageDraw.Draw(col), ImageDraw.Draw(hgt)
    pal = np.array([[212, 172, 98], [196, 150, 80], [176, 128, 68], [226, 190, 118], [160, 112, 60], [204, 160, 92]], dtype=float)
    for _ in range(2600):
        cx, cy = rng.uniform(0, M), rng.uniform(0, M)
        L = rng.uniform(70, 125) * SS
        W = rng.uniform(16, 30) * SS
        ang = rng.normal(0, 0.30) if rng.random() < 0.82 else rng.uniform(-1.57, 1.57)
        ca, sa = np.cos(ang), np.sin(ang)
        corners = [(-L / 2, -W / 2), (L / 2, -W / 2), (L / 2, W / 2), (-L / 2, W / 2)]
        c = pal[rng.integers(0, len(pal))] * np.exp(rng.normal(0, 0.06))
        fill = tuple(int(np.clip(v, 0, 255)) for v in c)
        lvl = int(rng.uniform(70, 190))
        for ox in (-M, 0, M):
            for oy in (-M, 0, M):
                pts = [(cx + ox + x * ca - y * sa, cy + oy + x * sa + y * ca) for x, y in corners]
                if max(p[0] for p in pts) < 0 or min(p[0] for p in pts) > M or max(p[1] for p in pts) < 0 or min(p[1] for p in pts) > M:
                    continue
                dc.polygon(pts, fill=fill)
                dh.polygon(pts, fill=lvl)
    col = col.resize((N, N), Image.LANCZOS)
    hgt = hgt.resize((N, N), Image.LANCZOS)
    alb = srgb_to_lin(np.asarray(col, dtype=np.float64) / 255.0)
    hv = np.asarray(hgt, dtype=np.float64) / 255.0
    fib = fnoise((N, N), rng, beta=1.0, fmin=0.01, fmax=0.5, ex=14.0, ey=1.0)
    fine = fnoise((N, N), rng, beta=0.5, fmin=0.05, fmax=0.5)
    # resina/cera: puntos oscuros chicos
    spk = np.clip(blobs((N, N), rng, 900, 1.2, weights=rng.uniform(0.3, 1.0, 900)), 0, 1)
    alb = alb * (1 + 0.09 * fib + 0.03 * fine)[..., None] * (1 - 0.22 * spk)[..., None]
    # borde de cada viruta: relieve por gradiente de altura
    gx = np.abs(np.roll(hv, -1, 1) - np.roll(hv, 1, 1)); gy = np.abs(np.roll(hv, -1, 0) - np.roll(hv, 1, 0))
    edge = np.clip((gx + gy) * 6, 0, 1)
    alb = alb * (1 - 0.25 * edge)[..., None]
    h = 1.4 * hv + 0.10 * fib + 0.05 * fine - 0.4 * spk
    rough = 0.74 + 0.05 * fib + 0.08 * edge
    ao = cavity_ao(h, 2.0, 0.6, 0.6) * (1 - 0.3 * edge)
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.4)


def glass_wool_tile(seed=71):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    strokes = []
    for _ in range(5200):
        x0, y0 = rng.uniform(0, N), rng.uniform(0, N)
        a = rng.uniform(0, np.pi)
        L = rng.uniform(40, 150)
        pts = []
        for s in np.linspace(0, L, 6):
            pts.append((x0 + s * np.cos(a) + rng.normal(0, 4), y0 + s * np.sin(a) + rng.normal(0, 4)))
        v = int(np.clip(rng.normal(190, 35), 80, 255))
        strokes.append((pts, rng.uniform(1.0, 2.2), v))
    fib = draw_strokes(N, strokes, mode="L", ss=2).astype(np.float64) / 255.0
    fib = gblur(fib, 0.5)
    lump = fnoise((N, N), rng, beta=2.4, fmin=0.004, fmax=0.05)
    mid = fnoise((N, N), rng, beta=1.4, fmin=0.03, fmax=0.2)
    base = srgb_to_lin(np.array([236, 208, 104]) / 255.0)
    lum = 0.62 + 0.55 * (fib - fib.mean()) / (fib.std() + 1e-6) * 0.22 + 0.08 * lump + 0.05 * mid
    alb = base[None, None, :] * np.clip(lum, 0.25, 1.6)[..., None]
    alb *= (1 + 0.05 * lump[..., None] * np.array([0.0, -0.5, -1.0])[None, None, :])
    alb = srgb_to_lin(match_mean(lin_to_srgb(alb), (240, 200, 84)))
    h = 2.2 * lump + 0.9 * mid + 1.1 * fib
    rough = 0.96 + 0.02 * mid
    ao = np.clip(0.80 + 0.06 * lump + 0.1 * (fib - fib.mean()), 0.45, 1.0)
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=0.9)


def membrane_tile(seed=81):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    strokes = []
    for _ in range(3800):
        x0, y0 = rng.uniform(0, N), rng.uniform(0, N)
        a = rng.uniform(0, np.pi)
        L = rng.uniform(25, 90)
        pts = [(x0 + s * np.cos(a) + rng.normal(0, 2.5), y0 + s * np.sin(a) + rng.normal(0, 2.5)) for s in np.linspace(0, L, 5)]
        strokes.append((pts, rng.uniform(0.8, 1.6), int(np.clip(rng.normal(200, 30), 100, 255))))
    fib = gblur(draw_strokes(N, strokes, mode="L", ss=2).astype(np.float64) / 255.0, 0.45)
    fz = (fib - fib.mean()) / (fib.std() + 1e-6)
    crease = fnoise((N, N), rng, beta=2.8, fmin=0.002, fmax=0.03)
    wrink = fnoise((N, N), rng, beta=2.0, fmin=0.006, fmax=0.08, ex=1.0, ey=0.4)
    base = srgb_to_lin(np.array([226, 228, 224]) / 255.0)
    lum = 1 + 0.045 * fz + 0.04 * crease + 0.02 * wrink
    alb = base[None, None, :] * lum[..., None]
    h = 0.5 * fz + 3.2 * crease + 1.2 * wrink
    rough = 0.62 + 0.05 * fz
    ao = np.clip(1 - 0.10 * np.clip(-crease, 0, 2), 0.7, 1)
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.0)


def brick_common_tile(seed=91):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    lo = fnoise((N, N), rng, beta=2.4, fmin=0.003, fmax=0.04)
    mid = fnoise((N, N), rng, beta=1.4, fmin=0.02, fmax=0.2)
    gr = fnoise((N, N), rng, beta=0.2, fmin=0.0, fmax=0.5)
    streak = fnoise((N, N), rng, beta=1.6, fmin=0.01, fmax=0.2, ex=1.0, ey=6.0)
    base = srgb_to_lin(np.array([176, 80, 52]) / 255.0)
    lum = 1 + 0.11 * lo + 0.07 * mid + 0.06 * gr + 0.05 * streak
    alb = base[None, None, :] * np.clip(lum, 0.4, 1.8)[..., None]
    alb *= (1 + 0.12 * lo[..., None] * np.array([0.4, 0.2, -0.5])[None, None, :])
    pits = np.clip(blobs((N, N), rng, 700, 1.4, weights=rng.uniform(0.4, 1.0, 700)), 0, 1.3)
    sand = np.clip(blobs((N, N), rng, 1400, 0.9, weights=rng.uniform(0.3, 1.0, 1400)), 0, 1.2)
    alb = alb * (1 - 0.30 * np.clip(pits, 0, 1))[..., None] * (1 + 0.10 * sand)[..., None]
    h = 0.55 * gr + 0.35 * mid + 0.8 * lo - 1.1 * pits + 0.25 * sand
    rough = 0.90 + 0.05 * mid - 0.03 * sand
    ao = cavity_ao(h, 2.0, 0.9, 0.7) * (1 - 0.3 * np.clip(pits, 0, 1))
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.4)


def brick_hollow_tile(seed=101):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    lo = fnoise((N, N), rng, beta=2.4, fmin=0.003, fmax=0.04)
    gr = fnoise((N, N), rng, beta=0.3, fmin=0.0, fmax=0.5)
    ext = fnoise((N, N), rng, beta=1.0, fmin=0.01, fmax=0.5, ex=14.0, ey=1.0)  # estrías del extruido, a lo largo de x
    ribs = np.sin(2 * np.pi * (np.arange(N)[:, None] * mm / 3.2)) * np.ones((1, N))  # surcos finos horizontales
    base = srgb_to_lin(np.array([200, 112, 78]) / 255.0)
    lum = 1 + 0.10 * lo + 0.05 * gr + 0.07 * ext + 0.025 * ribs
    alb = base[None, None, :] * np.clip(lum, 0.4, 1.8)[..., None]
    inc = np.clip(blobs((N, N), rng, 160, 1.3, weights=rng.uniform(0.4, 1.0, 160)), 0, 1.2)
    alb = alb * (1 - 0.35 * np.clip(inc, 0, 1))[..., None]
    h = 0.25 * gr + 0.35 * lo + 0.55 * ext + 0.45 * ribs - 0.6 * inc
    rough = 0.84 + 0.04 * ext
    ao = cavity_ao(h, 2.0, 0.7, 0.55)
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.3)


def render_tile(seed=111):
    """Revoque grueso exterior (cemento y arena)."""
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    lo = fnoise((N, N), rng, beta=2.6, fmin=0.002, fmax=0.03)
    mid = fnoise((N, N), rng, beta=1.5, fmin=0.02, fmax=0.2)
    gr = fnoise((N, N), rng, beta=0.0, fmin=0.0, fmax=0.5)
    sweep = fnoise((N, N), rng, beta=2.0, fmin=0.004, fmax=0.05, ex=1.0, ey=3.0)
    base = srgb_to_lin(np.array([178, 170, 154]) / 255.0)
    lum = 1 + 0.07 * lo + 0.05 * mid + 0.09 * gr + 0.04 * sweep
    alb = base[None, None, :] * lum[..., None]
    sand = np.clip(blobs((N, N), rng, 2600, 0.8, weights=rng.uniform(0.3, 1.0, 2600)), 0, 1.2)
    pits = np.clip(blobs((N, N), rng, 260, 1.5, weights=rng.uniform(0.4, 1.0, 260)), 0, 1.3)
    alb = alb * (1 + 0.08 * sand - 0.28 * np.clip(pits, 0, 1))[..., None]
    h = 0.55 * gr + 0.45 * mid + 0.8 * lo + 0.5 * sweep + 0.35 * sand - 0.9 * pits
    rough = 0.94 + 0.03 * mid
    ao = cavity_ao(h, 2.0, 0.8, 0.6) * (1 - 0.25 * np.clip(pits, 0, 1))
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.2)


def render_fine_tile(seed=121):
    """Revoque fino interior (alisado a llana)."""
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    lo = fnoise((N, N), rng, beta=2.8, fmin=0.002, fmax=0.02)
    tr = fnoise((N, N), rng, beta=1.8, fmin=0.01, fmax=0.12, ex=1.0, ey=2.2)
    gr = fnoise((N, N), rng, beta=0.3, fmin=0.05, fmax=0.5)
    base = srgb_to_lin(np.array([232, 227, 214]) / 255.0)
    lum = 1 + 0.020 * lo + 0.020 * tr + 0.014 * gr
    alb = base[None, None, :] * lum[..., None]
    dust = np.clip(blobs((N, N), rng, 260, 1.1, weights=rng.uniform(0.3, 1.0, 260)), 0, 1)
    alb *= (1 - 0.05 * dust)[..., None]
    h = 0.12 * gr + 0.30 * tr + 0.25 * lo
    rough = 0.90 + 0.03 * tr
    ao = cavity_ao(h, 2.0, 0.3, 0.3)
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=0.9)
