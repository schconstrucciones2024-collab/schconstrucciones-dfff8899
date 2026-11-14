/**
 * Superficie de pared a pintar de un diseño: se mide sobre las paredes reales del 3D, no se estima.
 *
 *  - Exterior: cada tramo del contorno por su altura, menos puertas y ventanas, más los frontones que deja el techo
 *    (el mismo cálculo con el que el visor dibuja el siding sobre el techo de dos aguas o de una caída).
 *  - Interior: la cara de adentro de los muros exteriores y las dos caras de cada tabique, menos las aberturas
 *    (una puerta interior se descuenta de las dos caras) y menos la cerámica de los baños de woodframe, que no se pinta.
 *  - No cuenta cielorraso, pisos, mesadas ni escaleras.
 *
 * Vive junto al visor y no en `config/` porque usa la geometría del diseño (se carga junto con el diseñador, no con la página).
 */
import { BATHROOM_MATERIALS } from "@/config/materials";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { bounds, distance, isOrthogonal, planeHeight, project, roofFaces, type RoofFace } from "@/config/geometry";
import { systemOf } from "@/config/systems";
import type { PaintSurfaces } from "@/config/paint";
import { WALL_HEIGHT, designWalls, resolveWall, type HouseConfig } from "@/store/useConfigurator";
import { bathSurfaces } from "./bathTiling";

export type PaintSurfaceDetail = PaintSurfaces & {
  /** m² de frontones de siding incluidos en el exterior. */
  gables: number;
  /** m² de cerámica de baños descontados del interior. */
  tiled: number;
  /** m² de puertas y ventanas descontados (suma de las caras). */
  openings: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Frontones: el triángulo o trapecio de pared que queda entre el tope del muro y el techo, en el borde de la casa. */
function gableArea(c: HouseConfig): number {
  const slope = Math.tan(((c.roofType === "plano" ? 3 : c.roofPitch) * Math.PI) / 180);
  const b = bounds(c.contour);
  const faces: RoofFace[] =
    c.roofType === "dos" && isOrthogonal(c.contour)
      ? roofFaces(c.contour, c.roofDirection, slope)
      : [
          {
            rings: [c.contour],
            plane:
              c.roofDirection === "x"
                ? { x: slope, z: 0, c: -b.minX * slope }
                : { x: 0, z: slope, c: -b.minZ * slope },
          },
        ];
  const exterior = designWalls(c, 0).filter((w) => w.id.startsWith("edge-"));
  let area = 0;
  for (const face of faces) {
    for (const ring of face.rings) {
      ring.forEach((a, i) => {
        const e = ring[(i + 1) % ring.length];
        if (!e) return;
        const onEdge = exterior.some(
          (w) => distance(project(a, w.a, w.b).point, a) < 1e-6 && distance(project(e, w.a, w.b).point, e) < 1e-6,
        );
        if (!onEdge) return;
        const ha = Math.max(0, planeHeight(face.plane, a)),
          hb = Math.max(0, planeHeight(face.plane, e));
        area += ((ha + hb) / 2) * distance(a, e);
      });
    }
  }
  return area;
}

export function paintSurfaceDetail(c: HouseConfig): PaintSurfaceDetail {
  let exterior = 0,
    interior = 0,
    tiled = 0,
    openings = 0;
  for (let floor = 0; floor < c.floors; floor++) {
    const onFloor = c.openings.filter((o) => o.floor === floor);
    for (const w of designWalls(c, floor)) {
      const gross = distance(w.a, w.b) * (w.height ?? WALL_HEIGHT);
      const cut = onFloor
        .filter((o) => resolveWall(c, o.wall, floor)?.id === w.id)
        .reduce((n, o) => n + OPENINGS_CATALOG[o.type].width * OPENINGS_CATALOG[o.type].height, 0);
      const net = Math.max(0, gross - cut);
      if (w.id.startsWith("edge-")) {
        exterior += net;
        interior += net;
        openings += cut * 2;
      } else {
        interior += net * 2;
        openings += cut * 2;
      }
    }
    // Los baños de woodframe llevan cerámica hasta el cielorraso: esas paredes no se pintan.
    if (BATHROOM_MATERIALS[c.finish]) {
      for (const f of bathSurfaces(c, floor).faces) tiled += Math.max(0, f.t1 - f.t0) * Math.max(0, f.y1 - f.y0);
    }
  }
  const gables = systemOf(c.finish) === "woodframe" ? gableArea(c) : 0;
  return {
    exterior: round1(exterior + gables),
    interior: round1(Math.max(0, interior - tiled)),
    gables: round1(gables),
    tiled: round1(tiled),
    openings: round1(openings),
  };
}

/** m² de pared a pintar del diseño (exterior e interior). */
export function paintSurfacesOf(c: HouseConfig): PaintSurfaces {
  const { exterior, interior } = paintSurfaceDetail(c);
  return { exterior, interior };
}
