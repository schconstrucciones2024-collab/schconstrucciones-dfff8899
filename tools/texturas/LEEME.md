# Generador de texturas del visor 3D

Genera los mapas PBR que usa el visor 3D (`public/textures/<material>/`). No forma parte del build de la web: solo hace falta si querés cambiar o regenerar una textura.

Requisitos: Python 3, `numpy`, `scipy`, `pillow`.

```sh
cd tools/texturas
export TEX_OUT=/tmp/texturas_png        # carpeta de trabajo (PNG sin pérdida)
python3 gen_all.py                      # los 24 materiales; o: python3 gen_all.py pisoPino hormigon osb
export TEX_PREV=/tmp/texturas_vista     # (opcional) vista previa iluminada
mkdir -p $TEX_PREV && python3 preview.py piso.png pisoPino machimbre
python3 export_webp.py $TEX_OUT ../../public/textures   # WebP de 1024 px y de 512 px (celulares)
```

- Todos los materiales son **procedurales** (se calculan, no son fotos escaneadas) y se repiten sin costuras.
- Cada material genera: `albedo` (color sRGB), `normal` (relieve, convención OpenGL) y `orm` (R = oclusión, G = rugosidad, B = metal, sin usar).
- Los parámetros (colores base, ancho de tablas, nudos, grietas, rugosidad) están en `wood.py` (maderas y siding), `others.py` (hormigón, drywall, chapa, mesada, arena, pasto) y `wall.py` (OSB, lana de vidrio, membrana, ladrillo común y hueco, revoque y revoque fino, usados por la sección de sistemas constructivos). Los colores base coinciden con `MATERIAL_BOARDS` de `src/config/materials.ts`.
- 1 repetición = 1 m (arena y pasto: 2 m, ver `MATERIAL_TILE_M`).
