import numpy as np
from texlib import *


def concrete_tile(seed=21):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    m1 = fnoise((N, N), rng, beta=2.4, fmin=0.002, fmax=0.03)
    m2 = fnoise((N, N), rng, beta=1.6, fmin=0.02, fmax=0.15)
    gr = fnoise((N, N), rng, beta=0.0, fmin=0.0, fmax=0.5)
    tintn = fnoise((N, N), rng, beta=2.5, fmin=0.002, fmax=0.02)
    streak = fnoise((N, N), rng, beta=2.0, fmin=0.003, fmax=0.06, ex=1.0, ey=22.0)
    base = srgb_to_lin(np.array([150, 150, 146]) / 255.0)
    agg = fnoise((N, N), rng, beta=0.4, fmin=0.05, fmax=0.5)
    lum = 1 + 0.07 * m1 + 0.05 * m2 + 0.06 * gr + 0.04 * agg - 0.035 * np.clip(streak, -1, 3)
    alb = base[None, None, :] * lum[..., None]
    alb *= (1 + 0.018 * tintn[..., None] * np.array([1.0, 0.2, -1.0])[None, None, :])
    # burbujas de aire (poros)
    pits = np.zeros((N, N))
    for rad, cnt, dep in [(0.9, 900, 0.5), (1.6, 260, 0.9), (2.8, 70, 1.5), (4.2, 12, 2.2)]:
        pits += dep * np.clip(blobs((N, N), rng, cnt, rad, weights=rng.uniform(0.5, 1.0, cnt)), 0, 1.4)
    pits = np.clip(pits, 0, 3.0)
    rim = gblur(pits, 1.6) - gblur(pits, 0.6)
    h = 0.17 * gr + 0.10 * agg + 0.35 * gblur(m2, 2.0) * 0.5 + 0.9 * gblur(m1, 6.0) - 1.1 * pits + 0.5 * rim
    alb = alb * (1 - 0.42 * np.clip(pits / 1.5, 0, 1))[..., None]
    rough = 0.80 + 0.07 * m2 + 0.04 * gr + 0.12 * np.clip(pits, 0, 1)
    ao = cavity_ao(h, 2.0, 0.9, 0.9) * (1 - 0.35 * np.clip(pits / 1.5, 0, 1))
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.6)


def drywall_tile(seed=31):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    lo = fnoise((N, N), rng, beta=2.6, fmin=0.001, fmax=0.01)
    st = fnoise((N, N), rng, beta=0.7, fmin=0.03, fmax=0.40)
    st2 = fnoise((N, N), rng, beta=1.4, fmin=0.01, fmax=0.12)
    base = srgb_to_lin(np.array([236, 233, 226]) / 255.0)
    lum = 1 + 0.012 * lo + 0.010 * st + 0.008 * st2
    alb = base[None, None, :] * lum[..., None]
    dust = blobs((N, N), rng, 260, 1.0, weights=rng.uniform(0.3, 1.0, 260))
    alb *= (1 - 0.05 * np.clip(dust, 0, 1))[..., None]
    h = 0.07 * st + 0.10 * st2 + 0.25 * lo
    rough = 0.93 + 0.025 * st
    ao = cavity_ao(h, 2.0, 0.25, 0.25)
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.0)


def chapa_tile(seed=41):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    ribs = 12
    x = (np.arange(N) + 0.5) / N
    prof = np.sin(2 * np.pi * ribs * x)[None, :]
    prof = np.broadcast_to(prof, (N, N))
    h = 8.0 * prof
    streak = fnoise((N, N), rng, beta=1.2, fmin=0.004, fmax=0.5, ex=1.0, ey=30.0)
    scr = fnoise((N, N), rng, beta=0.5, fmin=0.05, fmax=0.5, ex=1.0, ey=18.0)
    blot = fnoise((N, N), rng, beta=2.6, fmin=0.002, fmax=0.03, ex=1.0, ey=8.0)
    valley = 0.5 - 0.5 * prof  # 1 en el valle, 0 en la cresta
    base = srgb_to_lin(np.array([86, 90, 94]) / 255.0)
    lum = 1 + 0.035 * streak + 0.03 * blot - 0.22 * valley * (0.6 + 0.4 * np.clip(blot, -1, 2))
    alb = base[None, None, :] * lum[..., None]
    alb = alb * np.array([1.0, 1.0, 1.02])[None, None, :]
    h = h + 0.02 * streak + 0.015 * scr
    rough = 0.40 + 0.06 * streak + 0.10 * valley + 0.05 * np.clip(blot, -1, 2) + 0.03 * scr
    ao = 1 - 0.38 * valley ** 2.2
    metal = np.full((N, N), 0.62) + 0.05 * streak
    return Tex(lin_to_srgb(alb), h, rough, ao, metal=metal, mm_per_px=mm, normal_gain=1.0)


def mesada_tile(seed=51):
    rng = np.random.default_rng(seed)
    mm = 1000.0 / N
    cloud = fnoise((N, N), rng, beta=2.6, fmin=0.002, fmax=0.02)
    base = srgb_to_lin(np.array([214, 210, 202]) / 255.0)
    alb = base[None, None, :] * (1 + 0.02 * cloud)[..., None]
    fl = np.zeros((N, N, 3))
    mica = np.zeros((N, N))

    def add(color_srgb, rad, count, amp):
        nonlocal fl
        b = np.clip(blobs((N, N), rng, count, rad, weights=rng.uniform(0.4, 1.0, count)), 0, 1)
        col = srgb_to_lin(np.array(color_srgb) / 255.0)
        fl = fl + b[..., None] * (col - base)[None, None, :] * amp
        return b
    add((96, 94, 92), 0.9, 5200, 0.9)
    add((60, 58, 56), 0.7, 2400, 0.9)
    add((255, 253, 248), 1.1, 6500, 0.9)
    add((176, 160, 138), 1.2, 5200, 0.8)
    add((138, 128, 118), 1.6, 700, 0.8)
    mica = np.clip(blobs((N, N), rng, 700, 0.8), 0, 1)
    alb = alb + fl + mica[..., None] * 0.12
    haze = fnoise((N, N), rng, beta=0.6, fmin=0.05, fmax=0.5)
    h = 0.012 * haze - 0.02 * mica
    rough = 0.24 + 0.035 * cloud + 0.02 * haze - 0.12 * mica
    ao = np.ones((N, N))
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.0)


def sand_tile(seed=61):
    rng = np.random.default_rng(seed)
    tile_m = 2.0
    mm = 1000.0 * tile_m / N
    gr = rng.standard_normal((N, N))
    gr_s = gblur(gr, 0.6) * 2.0
    clump = fnoise((N, N), rng, beta=1.4, fmin=0.01, fmax=0.2)
    macro = fnoise((N, N), rng, beta=2.4, fmin=0.001, fmax=0.012)
    warp = fnoise((N, N), rng, beta=2.4, fmin=0.001, fmax=0.008)
    yy, xx = np.mgrid[0:N, 0:N]
    kx, ky = 8, 3
    phase = 2 * np.pi * (kx * xx + ky * yy) / N + 0.9 * warp
    rip = np.sin(phase) + 0.28 * np.sin(2 * phase + 0.8)
    ripple = 2.4 * rip * (0.6 + 0.4 * np.clip(0.5 + 0.5 * macro, 0, 1))
    base = srgb_to_lin(np.array([202, 191, 165]) / 255.0)
    tint = fnoise((N, N), rng, beta=0.3, fmin=0.0, fmax=0.5)
    lum = 1 + 0.10 * gr_s + 0.06 * clump + 0.05 * macro + 0.035 * rip
    alb = base[None, None, :] * lum[..., None]
    alb = alb * (1 + 0.035 * gblur(tint, 0.5)[..., None] * np.array([1.0, 0.5, -0.4])[None, None, :])
    # fragmentos de conchilla y piedritas
    h_p = np.zeros((N, N))
    classes = [((236, 228, 214), 2.2, 60, 1.1), ((150, 132, 112), 1.8, 50, 1.0), ((72, 66, 62), 1.5, 40, 1.0), ((214, 196, 170), 3.0, 35, 1.2), ((120, 100, 88), 2.4, 30, 1.0)]
    for col, rad, cnt, hgt in classes:
        b = np.clip(blobs((N, N), rng, cnt, rad, weights=rng.uniform(0.7, 1.0, cnt)), 0, 1)
        c = srgb_to_lin(np.array(col) / 255.0)
        alb = alb * (1 - b[..., None]) + c[None, None, :] * b[..., None] * (0.9 + 0.2 * rng.random())
        h_p += hgt * rad * 0.5 * b
    grains = fnoise((N, N), rng, beta=0.0, fmin=0.0, fmax=0.5)
    h = ripple + h_p + 0.25 * grains
    rough = 0.95 + 0.02 * gr_s - 0.04 * np.clip(h_p, 0, 1)
    ao = cavity_ao(h, 3.0, 2.2, 0.55) * (0.93 + 0.07 * np.clip(rip * 0.5 + 0.5, 0, 1))
    return Tex(lin_to_srgb(alb), h, rough, ao, mm_per_px=mm, normal_gain=1.0)


def grass_tile(seed=71):
    rng = np.random.default_rng(seed)
    tile_m = 2.0
    mm = 1000.0 * tile_m / N
    soil = srgb_to_lin(np.array([44, 34, 22]) / 255.0)
    patch = fnoise((N, N), rng, beta=2.4, fmin=0.001, fmax=0.015)
    patch2 = fnoise((N, N), rng, beta=1.8, fmin=0.005, fmax=0.05)
    # lienzos de color y altura
    layers = [  # (cantidad, largo, ancho, base, punta, alto base, alto punta)
        (14000, (14, 34), 2.2, (30, 52, 20), (58, 88, 30), 0.0, 6.0),
        (15000, (18, 44), 2.4, (44, 70, 24), (92, 124, 42), 5.0, 14.0),
        (12000, (22, 52), 2.2, (62, 96, 30), (128, 158, 58), 10.0, 22.0),
    ]
    img = np.zeros((N, N, 3)) + soil[None, None, :]
    height = np.zeros((N, N))
    for li, (cnt, (l0, l1), wd, cb, ct, hb, ht) in enumerate(layers):
        strokes_c, strokes_h = [], []
        for _ in range(cnt):
            x0, y0 = rng.uniform(0, N), rng.uniform(0, N)
            th = rng.uniform(0, 2 * np.pi)
            L = rng.uniform(l0, l1)
            bend = rng.normal(0, 0.9)
            tint = rng.uniform(0.75, 1.25)
            dry = rng.random() < 0.10
            segs = 4
            pts = [(x0, y0)]
            a = th
            for s in range(segs):
                a += bend / segs
                pts.append((pts[-1][0] + np.cos(a) * L / segs, pts[-1][1] + np.sin(a) * L / segs))
            for s in range(segs):
                f = (s + 0.5) / segs
                col = np.array(cb) * (1 - f) + np.array(ct) * f
                col = col * tint
                if dry:
                    col = np.array([150, 136, 70]) * (0.6 + 0.4 * f) * tint
                col = np.clip(col, 0, 255).astype(int)
                strokes_c.append((pts[s:s + 2], wd * (1 - 0.45 * f), tuple(int(v) for v in col)))
                strokes_h.append((pts[s:s + 2], wd * (1 - 0.45 * f), int(np.clip((hb + (ht - hb) * f) / 24.0 * 255, 1, 255))))
        c_img = draw_strokes(N, strokes_c, mode="RGB", ss=2, bg=0).astype(np.float64) / 255.0
        h_img = draw_strokes(N, strokes_h, mode="L", ss=2, bg=0).astype(np.float64) / 255.0 * 24.0
        mask = np.clip(h_img / 0.5, 0, 1)
        c_lin = srgb_to_lin(c_img)
        img = img * (1 - mask[..., None]) + c_lin * mask[..., None]
        height = np.where(mask > 0.5, h_img, height)
    lum = 1 + 0.16 * patch + 0.08 * patch2
    yel = np.clip(patch, 0, 3) * 0.06
    img = img * lum[..., None] * (1 + yel[..., None] * np.array([1.0, 0.7, -0.5])[None, None, :])
    h = gblur(height, 0.6)
    rough = 0.84 + 0.04 * patch2 - 0.05 * np.clip(h / 24.0, 0, 1)
    ao = np.clip(0.30 + 0.70 * np.clip(h / 18.0, 0, 1) ** 0.8, 0, 1)
    return Tex(lin_to_srgb(img), h, rough, ao, mm_per_px=mm, normal_gain=0.9)
