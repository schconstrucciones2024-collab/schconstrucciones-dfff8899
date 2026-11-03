import sys, os, time
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from texlib import *
from wood import WOOD, wood_tile
import others
import wall

OUT = os.environ["TEX_OUT"]
SEEDS = {"maderaEstructural": 19, "chaponPino": 23, "chaponEucalipto": 27, "chapones": 3, "machimbre": 5, "lambriz": 7, "pisoPino": 9, "sidingRustico": 11, "sidingModerno": 13, "sidingAllwood": 15, "maderaPilote": 17}
BUILD = {k: (lambda k=k: wood_tile(WOOD[k], SEEDS[k])) for k in WOOD}
BUILD.update({"hormigon": others.concrete_tile, "drywall": others.drywall_tile, "chapa": others.chapa_tile,
              "mesada": others.mesada_tile, "arena": others.sand_tile, "pasto": others.grass_tile,
              "osb": wall.osb_tile, "lanaVidrio": wall.glass_wool_tile, "membrana": wall.membrane_tile,
              "ladrilloComun": wall.brick_common_tile, "ladrilloHueco": wall.brick_hollow_tile,
              "revoque": wall.render_tile, "revoqueFino": wall.render_fine_tile})

def save(kind, t):
    d = os.path.join(OUT, kind); os.makedirs(d, exist_ok=True)
    a, n, o = t.encode()
    Image.fromarray(a).save(os.path.join(d, "albedo.png"))
    Image.fromarray(n).save(os.path.join(d, "normal.png"))
    Image.fromarray(o).save(os.path.join(d, "orm.png"))

if __name__ == "__main__":
    kinds = sys.argv[1:] or list(BUILD)
    for k in kinds:
        t0 = time.time(); t = BUILD[k](); save(k, t)
        print(f"{k:14s} {time.time()-t0:5.1f}s  mean albedo={tuple(int(v*255) for v in t.albedo.reshape(-1,3).mean(0))} rough={t.rough.mean():.2f} ao={t.ao.mean():.2f}", flush=True)
