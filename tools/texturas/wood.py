import numpy as np
from texlib import *


def wood_tile(P, seed):
    """Tablas de madera (o siding) en una muestra de 1 m x 1 m. Se arma con tablas horizontales y se traspone si es vertical."""
    rng = np.random.default_rng(seed)
    mm = 1000.0 * P.get("tile_m", 1.0) / N
    nb = P["boards"]
    mode = P.get("mode", "groove")  # groove | lap
    painted = P.get("painted", False)

    fiber_g = fnoise((N, N), rng, beta=1.1, fmin=0.004, fmax=0.5, ex=P.get("fiber_ex", 28), ey=1.0)
    fine_g = fnoise((N, N), rng, beta=0.6, fmin=0.02, fmax=0.5, ex=3, ey=1.0)
    pore_g = fnoise((N, N), rng, beta=0.8, fmin=0.01, fmax=0.5, ex=12, ey=1.0)
    warp_g = fnoise((N, N), rng, beta=2.4, fmin=0.0015, fmax=0.012, ex=1.5, ey=1.0)
    patch_g = fnoise((N, N), rng, beta=2.5, fmin=0.001, fmax=0.012, ex=2.0)

    base = np.asarray(P["base"], dtype=np.float64) / 255.0
    early = srgb_to_lin(np.clip(base * np.asarray(P.get("early_k", (1.12, 1.12, 1.14))), 0, 1))
    late = srgb_to_lin(np.clip(base * np.asarray(P.get("late_k", (0.62, 0.53, 0.43))), 0, 1))
    mid = srgb_to_lin(base)

    alb = np.zeros((N, N, 3))
    hh = np.zeros((N, N))
    rough = np.zeros((N, N))
    aop = np.ones((N, N))

    xs = np.arange(N)
    for i in range(nb):
        y0 = int(round(i * N / nb)); y1 = int(round((i + 1) * N / nb)); bh = y1 - y0
        W = bh * mm
        j = int(rng.integers(0, N))
        u_px = (xs - j) % N
        u = (u_px * mm)[None, :]
        v = ((np.arange(bh) + 0.5) * mm)[:, None]

        vc = rng.uniform(-0.4, 1.4) * W
        if rng.random() < P["cathedral_p"]:
            zc = rng.uniform(*P["pith_near"]); amp = zc * rng.uniform(0.25, 0.75)
        else:
            zc = rng.uniform(*P["pith_far"]); amp = zc * rng.uniform(0.04, 0.22)
        k = int(rng.integers(1, 3)); ph = rng.uniform(0, 2 * np.pi)
        z = zc + amp * np.sin(2 * np.pi * k * u_px / N + ph)[None, :]
        R = np.sqrt((v - vc) ** 2 + z ** 2)
        spacing = rng.uniform(*P["ring_mm"])
        # ancho de anillo variable: ruido 1-D en función del radio
        gridR = np.linspace(0, 1600, 161)
        wv = np.cumsum(rng.normal(0, 1, gridR.size)); wv = (wv - wv.mean()) / (wv.std() + 1e-6)
        wv = np.convolve(wv, np.ones(5) / 5, mode="same")
        rc = R / spacing + 0.9 * np.interp(R, gridR, wv) + P["warp"] * warp_g[y0:y1]

        kd = np.zeros((bh, N)); kh = np.zeros((bh, N))
        if rng.random() < P["knot_p"]:
            for _ in range(1 + int(rng.random() < 0.3)):
                uk = rng.uniform(0, N)
                vk = rng.uniform(0.2, 0.8) * W
                rk = rng.uniform(*P["knot_mm"])
                du = (((u_px - uk + N / 2) % N) - N / 2) * mm
                d2 = (du[None, :] / (1.9 * rk)) ** 2 + ((v - vk) / rk) ** 2
                rc = rc + P["knot_rings"] * np.exp(-d2 * 0.8)
                core = np.exp(-d2 * 3.2)
                edge = np.exp(-((np.sqrt(d2) - 0.66) / 0.16) ** 2)
                kd = np.maximum(kd, np.clip(0.62 * core + 0.40 * edge, 0, 0.8))
                kh += 0.12 * core

        t = rc - np.floor(rc)
        band = smoothstep(0.30, 0.86, t) ** 1.4 * (1 - smoothstep(0.86, 1.0, t))
        band = band / 0.9
        band = np.clip(gblur(band, 0.55), 0, 1)
        fib = fiber_g[y0:y1]; pr = pore_g[y0:y1]; fn = fine_g[y0:y1]
        pore = smoothstep(P["pore_thr"], P["pore_thr"] + 1.0, pr) * (0.3 + 0.7 * (1 - band))

        tone = np.exp(rng.normal(0, P["tone_sd"]))
        tint = np.exp(rng.normal(0, P["tint_sd"], 3))
        if painted:
            c = np.broadcast_to(mid, (bh, N, 3)).copy()
            c *= (1 + 0.012 * fib + 0.010 * fn)[..., None]
        else:
            c = early[None, None, :] * (1 - (band * P["contrast"])[..., None]) + late[None, None, :] * (band * P["contrast"])[..., None]
            c = c * (1 + P["fiber_amp"] * fib)[..., None] * (1 - 0.30 * pore)[..., None]
            c = c * (1 + 0.025 * fn)[..., None] * (1 + P["patch_amp"] * patch_g[y0:y1])[..., None]
            c = c * (1 - kd)[..., None]
        c = c * (tone * tint)[None, None, :]

        h = -P["relief"] * (1 - band) + P["fiber_relief"] * fib - 0.10 * pore * (0 if painted else 1) + kh
        if painted:
            h = h + P.get("orange_peel", 0.03) * fn
        r = P["rough"] + P["rough_var"] * fib - 0.06 * band + 0.10 * pore + 0.06 * kd
        ap = np.ones((bh, N))

        if mode == "groove":
            ve = np.minimum(v, W - v)
            g, b, D = P["gap"], P["bevel"], P["depth"]
            te = np.clip((ve - g / 2) / b, 0, 1)
            prof = 1 - smoothstep(0, 1, te)
            h = h - D * prof
            dark = 1 - smoothstep(g / 2, g / 2 + b * 0.7, ve)
            c = c * (1 - P["groove_dark"] * dark)[..., None]
            ap = ap * (1 - P["groove_ao"] * (1 - smoothstep(0, g / 2 + b * 1.6, ve)))
            r = r + 0.35 * dark
            if P.get("joint", False):
                uj = (np.minimum(u_px, N - u_px) * mm)[None, :]
                jp = np.exp(-(uj / 0.55) ** 2)
                h = h - 0.7 * jp
                c = c * (1 - 0.55 * jp)[..., None]
                ap = ap * (1 - 0.5 * jp)
        else:  # lap
            T = P["lap_T"]
            h = h + T * (v / W)
            c = c * (1 - 0.38 * np.exp(-(v / 1.8) ** 2))[..., None]
            ap = ap * (1 - 0.55 * np.exp(-(v / 14.0) ** 2))
            r = r + 0.1 * np.exp(-(v / 2.0) ** 2)

        alb[y0:y1] = c; hh[y0:y1] = h; rough[y0:y1] = r; aop[y0:y1] = ap

    if mode == "lap":
        hh = ndi.gaussian_filter(hh, (1.1, 0.0), mode="wrap")

    # grietas / rajaduras de secado
    nchk = P.get("checks", 0)
    if nchk:
        strokes_h = []
        for _ in range(nchk):
            x0 = rng.uniform(0, N); y = rng.uniform(0, N)
            L = rng.uniform(120, 480); pts = []
            for s in range(0, int(L), 24):
                pts.append((x0 + s, y + rng.normal(0, 0.9) * (s / 60.0)))
            strokes_h.append((pts, rng.uniform(1.6, 3.2), 255))
        m = draw_strokes(N, strokes_h, mode="L", ss=2).astype(np.float64) / 255.0
        m = gblur(m, 1.3)
        m = np.clip(m * 1.5, 0, 1)
        crack_col = srgb_to_lin(np.array([34, 22, 14]) / 255.0)
        wgt = (0.6 * m)[..., None]
        alb = alb * (1 - wgt) + crack_col[None, None, :] * wgt
        hh = hh - 1.4 * m
        aop = aop * (1 - 0.45 * m)
        rough = rough + 0.2 * m

    if P.get("silver", 0):  # pátina gris por intemperie
        sv = np.clip(0.5 + 0.35 * fnoise((N, N), rng, beta=2.2, fmin=0.002, fmax=0.04, ex=1.0, ey=14.0), 0, 1)
        grayc = np.asarray(mid).mean() * np.array([1.0, 1.0, 1.02])
        alb = alb * (1 - P["silver"] * sv)[..., None] + grayc[None, None, :] * (P["silver"] * sv)[..., None]

    a_srgb = lin_to_srgb(alb)
    a_srgb = match_mean(a_srgb, P["base"])

    # AO de cavidad por relieve
    ao = aop * cavity_ao(hh, P.get("ao_sigma", 3.0), P.get("ao_scale", 0.5), P.get("ao_k", 0.5))

    if P.get("vertical", False):
        T_ = lambda a: np.swapaxes(a, 0, 1)
        a_srgb, hh, rough, ao = T_(a_srgb), T_(hh), T_(rough), T_(ao)
    return Tex(a_srgb, hh, rough, ao, mm_per_px=mm, normal_gain=P.get("ngain", 1.0))


WOOD = {
    "chapones": dict(base=(176, 132, 92), boards=4, mode="groove", gap=3.0, bevel=2.6, depth=1.3, groove_dark=0.55, groove_ao=0.7,
                     pith_near=(21, 84), pith_far=(150, 660), cathedral_p=0.3, ring_mm=(6.0, 11.2), warp=0.18, knot_p=0.65, knot_mm=(9, 22), knot_rings=5.0,
                     contrast=0.70, fiber_amp=0.10, patch_amp=0.07, pore_thr=1.6, tone_sd=0.07, tint_sd=0.02,
                     relief=0.20, fiber_relief=0.05, rough=0.74, rough_var=0.05, checks=3, ngain=1.2, ao_scale=0.6),
    "machimbre": dict(base=(214, 170, 112), boards=10, vertical=True, mode="groove", gap=0.8, bevel=3.2, depth=2.2, groove_dark=0.55, groove_ao=0.75,
                      pith_near=(14, 66), pith_far=(120, 480), cathedral_p=0.15, ring_mm=(4.5, 8.4), warp=0.18, knot_p=0.4, knot_mm=(6, 14), knot_rings=4.5,
                      contrast=0.62, fiber_amp=0.08, patch_amp=0.06, pore_thr=1.7, tone_sd=0.06, tint_sd=0.015,
                      relief=0.10, fiber_relief=0.03, rough=0.52, rough_var=0.04, ngain=1.0),
    "lambriz": dict(base=(222, 182, 124), boards=14, mode="groove", gap=0.8, bevel=2.6, depth=1.7, groove_dark=0.5, groove_ao=0.7,
                    pith_near=(10, 57), pith_far=(120, 420), cathedral_p=0.15, ring_mm=(4.5, 7.7), warp=0.18, knot_p=0.3, knot_mm=(5, 11), knot_rings=4.0,
                    contrast=0.58, fiber_amp=0.07, patch_amp=0.05, pore_thr=1.8, tone_sd=0.05, tint_sd=0.012,
                    relief=0.08, fiber_relief=0.03, rough=0.50, rough_var=0.04, ngain=1.0),
    "pisoPino": dict(base=(190, 142, 90), boards=8, mode="groove", gap=0.5, bevel=1.5, depth=0.55, groove_dark=0.55, groove_ao=0.7, joint=True,
                     pith_near=(18, 75), pith_far=(125, 600), cathedral_p=0.3, ring_mm=(5.2, 9.8), warp=0.18, knot_p=0.55, knot_mm=(7, 18), knot_rings=5.0,
                     contrast=0.70, fiber_amp=0.09, patch_amp=0.06, pore_thr=1.7, tone_sd=0.07, tint_sd=0.02,
                     relief=0.06, fiber_relief=0.02, rough=0.40, rough_var=0.05, ngain=1.0, ao_scale=0.4),
    "sidingRustico": dict(base=(128, 92, 62), boards=7, mode="lap", lap_T=11.0,
                          pith_near=(21, 84), pith_far=(150, 720), cathedral_p=0.3, ring_mm=(6.0, 11.2), warp=0.18, knot_p=0.5, knot_mm=(9, 20), knot_rings=5.0,
                          contrast=0.68, fiber_amp=0.12, patch_amp=0.08, pore_thr=1.5, tone_sd=0.06, tint_sd=0.02,
                          relief=0.28, fiber_relief=0.07, rough=0.80, rough_var=0.06, checks=3, ngain=1.2, ao_scale=2.5, ao_sigma=4.0, ao_k=0.35),
    "sidingAllwood": dict(base=(196, 146, 84), boards=7, mode="lap", lap_T=11.0,
                          pith_near=(21, 84), pith_far=(150, 720), cathedral_p=0.3, ring_mm=(6.0, 11.2), warp=0.18, knot_p=0.5, knot_mm=(9, 20), knot_rings=5.0,
                          contrast=0.68, fiber_amp=0.10, patch_amp=0.07, pore_thr=1.5, tone_sd=0.06, tint_sd=0.02,
                          relief=0.25, fiber_relief=0.06, rough=0.70, rough_var=0.06, checks=2, ngain=1.2, ao_scale=2.5, ao_sigma=4.0, ao_k=0.35),
    # siding pintado gris claro (fibrocemento/madera pintada): veta embutida muy suave bajo la pintura
    "sidingModerno": dict(base=(206, 209, 212), boards=7, mode="lap", lap_T=11.0, painted=True,
                          pith_near=(21, 84), pith_far=(150, 720), cathedral_p=0.3, ring_mm=(6.0, 11.2), warp=0.18, knot_p=0.0, knot_mm=(9, 20), knot_rings=5.0,
                          contrast=0.0, fiber_amp=0.0, patch_amp=0.0, pore_thr=9.0, tone_sd=0.012, tint_sd=0.002,
                          relief=0.30, fiber_relief=0.12, orange_peel=0.05, rough=0.66, rough_var=0.03, ngain=1.0, ao_scale=2.5, ao_sigma=4.0, ao_k=0.3),
    "maderaPilote": dict(base=(112, 100, 70), boards=4, vertical=True, mode="groove", gap=0.0, bevel=1.0, depth=0.0, groove_dark=0.0, groove_ao=0.0,
                         pith_near=(60, 150), pith_far=(200, 520), cathedral_p=0.2, ring_mm=(7.0, 11.0), warp=0.18, knot_p=0.7, knot_mm=(14, 30), knot_rings=5.0,
                         contrast=0.68, fiber_amp=0.07, patch_amp=0.10, pore_thr=2.0, tone_sd=0.05, tint_sd=0.012,
                         relief=0.35, fiber_relief=0.10, rough=0.86, rough_var=0.06, checks=7, silver=0.25, ngain=1.3, ao_scale=0.8,
                         early_k=(1.10, 1.14, 1.04), late_k=(0.66, 0.62, 0.48)),
}

# --- Paredes (Sistemas constructivos): madera de estructura y chapones diferenciados por especie
WOOD["maderaEstructural"] = dict(base=(206, 168, 108), boards=11, vertical=True, mode="groove", gap=0.0, bevel=1.0, depth=0.0, groove_dark=0.0, groove_ao=0.0,
                                 pith_near=(40, 140), pith_far=(200, 700), cathedral_p=0.10, ring_mm=(4.5, 8.0), warp=0.15, knot_p=0.5, knot_mm=(8, 20), knot_rings=5.0,
                                 contrast=0.62, fiber_amp=0.09, patch_amp=0.07, pore_thr=1.7, tone_sd=0.06, tint_sd=0.015,
                                 relief=0.20, fiber_relief=0.06, rough=0.72, rough_var=0.05, checks=3, ngain=1.1, ao_scale=0.6)
WOOD["chaponPino"] = dict(WOOD["chapones"], base=(208, 168, 106), early_k=(1.10, 1.10, 1.14), late_k=(0.66, 0.56, 0.44), contrast=0.62, rough=0.66)
WOOD["chaponEucalipto"] = dict(WOOD["chapones"], base=(150, 100, 70), early_k=(1.12, 1.12, 1.14), late_k=(0.58, 0.46, 0.38), contrast=0.66, pith_near=(40, 140), cathedral_p=0.12, knot_p=0.4, rough=0.72)
