import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARRILLERO,
  PARRILLERO_DIMS as D,
  PARRILLERO_MESADA_SOBRE_DECK,
  PARRILLERO_PRECIOS,
  PARRILLERO_TEXTOS,
  formatUYU,
  normalizeParrillero,
  parrilleroEnSuLugar,
  parrilleroLabel,
  parrilleroPrice,
  parrilleroSummaryLines,
} from "./parrillero";
import { allBoxes, parrilleroLayout } from "./parrilleroLayout";
import {
  deckWidthToSurround,
  facadeFrame,
  parrilleroDeckRelation,
  parrilleroNotices,
  parrilleroObstacle,
  parrilleroRects,
  toWorld,
  validateParrillero,
} from "./parrilleroGeometry";
import { TECHO_HOLGURA, cutBoxes, inflate, overlaps, roofOpeningDetail, subtractRect, type Rect } from "./deckCutout";
import { deckLayout, type DeckBox } from "./deckLayout";
import { deckPlacement } from "./deckGeometry";
import type { Point } from "./geometry";
import { OPENINGS_CATALOG } from "./openingsCatalog";

// Casa rectangular de 8 × 6 m; el frente de la entrada es el muro `edge-2` (z = 3) y mira hacia +z.
const RECT: Point[] = [
  { x: -4, z: -3 },
  { x: 4, z: -3 },
  { x: 4, z: 3 },
  { x: -4, z: 3 },
];
// Casa con un ala que sobresale hacia afuera a la derecha del frente.
const WING: Point[] = [
  { x: 8, z: 6 },
  { x: 4, z: 6 },
  { x: 4, z: 3 },
  { x: -4, z: 3 },
  { x: -4, z: -3 },
  { x: 8, z: -3 },
];
const T = 0.2;
const ext = (b: DeckBox) => ({
  x0: b.pos[0] - b.size[0] / 2,
  x1: b.pos[0] + b.size[0] / 2,
  y0: b.pos[1] - b.size[1] / 2,
  y1: b.pos[1] + b.size[1] / 2,
  z0: b.pos[2] - b.size[2] / 2,
  z1: b.pos[2] + b.size[2] / 2,
});
const rectOf = (b: DeckBox): Rect => {
  const e = ext(b);
  return { x0: e.x0, x1: e.x1, z0: e.z0, z1: e.z1 };
};
const closeRect = (a: Rect, b: Rect) => {
  for (const k of ["x0", "x1", "z0", "z1"] as const) expect(a[k]).toBeCloseTo(b[k], 9);
};
const flat = { roofed: false, railFront: false, railLeft: false, railRight: false, steps: false };

describe("parrillero: datos, precios y textos", () => {
  it("arranca apagado y normaliza cualquier entrada", () => {
    expect(DEFAULT_PARRILLERO.enabled).toBe(false);
    expect(normalizeParrillero(undefined)).toEqual(DEFAULT_PARRILLERO);
    expect(normalizeParrillero({ enabled: true, finish: "revoque", side: "derecho", sink: false })).toEqual({
      enabled: true,
      finish: "revoque",
      side: "derecho",
      sink: false,
      dx: 0,
      dz: 0,
      rot: 0,
    });
    // Valores raros de un link viejo o roto: vuelven a los de fábrica.
    expect(normalizeParrillero({ enabled: "si" as never, finish: "oro" as never, side: "arriba" as never })).toEqual(DEFAULT_PARRILLERO);
  });

  it("el lugar y el giro se normalizan: acotados, enteros y de 0 a 359 grados; un link viejo (sin ellos) queda en su lugar", () => {
    expect(normalizeParrillero({ dx: 99, dz: -99, rot: -90 })).toMatchObject({ dx: 30, dz: -30, rot: 270 });
    expect(normalizeParrillero({ rot: 450 }).rot).toBe(90);
    expect(normalizeParrillero({ rot: 12.4 }).rot).toBe(12);
    expect(normalizeParrillero({ dx: Number.NaN, dz: "x" as never, rot: Number.POSITIVE_INFINITY })).toMatchObject({ dx: 0, dz: 0, rot: 0 });
    expect(normalizeParrillero({ dx: 1.234 }).dx).toBe(1.23);
    expect(parrilleroEnSuLugar(DEFAULT_PARRILLERO)).toBe(true);
    expect(parrilleroEnSuLugar({ dx: 0.1, dz: 0, rot: 0 })).toBe(false);
    expect(parrilleroEnSuLugar({ dx: 0, dz: 0, rot: 90 })).toBe(false);
  });

  it("los precios son los pedidos: fijos, en pesos, con su referencia en dólares", () => {
    expect(PARRILLERO_PRECIOS.ladrillo).toEqual({ uyu: 108000, usd: 2665 });
    expect(PARRILLERO_PRECIOS.revoque).toEqual({ uyu: 122000, usd: 3010 });
    expect(parrilleroPrice({ ...DEFAULT_PARRILLERO, enabled: true, finish: "revoque" })).toEqual({ active: true, finish: "revoque", uyu: 122000, usd: 3010 });
    expect(parrilleroPrice(DEFAULT_PARRILLERO).active).toBe(false);
    expect(formatUYU(108000)).toBe("$U 108.000");
    expect(formatUYU(122000)).toBe("$U 122.000");
  });

  it("el precio no depende del lateral ni de la bacha: la terminación es lo único que lo cambia", () => {
    const base = { ...DEFAULT_PARRILLERO, enabled: true };
    for (const finish of ["ladrillo", "revoque"] as const) {
      const prices = (["izquierdo", "derecho"] as const).flatMap((side) => [true, false].map((sink) => parrilleroPrice({ ...base, finish, side, sink }).uyu));
      expect(new Set(prices).size).toBe(1);
    }
  });

  it("moverlo o girarlo no cambia el precio", () => {
    const base = { ...DEFAULT_PARRILLERO, enabled: true };
    const a = parrilleroPrice(base),
      b = parrilleroPrice({ ...base, dx: 2.5, dz: 1, rot: 135 });
    expect(b).toEqual(a);
  });

  it("el texto comercial y el resumen dicen lo pedido", () => {
    expect(PARRILLERO_TEXTOS.descripcion).toBe(
      "Un espacio pensado para disfrutar. Parrilleros de mampostería construidos con ladrillo, hogar refractario, chimenea y mesada auxiliar integrada.",
    );
    const lines = parrilleroSummaryLines({ enabled: true, finish: "ladrillo", side: "izquierdo", sink: true });
    expect(lines[0]).toBe("PARRILLERO SCH");
    expect(lines).toContain("Terminación: Ladrillo visto");
    expect(lines).toContain("Ubicación: Lateral izquierdo");
    expect(lines).toContain("Precio: $U 108.000 (ref. USD 2.665)");
    expect(parrilleroSummaryLines({ enabled: true, finish: "revoque", side: "derecho", sink: true })).toContain("Ubicación: Lateral derecho");
    expect(parrilleroLabel({ enabled: true, finish: "revoque", side: "derecho", sink: true })).toMatch("Revoque fino");
  });

  it("las medidas de diseño están en un solo lugar y suman 3,00 m", () => {
    expect(D.anchoTotal).toBe(3.0);
    expect(D.profundidad).toBe(0.9);
    expect(D.alturaMesada).toBe(0.9);
    expect(D.hogarAncho).toBe(1.2);
    expect(D.hogarProfundo).toBe(0.65);
    expect(D.bocaAlto).toBe(0.7);
    expect(D.mesadaLargo).toBe(1.35);
    expect(D.chimeneaAltura).toBe(2.6);
    expect(D.muro * 3 + D.mesadaLargo + D.hogarAncho).toBeCloseTo(D.anchoTotal, 9);
  });
});

describe("parrillero: geometría 3D (piezas)", () => {
  const L = parrilleroLayout("izquierdo", true);
  const boxes = allBoxes(L);

  it("mide 3,00 × 0,90 m en planta y la chimenea llega a 2,60 m sobre la mesada", () => {
    const zs = boxes.flatMap((b) => [ext(b).z0, ext(b).z1]);
    expect(Math.min(...zs)).toBeCloseTo(0, 6);
    // El remate vuela 4 cm más allá del cuerpo.
    expect(Math.max(...zs)).toBeCloseTo(3.0 + D.tapaVuelo, 6);
    const body = [...L.base.render, ...L.slab];
    expect(Math.max(...body.flatMap((b) => [ext(b).x1])) - Math.min(...body.flatMap((b) => [ext(b).x0]))).toBeCloseTo(0.9, 6);
    const top = Math.max(...L.cap.top.map((b) => ext(b).y1));
    expect(top - D.alturaMesada).toBeCloseTo(D.chimeneaAltura, 6);
  });

  it("la losa está a 0,90 m, la base nace bajo el terreno y llega justo hasta la losa", () => {
    for (const b of L.slab) expect(ext(b).y1).toBeCloseTo(0.9, 6);
    const baseTop = Math.max(...L.base.render.map((b) => ext(b).y1)),
      baseBottom = Math.min(...L.base.render.map((b) => ext(b).y0));
    expect(baseBottom).toBeLessThan(0);
    expect(baseTop).toBeCloseTo(0.9 - D.espesorLosa, 6);
    // Nada queda flotando: ninguna pieza empieza por debajo del terreno más allá de lo enterrado.
    for (const b of boxes) expect(ext(b).y0).toBeGreaterThanOrEqual(-D.enterrado - 1e-9);
  });

  it("el hogar mide 1,20 de ancho y 0,65 de fondo entre las caras refractarias, y la boca 0,70 de alto", () => {
    const [back, left, right] = L.refractory.map(ext);
    expect(right!.z0 - left!.z1).toBeCloseTo(D.hogarAncho, 6);
    // Fondo útil: de la cara del refractario del fondo hasta el plano de la boca (el frente de la losa).
    const front = Math.max(...L.slab.map((b) => ext(b).x1)),
      mouthFront = L.mouth === 1 ? front : -front;
    expect(Math.abs(mouthFront - (L.mouth === 1 ? back!.x1 : back!.x0))).toBeCloseTo(D.hogarProfundo, 6);
    expect(left!.y1 - D.alturaMesada - D.pisoHogar).toBeCloseTo(D.bocaAlto, 6);
  });

  it("la caída de la campana y la chimenea ocupan todo el ancho del parrillero (0,90 m), no una parte", () => {
    for (const side of ["izquierdo", "derecho"] as const) {
      const l = parrilleroLayout(side, true),
        prisms = [...l.walls.prisms, ...l.hood.prisms].sort((a, b) => a.x0 - b.x0);
      // El prisma del fondo y el de la campana se tocan y juntos cubren la profundidad entera.
      expect(prisms.length).toBe(2);
      expect(prisms[0]!.x1).toBeCloseTo(prisms[1]!.x0, 9);
      expect(prisms[0]!.x0).toBeCloseTo(-D.profundidad / 2, 9);
      expect(prisms[1]!.x1).toBeCloseTo(D.profundidad / 2, 9);
      // Los dos suben por la misma caída hasta la chimenea.
      for (const pr of prisms) expect(Math.max(...pr.pts.map((q) => q[1]))).toBeCloseTo(D.campanaAltoChimenea, 9);
      // El remate de la caída va de atrás hasta pasada la boca.
      const cop = l.hood.coping[0]!;
      expect(cop.x0).toBeLessThanOrEqual(-D.profundidad / 2 + 1e-9);
      expect(cop.x1).toBeGreaterThanOrEqual(D.profundidad / 2 - 1e-9);
      // El cuerpo de la chimenea y su tapa también van de atrás a la boca.
      const ch = ext(l.chimney[0]!);
      expect(ch.x0).toBeCloseTo(-D.profundidad / 2, 9);
      expect(ch.x1).toBeCloseTo(D.profundidad / 2, 9);
      expect(Math.min(...l.cap.top.map((b) => ext(b).x0))).toBeLessThanOrEqual(-D.profundidad / 2 + 1e-9);
      expect(Math.max(...l.cap.top.map((b) => ext(b).x1))).toBeGreaterThanOrEqual(D.profundidad / 2 - 1e-9);
      // Los respiraderos quedan en el centro de la chimenea.
      const vent = ext(l.cap.vents[0]!);
      expect((vent.x0 + vent.x1) / 2).toBeCloseTo(0, 9);
    }
  });

  it("el refractario es una pieza aparte del ladrillo exterior y la campana baja en diagonal", () => {
    expect(L.refractory.length).toBe(3);
    const hood = L.hood.prisms[0]!;
    // Hay un tramo inclinado: ni horizontal ni vertical.
    let diagonal = false;
    for (let i = 0; i < hood.pts.length; i++) {
      const a = hood.pts[i]!,
        b = hood.pts[(i + 1) % hood.pts.length]!;
      if (Math.abs(a[0] - b[0]) > 0.1 && Math.abs(a[1] - b[1]) > 0.1) diagonal = true;
    }
    expect(diagonal).toBe(true);
    expect(L.hood.coping.length).toBe(1);
  });

  it("la tapa de la chimenea es maciza (sin agujero arriba) y el humo sale por respiraderos en las cuatro caras, justo debajo de ella", () => {
    for (const side of ["izquierdo", "derecho"] as const) {
      const l = parrilleroLayout(side, true),
        tapa = l.cap.top,
        top = D.alturaMesada + D.chimeneaAltura,
        shaftTop = top - D.tapaEspesor,
        ventBottom = shaftTop - D.respiraderoAlto;
      // Tapa: una sola pieza maciza, que cubre todo el cuerpo (con su vuelo) y no tiene agujero.
      expect(tapa.length).toBe(1);
      const t = ext(tapa[0]!);
      expect(t.y0).toBeCloseTo(shaftTop, 9);
      expect(t.y1).toBeCloseTo(top, 9);
      // El cuerpo de la chimenea ocupa u de uChim a uTotal y la profundidad entera.
      const cuerpo = l.chimney.map(ext),
        u0 = Math.min(...cuerpo.map((e) => e.z0)),
        u1 = Math.max(...cuerpo.map((e) => e.z1)),
        x0 = Math.min(...cuerpo.map((e) => e.x0)),
        x1 = Math.max(...cuerpo.map((e) => e.x1));
      expect(u1 - u0).toBeCloseTo(D.chimeneaSeccion, 9);
      expect(t.z0).toBeLessThanOrEqual(u0 - D.tapaVuelo + 1e-9);
      expect(t.z1).toBeGreaterThanOrEqual(u1 + D.tapaVuelo - 1e-9);
      expect(t.x0).toBeLessThanOrEqual(x0 - D.tapaVuelo + 1e-9);
      expect(t.x1).toBeGreaterThanOrEqual(x1 + D.tapaVuelo - 1e-9);
      // Por encima de los respiraderos el cuerpo son solo los cuatro pilarcitos de las esquinas (sin pared entera).
      const alto = l.chimney.filter((b) => ext(b).y1 > ventBottom + 1e-9);
      expect(alto.length).toBe(4);
      for (const b of alto) {
        const e = ext(b);
        expect(e.y0).toBeCloseTo(ventBottom, 9);
        expect(e.y1).toBeCloseTo(shaftTop, 9);
        expect(e.z1 - e.z0).toBeCloseTo(D.respiraderoPilar, 9);
        expect(e.x1 - e.x0).toBeCloseTo(D.respiraderoPilar, 9);
      }
      // Debajo, el cuerpo es macizo.
      const bajo = l.chimney.filter((b) => ext(b).y1 <= ventBottom + 1e-9);
      expect(bajo.length).toBe(1);
      expect(ext(bajo[0]!).y1).toBeCloseTo(ventBottom, 9);
      // El hueco oscuro llena el interior entre los pilarcitos: se ve a través de las aberturas de las cuatro caras.
      expect(l.cap.vents.length).toBe(1);
      const v = ext(l.cap.vents[0]!);
      expect(v.y0).toBeCloseTo(ventBottom, 9);
      expect(v.y1).toBeCloseTo(shaftTop, 9);
      expect(v.z0).toBeCloseTo(u0 + D.respiraderoPilar, 9);
      expect(v.z1).toBeCloseTo(u1 - D.respiraderoPilar, 9);
      expect(v.x0).toBeCloseTo(x0 + D.respiraderoPilar, 9);
      expect(v.x1).toBeCloseTo(x1 - D.respiraderoPilar, 9);
      // Las aberturas de las cuatro caras existen: cada pared del cuerpo, a la altura de los respiraderos, queda abierta
      // entre los pilarcitos (ninguna caja del cuerpo cubre el tramo central de ninguna cara).
      const centroU = (u0 + u1) / 2,
        centroX = (x0 + x1) / 2,
        cubre = (px: number, pz: number) => l.chimney.some((b) => {
          const e = ext(b);
          return e.y0 < ventBottom + D.respiraderoAlto / 2 && e.y1 > ventBottom + D.respiraderoAlto / 2 && px > e.x0 - 1e-9 && px < e.x1 + 1e-9 && pz > e.z0 - 1e-9 && pz < e.z1 + 1e-9;
        });
      expect(cubre(centroX, u0 + 0.01)).toBe(false); // cara del lado de la casa/campana
      expect(cubre(centroX, u1 - 0.01)).toBe(false); // cara del extremo
      expect(cubre(x0 + 0.01, centroU)).toBe(false); // cara de atrás
      expect(cubre(x1 - 0.01, centroU)).toBe(false); // cara de la boca
      expect(cubre(x0 + 0.01, u0 + 0.01)).toBe(true); // las esquinas sí
    }
  });

  it("la mesada es continuación de la losa: la losa tiene la abertura de la bacha y la bacha entra justo", () => {
    expect(L.slab.length).toBe(4);
    expect(L.sink).toBeDefined();
    expect(L.faucet!.length).toBeGreaterThan(2);
    const noSink = parrilleroLayout("izquierdo", false);
    expect(noSink.sink).toBeNull();
    expect(noSink.faucet).toBeNull();
    expect(noSink.slab.length).toBe(1);
  });

  it("el lateral derecho es el espejo del izquierdo (mismas medidas, boca hacia el otro lado)", () => {
    const R = parrilleroLayout("derecho", true),
      a = allBoxes(L),
      b = allBoxes(R);
    expect(a.length).toBe(b.length);
    a.forEach((box, i) => {
      const o = b[i]!;
      expect(o.size).toEqual(box.size);
      expect(o.pos[0]).toBeCloseTo(-box.pos[0], 9);
      expect(o.pos[1]).toBeCloseTo(box.pos[1], 9);
      expect(o.pos[2]).toBeCloseTo(box.pos[2], 9);
    });
    expect(L.mouth).toBe(1);
    expect(R.mouth).toBe(-1);
  });

  it("la forma no depende de la terminación: es la misma función para ladrillo y revoque", () => {
    expect(parrilleroLayout.length <= 2).toBe(true);
    expect(JSON.stringify(parrilleroLayout("derecho", true))).toBe(JSON.stringify(parrilleroLayout("derecho", true)));
  });
});

describe("parrillero: ubicación", () => {
  const frame = facadeFrame(RECT, T)!;

  it("el frente es el muro de la entrada y mide lo que mide la fachada", () => {
    expect(frame.wallId).toBe("edge-2");
    // El frente se mide de esquina exterior a esquina exterior: 8 m de eje más el espesor del muro.
    expect(frame.length).toBeCloseTo(8 + T, 6);
    expect(frame.outward.z).toBeCloseTo(1, 6);
    expect(frame.right.x).toBeCloseTo(1, 6);
  });

  it("pegado a la casa: el fondo del parrillero sigue la línea del borde de la casa y el cuerpo va hacia el centro, con la boca hacia el centro", () => {
    const l = parrilleroRects("izquierdo", frame.length),
      r = parrilleroRects("derecho", frame.length);
    // Sin separación: la línea de atrás queda exactamente sobre el borde de la casa de su lado.
    expect(l.footprint.x0).toBeCloseTo(-frame.length / 2, 6);
    expect(l.footprint.x1).toBeCloseTo(-frame.length / 2 + 0.9, 6);
    expect(r.footprint.x1).toBeCloseTo(frame.length / 2, 6);
    expect(r.footprint.x0).toBeCloseTo(frame.length / 2 - 0.9, 6);
    // El extremo de la mesada apoya contra el muro de la fachada.
    expect(l.footprint.z0).toBeCloseTo(0, 6);
    expect(r.footprint.z0).toBeCloseTo(0, 6);
    expect(l.mouth).toBe(1);
    expect(r.mouth).toBe(-1);
    // En el mundo: el fondo cae sobre la línea de la esquina exterior de la casa (x = ±4,1) y sale hacia afuera (z > 3).
    const wl = toWorld(frame, l.footprint.x0, 1.5),
      wr = toWorld(frame, r.footprint.x1, 1.5);
    expect(wl.x).toBeCloseTo(-(4 + T / 2), 6);
    expect(wr.x).toBeCloseTo(4 + T / 2, 6);
    expect(wl.z).toBeGreaterThan(3);
    expect(wr.z).toBeGreaterThan(3);
  });

  it("la huella mide 3,00 × 0,90 y sale hacia afuera desde la fachada", () => {
    for (const side of ["izquierdo", "derecho"] as const) {
      const f = parrilleroRects(side, 8).footprint;
      expect(f.x1 - f.x0).toBeCloseTo(0.9, 6);
      expect(f.z1 - f.z0).toBeCloseTo(3.0, 6);
      expect(f.z0).toBeGreaterThanOrEqual(0);
    }
  });

  it("se adapta si cambia el tamaño de la casa y no depende del deck", () => {
    const wide = facadeFrame([{ x: -6, z: -3 }, { x: 6, z: -3 }, { x: 6, z: 3 }, { x: -6, z: 3 }], T)!;
    expect(wide.length).toBeCloseTo(12 + T, 6);
    expect(parrilleroRects("derecho", wide.length).footprint.x1).toBeCloseTo((12 + T) / 2, 6);
    // El obstáculo en el marco del deck solo corre por el desplazamiento del deck, nunca la posición real.
    const pl = deckPlacement(RECT, T, { width: 11, depth: 3 }, null)!;
    const o = parrilleroObstacle(frame, "derecho", pl);
    expect(o.footprint.x1).toBeCloseTo((8 + T) / 2, 6);
  });

  it("deckWidthToSurround: con el parrillero pegado a la casa alcanza el frente; si se lo corre más allá, el deck lo rodea con 30 cm", () => {
    expect(deckWidthToSurround(8)).toBeCloseTo(8, 6);
    expect(deckWidthToSurround(8.2, "izquierdo")).toBeCloseTo(8.2, 6);
    // Corrido 1 m hacia afuera de la esquina derecha: llega hasta x = 5 y el deck, centrado, lo rodea con 30 cm de madera.
    expect(deckWidthToSurround(8, "derecho", { dx: 1, dz: 0, rot: 0 })).toBeCloseTo(2 * (5 + 0.3), 6);
    expect(deckWidthToSurround(8, "izquierdo", { dx: -1, dz: 0, rot: 0 })).toBeCloseTo(2 * (5 + 0.3), 6);
  });
});

describe("parrillero: mover y girar", () => {
  const frame = facadeFrame(RECT, T)!;
  const base = parrilleroRects("izquierdo", frame.length);

  it("sin mover ni girar es el lugar donde nace; dx y dz lo corren tal cual en el marco de la fachada", () => {
    expect(base.angle).toBe(0);
    expect(base.center.x).toBeCloseTo(-frame.length / 2 + 0.45, 9);
    expect(base.center.z).toBeCloseTo(1.5, 9);
    const m = parrilleroRects("izquierdo", frame.length, { dx: 1.2, dz: 0.7, rot: 0 });
    expect(m.footprint.x0).toBeCloseTo(base.footprint.x0 + 1.2, 9);
    expect(m.footprint.x1).toBeCloseTo(base.footprint.x1 + 1.2, 9);
    expect(m.footprint.z0).toBeCloseTo(base.footprint.z0 + 0.7, 9);
    expect(m.footprint.z1).toBeCloseTo(base.footprint.z1 + 0.7, 9);
    expect(m.center.x).toBeCloseTo(base.center.x + 1.2, 9);
  });

  it("un giro recto intercambia el ancho y el largo alrededor del centro de su huella", () => {
    const r90 = parrilleroRects("izquierdo", frame.length, { dx: 0, dz: 0, rot: 90 });
    expect(r90.footprint.x1 - r90.footprint.x0).toBeCloseTo(3.0, 9);
    expect(r90.footprint.z1 - r90.footprint.z0).toBeCloseTo(0.9, 9);
    expect(r90.center).toEqual(base.center);
    expect(r90.angle).toBeCloseTo(Math.PI / 2, 9);
    const r180 = parrilleroRects("izquierdo", frame.length, { dx: 0, dz: 0, rot: 180 });
    closeRect(r180.footprint, base.footprint);
    const r270 = parrilleroRects("izquierdo", frame.length, { dx: 0, dz: 0, rot: 270 });
    expect(r270.footprint.x1 - r270.footprint.x0).toBeCloseTo(3.0, 9);
    expect(r270.footprint.z1 - r270.footprint.z0).toBeCloseTo(0.9, 9);
    // Cuatro giros de 90° dejan todo como estaba.
    const r360 = parrilleroRects("izquierdo", frame.length, { dx: 0, dz: 0, rot: 360 });
    closeRect(r360.footprint, base.footprint);
  });

  it("un giro libre (45°) da las esquinas exactas y el rectángulo que las contiene", () => {
    const r = parrilleroRects("derecho", frame.length, { dx: 0, dz: 0, rot: 45 });
    expect(r.corners.length).toBe(4);
    const lado = (3.0 + 0.9) / Math.SQRT2;
    expect(r.footprint.x1 - r.footprint.x0).toBeCloseTo(lado, 6);
    expect(r.footprint.z1 - r.footprint.z0).toBeCloseTo(lado, 6);
    // Los lados de las esquinas siguen midiendo 0,90 y 3,00.
    const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
    expect(dist(r.corners[0]!, r.corners[1]!)).toBeCloseTo(0.9, 6);
    expect(dist(r.corners[1]!, r.corners[2]!)).toBeCloseTo(3.0, 6);
  });

  it("el deck ve el obstáculo movido y girado", () => {
    const pl = deckPlacement(RECT, T, { width: 11, depth: 3 }, null)!;
    const pose = { dx: -1, dz: 0.5, rot: 90 };
    const rects = parrilleroRects("derecho", frame.length, pose),
      o = parrilleroObstacle(frame, "derecho", pl, 0, pose);
    expect(o.footprint).toEqual(rects.footprint);
    expect(o.chimney).toEqual(rects.chimney);
    expect(o.hood).toEqual(rects.hood);
  });
});

describe("parrillero: el deck se recorta alrededor del parrillero", () => {
  const frame = facadeFrame(RECT, T)!;
  const W = deckWidthToSurround(frame.length);
  const pl = deckPlacement(RECT, T, { width: W, depth: 3 }, null)!;
  const obstacle = parrilleroObstacle(frame, "derecho", pl);
  // Corrido 1 m hacia adentro del deck: el hueco queda en el medio, con madera a los dos lados.
  const inner = parrilleroObstacle(frame, "derecho", pl, 0, { dx: -1, dz: 0, rot: 0 });
  const deck = { width: W, depth: 3, ...flat };
  const hole = inflate(inner.footprint, 0.03);
  const area = (bs: DeckBox[]) => bs.reduce((sum, b) => sum + b.size[0] * b.size[2], 0);

  it("sin parrillero el deck es el original; el hueco aparece solo cuando hay parrillero", () => {
    const original = deckLayout(deck, 0.5),
      again = deckLayout(deck, 0.5, null, null);
    expect(again.cutout).toBeNull();
    expect(again.boards.length).toBe(original.boards.length);
    expect(JSON.stringify(again)).toBe(JSON.stringify(original));
    // Pegado a la casa (en la esquina del deck) o corrido hacia adentro: en los dos casos hay hueco y menos madera.
    for (const o of [obstacle, inner]) {
      const cut = deckLayout(deck, 0.5, null, o);
      expect(cut.cutout).not.toBeNull();
      expect(area(cut.boards)).toBeLessThan(area(original.boards) - 0.5);
    }
  });

  it("ninguna tabla, tirante, pilote, baranda ni tornillo pisa la huella del parrillero", () => {
    for (const o of [obstacle, inner]) {
      const L = deckLayout({ ...deck, railFront: true, railLeft: true, railRight: true, steps: true }, 0.5, null, o);
      const strict = inflate(o.footprint, 0.03 - 1e-6);
      for (const list of [L.boards, L.piles, L.steps, L.rails, L.fascia]) for (const b of list) expect(overlaps(rectOf(b), strict)).toBe(false);
      // Los tirantes del cerco quedan pegados al hueco, sin pisarlo.
      for (const b of L.frame) expect(overlaps(rectOf(b), strict)).toBe(false);
      for (const b of L.screws) expect(b.pos[0] > strict.x0 && b.pos[0] < strict.x1 && b.pos[2] > strict.z0 && b.pos[2] < strict.z1).toBe(false);
    }
  });

  it("la madera llega hasta el borde del hueco (holgura de 3 cm) y el resto del deck queda entero", () => {
    const L = deckLayout(deck, 0.5, null, inner),
      near = L.boards.filter((b) => ext(b).z1 > inner.footprint.z0 && ext(b).z0 < inner.footprint.z1);
    // Hay tablas que terminan justo en el hueco, en los dos costados.
    expect(near.some((b) => Math.abs(ext(b).x1 - hole.x0) < 1e-6)).toBe(true);
    expect(near.some((b) => Math.abs(ext(b).x0 - hole.x1) < 1e-6)).toBe(true);
    // Todas las tablas siguen a la altura de siempre: el deck no se levanta ni se baja.
    for (const b of L.boards) expect(ext(b).y1).toBeCloseTo(0.5, 6);
  });

  it("un deck que no llega al parrillero no se toca", () => {
    // Un deck de 6 m (de x = -3 a 3) no llega al parrillero pegado a la esquina derecha (de x = 3,2 a 4,1).
    const short = { width: 6, depth: 3, ...flat },
      pl2 = deckPlacement(RECT, T, { width: 6, depth: 3 }, null)!,
      o = parrilleroObstacle(frame, "derecho", pl2),
      a = deckLayout(short, 0.5),
      b = deckLayout(short, 0.5, null, o);
    expect(b.cutout).toBeNull();
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    const rel = parrilleroDeckRelation({ frame, side: "derecho", deck: { enabled: true, roofed: false, width: 6, depth: 3 }, deckPl: pl2, topY: 0.5 });
    expect(rel.deckCuts).toBe(false);
    expect(rel.deckShort).toBe(true);
  });

  it("subtractRect parte una tabla en dos costados y descarta lo que queda cubierto", () => {
    const board: DeckBox = { size: [6, 0.03, 0.14], pos: [0, 0.4, 1] };
    const pieces = subtractRect(board, { x0: -1, x1: 1, z0: 0.5, z1: 1.5 });
    expect(pieces.length).toBe(2);
    expect(cutBoxes([board], [{ x0: -10, x1: 10, z0: 0, z1: 2 }]).length).toBe(0);
    expect(subtractRect(board, { x0: 20, x1: 21, z0: 0, z1: 2 })[0]).toBe(board);
  });
});

describe("parrillero: el techo del deck se abre para la chimenea", () => {
  const frame = facadeFrame(RECT, T)!;
  const W = deckWidthToSurround(frame.length);
  const pl = deckPlacement(RECT, T, { width: W, depth: 3 }, null)!;
  const edge = parrilleroObstacle(frame, "derecho", pl);
  // Corrido 1 m hacia adentro: la chimenea queda en el medio del techo.
  const obstacle = parrilleroObstacle(frame, "derecho", pl, 0, { dx: -1, dz: 0, rot: 0 });
  const deck = { width: W, depth: 3, ...flat, roofed: true };

  it("el techo se abre solo en la chimenea y el resto conserva sus piezas", () => {
    const original = deckLayout(deck, 0.5),
      L = deckLayout(deck, 0.5, null, obstacle),
      roof = L.roof!;
    expect(roof.opening).toBeDefined();
    expect(roof.opening).not.toBeNull();
    const o = roof.opening!,
      chim = obstacle.chimney;
    // La abertura cubre la chimenea con una holgura razonable, sin agrandarse de más.
    expect(o.x0).toBeLessThan(chim.x0);
    expect(o.x1).toBeGreaterThan(chim.x1);
    expect(o.x1 - o.x0).toBeLessThan(chim.x1 - chim.x0 + 0.6);
    // El techo sigue ahí: casi todas las piezas y todo el ancho de la chapa.
    expect(roof.planeBoxes.length).toBeGreaterThan(original.roof!.planeBoxes.length * 0.8);
    const sheetWidth = roof.sheetPieces.reduce((s, p) => s + p.width * (p.z1 - p.z0), 0),
      sheetOrig = original.roof!.sheetPieces.reduce((s, p) => s + p.width * (p.z1 - p.z0), 0);
    expect(sheetWidth).toBeLessThan(sheetOrig);
    expect(sheetWidth).toBeGreaterThan(sheetOrig * 0.9);
    expect(original.roof!.opening).toBeNull();
    expect(original.roof!.sheetPieces.length).toBe(1);
  });

  it("el hueco del techo tiene el tamaño de la chimenea (más una holgura de 5 cm) y todo el resto es techo", () => {
    for (const o of [obstacle, edge]) {
      const L = deckLayout(deck, 0.79, null, o),
        op = L.roof!.opening!,
        chimW = o.chimney.x1 - o.chimney.x0,
        chimD = o.chimney.z1 - o.chimney.z0;
      expect(op).not.toBeNull();
      expect(op.x1 - op.x0).toBeLessThanOrEqual(chimW + 2 * TECHO_HOLGURA + 1e-6);
      expect(op.z1 - op.z0).toBeLessThanOrEqual(chimD + 2 * TECHO_HOLGURA + 1e-6);
      // Toda la abertura es la de la chimenea: no se agrega la campana (lo hace solo si el techo quedara más bajo que ella).
      expect(op.z1 - op.z0).toBeLessThan(D.chimeneaSeccion + 0.11);
    }
    const rel = parrilleroDeckRelation({ frame, side: "derecho", deck: { enabled: true, roofed: true, width: W, depth: 3 }, deckPl: pl, topY: 0.79 });
    expect(rel.roofOpens).toBe(true);
    expect(rel.roofOpensForHood).toBe(false);
  });

  it("roofOpeningDetail suma la campana solo si el techo pasaría por ella", () => {
    const bounds: Rect = { x0: -6, x1: 6, z0: 0, z1: 4 };
    const alto = roofOpeningDetail(obstacle, bounds, () => 2.7);
    expect(alto.byHood).toBe(false);
    expect(alto.rect).not.toBeNull();
    const bajo = roofOpeningDetail(obstacle, bounds, () => 2.4);
    expect(bajo.byHood).toBe(true);
    const a = alto.rect!,
      b = bajo.rect!;
    expect((b.x1 - b.x0) * (b.z1 - b.z0)).toBeGreaterThan((a.x1 - a.x0) * (a.z1 - a.z0));
    // Si el techo pasa por encima de la chimenea, no hay nada que abrir.
    expect(roofOpeningDetail(obstacle, bounds, () => 4.2).rect).toBeNull();
  });

  it("ni la chapa ni los tirantes ni los postes atraviesan la chimenea", () => {
    const L = deckLayout(deck, 0.5, null, obstacle),
      roof = L.roof!,
      cos = Math.cos(roof.plane.angle),
      zFront = roof.plane.origin[2],
      o = roof.opening!,
      po: Rect = { x0: o.x0, x1: o.x1, z0: (o.z0 - zFront) / cos, z1: (o.z1 - zFront) / cos },
      inner = { x0: po.x0 + 1e-6, x1: po.x1 - 1e-6, z0: po.z0 + 1e-6, z1: po.z1 - 1e-6 };
    for (const b of roof.planeBoxes) expect(overlaps(rectOf(b), inner)).toBe(false);
    for (const p of roof.sheetPieces) expect(overlaps({ x0: p.x - p.width / 2, x1: p.x + p.width / 2, z0: p.z0, z1: p.z1 }, inner)).toBe(false);
    // Los postes no quedan dentro de la mampostería.
    const solid = inflate(obstacle.footprint, 0.05);
    for (const p of roof.posts) expect(overlaps(rectOf(p), solid)).toBe(false);
  });

  it("sin deck techado no hay techo que abrir, y con el parrillero lejos el techo queda entero", () => {
    expect(deckLayout({ ...deck, roofed: false }, 0.5, null, obstacle).roof).toBeNull();
    const far = { ...obstacle, footprint: { x0: 40, x1: 41, z0: 0, z1: 3 }, chimney: { x0: 40, x1: 41, z0: 2.4, z1: 3 }, hood: { x0: 40, x1: 41, z0: 1.5, z1: 3 } };
    const a = deckLayout(deck, 0.5),
      b = deckLayout(deck, 0.5, null, far);
    expect(b.roof!.opening).toBeNull();
    expect(JSON.stringify(b.roof)).toBe(JSON.stringify(a.roof));
  });

  it("las combinaciones parrillero × deck × techado dan lo esperado", () => {
    const rel = (enabled: boolean, roofed: boolean) =>
      parrilleroDeckRelation({ frame, side: "derecho", deck: { enabled, roofed, width: W, depth: 3 }, deckPl: pl, topY: 0.5 });
    // Sí / No / No: el parrillero queda solo sobre el terreno.
    expect(rel(false, false)).toEqual({ deckCuts: false, roofOpens: false, roofOpensForHood: false, deckShort: false, lift: 0, flush: false });
    // Sí / Sí / No: el deck se recorta.
    expect(rel(true, false)).toMatchObject({ deckCuts: true, roofOpens: false, deckShort: false });
    // Sí / Sí / Sí: el deck se recorta y el techo se adapta.
    expect(rel(true, true)).toMatchObject({ deckCuts: true, roofOpens: true, roofOpensForHood: false, deckShort: false });
  });
});

describe("parrillero: validación de espacio", () => {
  const ok = (contour: Point[], side: "izquierdo" | "derecho", extra = {}) => validateParrillero({ contour, wallThickness: T, openings: [], side, ...extra });

  it("en una casa rectangular entra en los dos laterales", () => {
    expect(ok(RECT, "izquierdo").ok).toBe(true);
    expect(ok(RECT, "derecho").ok).toBe(true);
  });

  it("pegado a la casa es lo normal; avisa, sin tocar nada, si lo corrés y atraviesa la casa", () => {
    // Apoyar contra un muro (el de la fachada, o el del ala) no es chocar.
    expect(ok(WING, "derecho").ok).toBe(true);
    expect(ok(WING, "izquierdo").ok).toBe(true);
    const r = ok(WING, "derecho", { pose: { dx: 0.5, dz: 0, rot: 0 } });
    expect(r.ok).toBe(false);
    expect(r.issues[0]!.code).toBe("casa");
    expect(r.issues[0]!.message).toMatch("atraviesa la casa");
    // Metido hacia adentro de la casa.
    expect(ok(RECT, "izquierdo", { pose: { dx: 0, dz: -1.5, rot: 0 } }).issues[0]!.code).toBe("casa");
    // Girado 90° y apoyado en la fachada: sigue siendo válido.
    expect(ok(RECT, "izquierdo", { pose: { dx: 0, dz: 0, rot: 90 } }).ok).toBe(true);
  });

  it("avisa si tapa una ventana o una puerta de la fachada", () => {
    const keys = Object.keys(OPENINGS_CATALOG) as (keyof typeof OPENINGS_CATALOG)[];
    const type = keys.find((k) => !OPENINGS_CATALOG[k].door) ?? keys[0]!;
    // Una abertura cerca de cada esquina de la fachada (el sentido del muro decide cuál es cuál).
    const blocked = (side: "izquierdo" | "derecho", offset: number) =>
      !ok(RECT, side, { openings: [{ floor: 0, wall: "edge-2", offset, type }] }).ok;
    const izq = [3.6, -3.6].map((o) => blocked("izquierdo", o)),
      der = [3.6, -3.6].map((o) => blocked("derecho", o));
    expect(izq.filter(Boolean).length).toBe(1);
    expect(der.filter(Boolean).length).toBe(1);
    expect(izq[0]).not.toBe(der[0]);
    // Una abertura en el medio de la fachada no estorba.
    expect(ok(RECT, "izquierdo", { openings: [{ floor: 0, wall: "edge-2", offset: 0, type }] }).ok).toBe(true);
  });

  it("avisa si queda fuera del terreno", () => {
    const r = ok(RECT, "derecho", { place: { position: { x: 39, z: 0 }, rotation: 0 } });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "terreno")).toBe(true);
    expect(ok(RECT, "derecho", { place: { position: { x: 0, z: 0 }, rotation: 0 } }).ok).toBe(true);
  });

  it("los avisos juntan el choque, el deck recortado y el techo adaptado, en ese orden", () => {
    const status = ok(RECT, "derecho"),
      rel = { deckCuts: true, roofOpens: true, roofOpensForHood: false, deckShort: false, lift: 0, flush: false };
    const notices = parrilleroNotices(status, rel);
    expect(notices.map((n) => n.level)).toEqual(["info", "info"]);
    expect(notices[1]!.text).toBe(PARRILLERO_TEXTOS.techoAdaptado);
    const choca = ok(RECT, "izquierdo", { pose: { dx: 0, dz: -1.5, rot: 0 } });
    expect(parrilleroNotices(choca, { ...rel, deckCuts: false, roofOpens: false, deckShort: true })[0]!.level).toBe("error");
    // Si el techo quedara más bajo que la campana, el aviso lo dice.
    expect(parrilleroNotices(status, { ...rel, roofOpensForHood: true }).map((n) => n.text)).toContain(PARRILLERO_TEXTOS.techoBajo);
    // Un giro que no es recto avisa que el hueco del deck es el rectángulo que lo contiene; uno recto, no.
    const pose = (rot: number) => ({ dx: 0, dz: 0, rot });
    expect(parrilleroNotices(status, rel, pose(45)).map((n) => n.text)).toContain(PARRILLERO_TEXTOS.giroLibre);
    expect(parrilleroNotices(status, rel, pose(90)).map((n) => n.text)).not.toContain(PARRILLERO_TEXTOS.giroLibre);
  });
});

describe("parrillero: con un deck alrededor, la base sube y la mesada queda a 0,90 m sobre el deck", () => {
  const frame = facadeFrame(RECT, T)!;
  const W = deckWidthToSurround(frame.length);
  const pl = deckPlacement(RECT, T, { width: W, depth: 4 }, null)!;
  const relation = (topY: number, width = W, enabled = true) =>
    parrilleroDeckRelation({ frame, side: "izquierdo", deck: { enabled, roofed: true, width, depth: 4 }, deckPl: pl, topY });
  const topOf = (boxes: DeckBox[]) => Math.max(...boxes.map((b) => b.pos[1] + b.size[1] / 2));
  const bottomOf = (boxes: DeckBox[]) => Math.min(...boxes.map((b) => b.pos[1] - b.size[1] / 2));

  it("el parrillero sin deck nace del terreno; con el deck que lo rodea, la base sube a la altura del deck", () => {
    expect(PARRILLERO_MESADA_SOBRE_DECK).toBe(true);
    expect(relation(0.79).lift).toBe(0.79);
    expect(relation(0.79, W, false).lift).toBe(0);
    // Un deck que no llega al parrillero no lo sube: sigue parado sobre el terreno.
    expect(relation(0.79, 6).lift).toBe(0);
    expect(relation(0.79, 6).deckShort).toBe(true);
  });

  it("la base se alarga hacia arriba, todo lo demás se desplaza y la huella no cambia", () => {
    const a = parrilleroLayout("izquierdo", true),
      b = parrilleroLayout("izquierdo", true, 0.79);
    // Sigue naciendo bajo el terreno.
    expect(bottomOf(b.base.render)).toBeCloseTo(bottomOf(a.base.render), 6);
    expect(topOf(b.base.render)).toBeCloseTo(topOf(a.base.render) + 0.79, 6);
    // La losa (cara de la mesada) queda a 0,90 m sobre el deck: 0,79 + 0,90.
    expect(topOf(b.slab)).toBeCloseTo(D.alturaMesada + 0.79, 6);
    expect(topOf(b.cap.top)).toBeCloseTo(D.alturaMesada + D.chimeneaAltura + 0.79, 6);
    expect(Math.max(...b.hood.prisms[0]!.pts.map((p) => p[1]))).toBeCloseTo(D.campanaAltoChimenea + 0.79, 6);
    expect(b.faucet![0]!.pos[1]).toBeCloseTo(a.faucet![0]!.pos[1] + 0.79, 6);
    // Misma planta: ninguna pieza se corre en x ni en z.
    // (El piso de hormigón de los nichos es nuevo con el deck: se mide aparte, en otra prueba.)
    const sinPiso = (l: typeof a): typeof a => ({ ...l, base: { ...l.base, floor: [] } });
    const planta = (l: typeof a) => allBoxes(sinPiso(l)).map((x) => [x.pos[0], x.pos[2], x.size[0], x.size[2]]);
    expect(planta(b)).toEqual(planta(a));
    // Sin elevación es exactamente el layout de siempre.
    expect(parrilleroLayout("izquierdo", true, 0)).toEqual(a);
    expect(parrilleroLayout("derecho", false, 0)).toEqual(parrilleroLayout("derecho", false));
  });

  it("con deck hay una losa de hormigón al nivel del piso del deck dentro de los dos nichos; sin deck no hay nada", () => {
    const sin = parrilleroLayout("izquierdo", true),
      con = parrilleroLayout("izquierdo", true, 0.79);
    expect(sin.base.floor).toEqual([]);
    expect(parrilleroLayout("derecho", false, 0).base.floor).toEqual([]);
    expect(con.base.floor.length).toBe(2);
    const m = D.muro,
      uMesadaEnd = m + D.mesadaLargo,
      uHogarA = uMesadaEnd + m;
    const [bajoMesada, bajoHogar] = con.base.floor.map(ext) as [ReturnType<typeof ext>, ReturnType<typeof ext>];
    for (const e of [bajoMesada, bajoHogar]) {
      // Cara superior exactamente a la altura del piso del deck, espesor de la losa, del muro de atrás a la boca.
      expect(e.y1).toBeCloseTo(0.79, 9);
      expect(e.y1 - e.y0).toBeCloseTo(D.pisoNichoEspesor, 9);
      expect(e.x1 - e.x0).toBeCloseTo(D.profundidad - D.muro, 9);
      expect(e.x0).toBeGreaterThanOrEqual(-D.profundidad / 2 - 1e-9);
      expect(e.x1).toBeLessThanOrEqual(D.profundidad / 2 + 1e-9);
    }
    // Un nicho bajo la mesada y otro bajo el hogar, entre los pilares.
    expect(bajoMesada.z0).toBeCloseTo(m, 9);
    expect(bajoMesada.z1).toBeCloseTo(uMesadaEnd, 9);
    expect(bajoHogar.z0).toBeCloseTo(uHogarA, 9);
    expect(bajoHogar.z1).toBeCloseTo(D.anchoTotal - m, 9);
    // No sale de la huella del parrillero.
    for (const e of [bajoMesada, bajoHogar]) {
      expect(e.z0).toBeGreaterThanOrEqual(-1e-9);
      expect(e.z1).toBeLessThanOrEqual(D.anchoTotal + 1e-9);
    }
    // Con otro deck (más alto o más bajo) la losa acompaña su altura.
    expect(ext(parrilleroLayout("derecho", true, 0.5).base.floor[0]!).y1).toBeCloseTo(0.5, 9);
  });

  it("la base no tiene una pieza oscura aparte en los nichos: son la misma base (misma textura)", () => {
    const l = parrilleroLayout("izquierdo", true, 0.79) as unknown as { base: Record<string, unknown> };
    expect(Object.keys(l.base).sort()).toEqual(["floor", "render"]);
  });

  it("la chimenea y la campana que ve el techo suben lo mismo", () => {
    const o0 = parrilleroObstacle(frame, "izquierdo", pl),
      o1 = parrilleroObstacle(frame, "izquierdo", pl, 0.79);
    expect(o1.chimneyTop).toBeCloseTo(o0.chimneyTop + 0.79, 6);
    expect(o1.hoodTop).toBeCloseTo(o0.hoodTop + 0.79, 6);
    expect(o1.footprint).toEqual(o0.footprint);
    // El techo se sigue abriendo para la chimenea.
    expect(relation(0.79).roofOpens).toBe(true);
  });

  it("avisa cuánto sube la base y no avisa nada si no sube", () => {
    const n = parrilleroNotices({ ok: true, issues: [], corners: [] }, relation(0.79)).map((x) => x.text);
    expect(n).toContain(PARRILLERO_TEXTOS.baseElevada(79));
    expect(n.join(" ")).toContain("79 cm");
    expect(n.join(" ")).toContain("0,90 m sobre el deck");
    const sin = parrilleroNotices({ ok: true, issues: [], corners: [] }, relation(0.79, 6)).map((x) => x.text);
    expect(sin.some((t) => t.includes("sube"))).toBe(false);
  });
});
