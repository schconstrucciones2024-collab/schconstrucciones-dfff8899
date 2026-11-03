"""Biblioteca de síntesis de materiales PBR tileables (numpy/scipy/PIL).
Todos los campos son periódicos (se pueden repetir sin costuras).
Convención de salida: albedo sRGB, normal OpenGL (+Y arriba), ORM = (AO, rugosidad, metal)."""
import numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw

N = 1024


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def fnoise(shape, rng, beta=2.0, fmin=0.0, fmax=0.5, ex=1.0, ey=1.0):
    """Ruido gaussiano periódico con espectro 1/f^beta. ex/ey alargan los rasgos a lo largo de x/y."""
    h, w = shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt((fx * ex) ** 2 + (fy * ey) ** 2)
    f[0, 0] = 1.0
    filt = f ** (-beta / 2.0)
    filt[(f < fmin) | (f > fmax)] = 0.0
    filt[0, 0] = 0.0
    out = np.fft.ifft2(np.fft.fft2(rng.standard_normal(shape)) * filt).real
    out -= out.mean()
    s = out.std()
    return out / (s if s > 0 else 1.0)


def gblur(a, sigma):
    return ndi.gaussian_filter(a, sigma, mode="wrap")


def impulses(shape, rng, count, weights=None):
    """Matriz con impulsos en posiciones aleatorias (para luego desenfocar = manchas redondas)."""
    a = np.zeros(shape)
    ys = rng.integers(0, shape[0], count)
    xs = rng.integers(0, shape[1], count)
    w = np.ones(count) if weights is None else weights
    np.add.at(a, (ys, xs), w)
    return a


def blobs(shape, rng, count, radius_px, weights=None):
    """Discos suaves de radio ~radius_px, normalizados a pico 1 aprox."""
    imp = impulses(shape, rng, count, weights)
    g = gblur(imp, radius_px * 0.5)
    peak = 1.0 / (2 * np.pi * (radius_px * 0.5) ** 2)
    return g / peak


def normal_from_height(h_mm, mm_per_px, gain=1.0):
    dx = (np.roll(h_mm, -1, 1) - np.roll(h_mm, 1, 1)) / (2 * mm_per_px)
    dy = (np.roll(h_mm, -1, 0) - np.roll(h_mm, 1, 0)) / (2 * mm_per_px)
    nx, ny = -dx * gain, dy * gain  # OpenGL (+Y arriba; la fila 0 de la imagen es "arriba")
    l = np.sqrt(nx * nx + ny * ny + 1.0)
    return np.stack([nx / l, ny / l, 1.0 / l], -1)


def cavity_ao(h_mm, sigma_px, scale_mm, k):
    d = np.maximum(gblur(h_mm, sigma_px) - h_mm, 0.0)
    return 1.0 - k * np.clip(d / scale_mm, 0, 1)


class Tex:
    """Resultado: albedo sRGB [0,1], normal [-1,1], ao, rough, metal."""

    def __init__(self, albedo_srgb, height_mm, rough, ao, metal=None, mm_per_px=1.0, normal_gain=1.0):
        self.albedo = np.clip(albedo_srgb, 0, 1)
        self.height = height_mm
        self.rough = np.clip(rough, 0.04, 1.0)
        self.ao = np.clip(ao, 0, 1)
        self.metal = None if metal is None else np.clip(metal, 0, 1)
        self.mm = mm_per_px
        self.normal = normal_from_height(height_mm, mm_per_px, normal_gain)

    def encode(self):
        a = (self.albedo * 255 + 0.5).astype(np.uint8)
        n = ((self.normal * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)
        m = np.zeros_like(self.ao) if self.metal is None else self.metal
        orm = np.stack([self.ao, self.rough, m], -1)
        o = (orm * 255 + 0.5).astype(np.uint8)
        return a, n, o


def match_mean(albedo_srgb, target_srgb255):
    t = np.asarray(target_srgb255, dtype=np.float64) / 255.0
    m = albedo_srgb.reshape(-1, 3).mean(0)
    return np.clip(albedo_srgb * (t / m), 0, 1)


# ---------------------------------------------------------------- trazos periódicos
def draw_strokes(size, strokes, mode="RGB", ss=2, bg=0):
    """strokes: lista de (puntos[(x,y)], ancho_px, color). Dibuja con envoltura periódica y suavizado."""
    S = size * ss
    img = Image.new(mode, (S, S), bg)
    d = ImageDraw.Draw(img)
    for pts, wd, col in strokes:
        P = [(x * ss, y * ss) for x, y in pts]
        xs = [p[0] for p in P]
        ys = [p[1] for p in P]
        ox = [0]
        oy = [0]
        if min(xs) < 0 or max(xs) > S:
            ox = [-S, 0, S]
        if min(ys) < 0 or max(ys) > S:
            oy = [-S, 0, S]
        for dx in ox:
            for dy in oy:
                Q = [(x + dx, y + dy) for x, y in P]
                if max(q[0] for q in Q) < -wd * ss or min(q[0] for q in Q) > S + wd * ss:
                    continue
                if max(q[1] for q in Q) < -wd * ss or min(q[1] for q in Q) > S + wd * ss:
                    continue
                d.line(Q, fill=col, width=max(1, int(round(wd * ss))), joint="curve")
    img = img.resize((size, size), Image.LANCZOS)
    return np.asarray(img)
