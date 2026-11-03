import sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from texlib import srgb_to_lin, lin_to_srgb

OUT = os.environ["TEX_OUT"]; PREV = os.environ["TEX_PREV"]

def load(kind):
    d = os.path.join(OUT, kind)
    a = np.asarray(Image.open(os.path.join(d, "albedo.png")).convert("RGB")).astype(np.float64) / 255
    n = np.asarray(Image.open(os.path.join(d, "normal.png")).convert("RGB")).astype(np.float64) / 255 * 2 - 1
    o = np.asarray(Image.open(os.path.join(d, "orm.png")).convert("RGB")).astype(np.float64) / 255
    return a, n, o

def shade(a, n, o, light_az=-40, light_el=32, view_el=60):
    """Blinn-Phong + AO sobre un plano horizontal visto de frente. Y de imagen hacia abajo => luz desde arriba-izquierda."""
    az = np.radians(light_az); el = np.radians(light_el)
    L = np.array([np.sin(az) * np.cos(el), np.cos(az) * np.cos(el), np.sin(el)])  # x der, y arriba, z hacia el espectador
    L = np.array([-0.55, 0.55, 0.63]); L /= np.linalg.norm(L)
    V = np.array([0, 0, 1.0]); Hh = (L + V); Hh /= np.linalg.norm(Hh)
    nl = np.clip((n * L).sum(-1), 0, 1)
    nh = np.clip((n * Hh).sum(-1), 0, 1)
    ao = o[..., 0]; rough = o[..., 1]; metal = o[..., 2]
    alb = srgb_to_lin(a)
    exp = 2.0 / np.maximum(rough ** 4, 1e-3) - 2.0
    spec_k = (exp + 8) / 25.0
    f0 = 0.04 * (1 - metal)[..., None] + alb * metal[..., None]
    spec = (nh ** exp)[..., None] * f0 * spec_k[..., None] * nl[..., None]
    diff = alb * (1 - metal)[..., None]
    sky = (0.30 + 0.12 * n[..., 1:2]) * ao[..., None]
    col = diff * (2.4 * nl[..., None] * (0.55 + 0.45 * ao[..., None]) + sky * 1.4) + spec * 2.4 + 0.18 * f0 * ao[..., None]
    col = col * 0.62
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14)  # ACES aprox
    return np.clip(lin_to_srgb(col), 0, 1)

def tile2(x):
    return np.tile(x, (2, 2, 1))

def sheet(kinds, name, crop=640):
    rows = []
    for k in kinds:
        a, n, o = load(k)
        A, Nn, O = tile2(a), tile2(n), tile2(o)
        N0 = a.shape[0]
        c0 = N0 - crop // 2
        sl = (slice(c0, c0 + crop), slice(c0, c0 + crop))
        lit = shade(A[sl], Nn[sl], O[sl])
        alb = A[sl]
        # tercer panel: tile completo reducido
        full = shade(a, n, o)
        full = np.asarray(Image.fromarray((full * 255).astype(np.uint8)).resize((crop, crop), Image.LANCZOS)).astype(np.float64) / 255
        rows.append(np.concatenate([alb, lit, full], 1))
    img = np.concatenate(rows, 0)
    Image.fromarray((img * 255).astype(np.uint8)).save(os.path.join(PREV, name))

if __name__ == "__main__":
    ks = sys.argv[2:]
    sheet(ks, sys.argv[1])
