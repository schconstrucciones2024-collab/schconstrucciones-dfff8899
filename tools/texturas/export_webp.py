import os, sys
from PIL import Image
SRC, DST = sys.argv[1], sys.argv[2]
Q = {"albedo": 86, "normal": 93, "orm": 90}
# La compresión con pérdida de WebP submuestrea el color y suaviza las normales de grano fino: estas dos van sin pérdida a 1024 px.
LOSSLESS_NORMAL = {"pasto", "hormigon"}
tot = 0
for kind in sorted(os.listdir(SRC)):
    d = os.path.join(DST, kind); os.makedirs(d, exist_ok=True)
    for name, q in Q.items():
        im = Image.open(os.path.join(SRC, kind, name + ".png")).convert("RGB")
        for size, suf in ((1024, ""), (512, "-512")):
            r = im if size == im.width else im.resize((size, size), Image.LANCZOS)
            out = os.path.join(d, f"{name}{suf}.webp")
            if name == "normal" and kind in LOSSLESS_NORMAL and size == 1024:
                r.save(out, "WEBP", lossless=True, method=6)
            else:
                r.save(out, "WEBP", quality=q, method=6)
            tot += os.path.getsize(out)
    print(kind, sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d)) // 1024, "KB")
print("total", round(tot / 1e6, 2), "MB")
