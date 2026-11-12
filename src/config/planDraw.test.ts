import { describe, expect, it } from "vitest";
import {
  EMPTY_PLAN,
  addOpening,
  addRectangle,
  addWall,
  analyzePlan,
  catalogType,
  hitWall,
  moveVertex,
  moveWall,
  parsePlan,
  removeWall,
  serializePlan,
  setLabel,
  setWallLength,
  snapPoint,
  type PlanDoc,
} from "./planDraw";

let n = 0;
const id = (p: string) => `${p}${++n}`;
const P = (x: number, z: number) => ({ x, z });
const rect = (w: number, d: number, x = 0, z = 0): PlanDoc => addRectangle(EMPTY_PLAN, P(x, z), P(x + w, z + d), id).doc;
const lengths = (doc: PlanDoc) => doc.walls.map((w) => Math.hypot(w.a.x - w.b.x, w.a.z - w.b.z));

describe("plano: paredes y contorno", () => {
  it("un rectángulo de 6 × 8 m da el contorno, 48 m² y un ambiente", () => {
    const a = analyzePlan(rect(6, 8));
    expect(a.contour).toHaveLength(4);
    expect(a.area).toBeCloseTo(48, 6);
    expect(a.issues).toHaveLength(0);
    expect(a.exterior.map((s) => s.id)).toEqual(["edge-0", "edge-1", "edge-2", "edge-3"]);
    expect(a.rooms).toHaveLength(1);
    expect(a.rooms[0]!.room.area).toBeCloseTo(48, 6);
  });

  it("el contorno sale en el mismo sentido que el diseñador 3D: edge-0 arriba, edge-2 abajo (frente)", () => {
    const a = analyzePlan(rect(6, 8, 3, 2));
    const [e0, , e2] = a.exterior;
    expect(e0!.a).toEqual(P(3, 2));
    expect(e0!.b).toEqual(P(9, 2));
    expect(e2!.a.z).toBeCloseTo(10, 6);
    expect(e2!.b.x).toBeLessThan(e2!.a.x);
  });

  it("no depende del orden ni del sentido en que se dibujaron las paredes", () => {
    const doc: PlanDoc = {
      walls: [
        { id: "a", a: P(0, 5), b: P(0, 0) },
        { id: "b", a: P(4, 5), b: P(0, 5) },
        { id: "c", a: P(4, 0), b: P(4, 5) },
        { id: "d", a: P(0, 0), b: P(4, 0) },
      ],
      openings: [],
      labels: [],
    };
    const a = analyzePlan(doc);
    expect(a.contour).toHaveLength(4);
    expect(a.area).toBeCloseTo(20, 6);
    expect(a.contour![0]).toEqual(P(0, 0));
    expect(a.contour![1]).toEqual(P(4, 0));
  });

  it("sin forma cerrada avisa y no inventa contorno", () => {
    const open = addWall(addWall(EMPTY_PLAN, P(0, 0), P(4, 0), id).doc, P(4, 0), P(4, 3), id).doc;
    const a = analyzePlan(open);
    expect(a.contour).toBeNull();
    expect(a.issues[0]).toMatch(/cerrada/);
    expect(analyzePlan(EMPTY_PLAN).contour).toBeNull();
  });

  it("un tabique que corta el rectángulo es pared interior y parte la casa en dos ambientes", () => {
    const doc = addWall(rect(6, 8), P(0, 4), P(6, 4), id).doc;
    const a = analyzePlan(doc);
    expect(a.contour).toHaveLength(4);
    expect(a.interior).toHaveLength(1);
    expect(a.interior[0]!.length).toBeCloseTo(6, 6);
    expect(a.rooms).toHaveLength(2);
    expect(a.rooms.map((r) => r.room.area).sort()).toEqual([24, 24]);
  });

  it("un tabique que cruza varias paredes interiores queda como una sola pared larga", () => {
    let doc = rect(8, 6);
    doc = addWall(doc, P(0, 3), P(4, 3), id).doc;
    doc = addWall(doc, P(4, 3), P(8, 3), id).doc;
    doc = addWall(doc, P(2, 3), P(2, 6), id).doc;
    const a = analyzePlan(doc);
    expect(a.interior.filter((s) => Math.abs(s.a.z - s.b.z) < 1e-9)).toHaveLength(1);
    expect(a.interior.find((s) => Math.abs(s.a.z - s.b.z) < 1e-9)!.length).toBeCloseTo(8, 6);
  });

  it("dos habitaciones pegadas comparten la pared del medio (no se duplica)", () => {
    const doc = addRectangle(rect(4, 5), P(4, 0), P(9, 5), id).doc;
    expect(doc.walls.length).toBe(7);
    const a = analyzePlan(doc);
    expect(a.contour).toHaveLength(4);
    expect(a.area).toBeCloseTo(45, 6);
    expect(a.rooms).toHaveLength(2);
    expect(a.interior).toHaveLength(1);
  });

  it("una forma en L tiene seis vértices y su superficie real", () => {
    let doc = addRectangle(EMPTY_PLAN, P(0, 0), P(8, 4), id).doc;
    doc = addRectangle(doc, P(0, 4), P(4, 8), id).doc;
    const a = analyzePlan(doc);
    expect(a.contour).toHaveLength(6);
    expect(a.area).toBeCloseTo(48, 6);
    expect(a.interior).toHaveLength(1);
  });

  it("las paredes sueltas hacia afuera se avisan y no entran al contorno", () => {
    const doc = addWall(rect(6, 8), P(6, 4), P(9, 4), id).doc;
    const a = analyzePlan(doc);
    expect(a.contour).toHaveLength(4);
    expect(a.area).toBeCloseTo(48, 6);
    expect(a.stray).toHaveLength(1);
    expect(a.warnings.join(" ")).toMatch(/suelta/);
    expect(a.pieces.filter((p) => p.kind === "stray")).toHaveLength(1);
  });

  it("una pared que termina a mitad de camino dentro de la casa es un tabique válido", () => {
    const a = analyzePlan(addWall(rect(6, 8), P(0, 4), P(3, 4), id).doc);
    expect(a.interior).toHaveLength(1);
    expect(a.stray).toHaveLength(0);
    expect(a.rooms).toHaveLength(1);
  });

  it("con dos construcciones separadas, toma la más grande y avisa de la otra", () => {
    const doc = addRectangle(rect(8, 8), P(20, 0), P(23, 3), id).doc;
    const a = analyzePlan(doc);
    expect(a.area).toBeCloseTo(64, 6);
    expect(a.stray.length).toBe(4);
  });

  it("valida el tamaño igual que el diseñador 3D: menos de 10 m² o lados de menos de 1,5 m", () => {
    expect(analyzePlan(rect(3, 3)).issues.join(" ")).toMatch(/entre 10 y 500/);
    expect(analyzePlan(rect(1, 12)).issues.join(" ")).toMatch(/1,5 m/);
    expect(analyzePlan(rect(30, 20)).issues.join(" ")).toMatch(/500/);
    expect(analyzePlan(rect(20, 20)).issues).toHaveLength(0);
  });

  it("dos ambientes que se tocan en un solo punto no forman un borde continuo", () => {
    const doc = addRectangle(rect(4, 4), P(4, 4), P(8, 8), id).doc;
    const a = analyzePlan(doc);
    expect(a.contour).toBeNull();
    expect(a.issues[0]).toMatch(/un punto|borde continuo/);
  });
});

describe("plano: edición", () => {
  it("agregar una pared sobre otra ya dibujada no la duplica", () => {
    const doc = rect(6, 8);
    const again = addWall(doc, P(0, 0), P(6, 0), id);
    expect(again.ids).toHaveLength(0);
    expect(again.doc.walls.length).toBe(4);
    const longer = addWall(doc, P(-2, 0), P(6, 0), id);
    expect(longer.doc.walls.length).toBe(5);
    expect(lengths(longer.doc).sort((a, b) => a - b)[0]).toBeCloseTo(2, 6);
  });

  it("ignora paredes de menos de 20 cm", () => {
    expect(addWall(EMPTY_PLAN, P(0, 0), P(0.1, 0), id).ids).toHaveLength(0);
  });

  it("mover una esquina arrastra las dos paredes que llegan", () => {
    const doc = moveVertex(rect(6, 8), P(6, 8), P(7, 9));
    const a = analyzePlan(doc);
    expect(a.contour).toHaveLength(4);
    expect(a.area).toBeGreaterThan(48);
  });

  it("correr una pared de costado agranda el rectángulo sin deformarlo", () => {
    const doc = rect(6, 8);
    const right = doc.walls.find((w) => w.a.x === 6 && w.b.x === 6)!;
    const a = analyzePlan(moveWall(doc, right.id, P(2, 0)));
    expect(a.area).toBeCloseTo(64, 6);
    expect(a.contour).toHaveLength(4);
    expect(a.exterior.every((s) => Math.abs(s.a.x - s.b.x) < 1e-9 || Math.abs(s.a.z - s.b.z) < 1e-9)).toBe(true);
  });

  it("correr una pared solo cuenta el movimiento perpendicular", () => {
    const doc = rect(6, 8);
    const right = doc.walls.find((w) => w.a.x === 6 && w.b.x === 6)!;
    expect(analyzePlan(moveWall(doc, right.id, P(2, 5))).area).toBeCloseTo(64, 6);
  });

  it("los tabiques que apoyan en la pared que se corre la siguen", () => {
    let doc = rect(6, 8);
    doc = addWall(doc, P(0, 4), P(6, 4), id).doc;
    const right = doc.walls.find((w) => w.a.x === 6 && w.b.x === 6 && Math.abs(w.a.z - w.b.z) === 8)!;
    const a = analyzePlan(moveWall(doc, right.id, P(1, 0)));
    expect(a.interior).toHaveLength(1);
    expect(a.interior[0]!.length).toBeCloseTo(7, 6);
    expect(a.rooms).toHaveLength(2);
  });

  it("cambiar el largo de una pared estira el ambiente", () => {
    const doc = rect(6, 8);
    const top = doc.walls.find((w) => w.a.z === 0 && w.b.z === 0)!;
    const a = analyzePlan(setWallLength(doc, top.id, 7.5));
    expect(a.area).toBeCloseTo(60, 6);
    expect(a.exterior[0]!.length).toBeCloseTo(7.5, 6);
    expect(a.exterior[2]!.length).toBeCloseTo(7.5, 6);
  });

  it("ignora largos inválidos", () => {
    const doc = rect(6, 8);
    expect(setWallLength(doc, doc.walls[0]!.id, 0)).toBe(doc);
    expect(setWallLength(doc, doc.walls[0]!.id, Number.NaN)).toBe(doc);
    expect(setWallLength(doc, "nada", 5)).toBe(doc);
  });

  it("borrar una pared borra sus aberturas", () => {
    let doc = rect(6, 8);
    const w = doc.walls[0]!;
    doc = addOpening(doc, "ventana", w.id, 3, id).doc;
    expect(doc.openings).toHaveLength(1);
    expect(removeWall(doc, w.id).openings).toHaveLength(0);
  });

  it("las aberturas acompañan a la pared cuando cambia de largo", () => {
    let doc = rect(6, 8);
    const top = doc.walls.find((w) => w.a.z === 0 && w.b.z === 0)!;
    doc = addOpening(doc, "ventana", top.id, 3, id).doc;
    const next = setWallLength(doc, top.id, 9);
    expect(next.openings[0]!.at).toBeCloseTo(4.5, 6);
  });
});

describe("plano: aberturas", () => {
  const house = () => {
    let doc = rect(6, 8);
    doc = addWall(doc, P(0, 4), P(6, 4), id).doc;
    return doc;
  };
  const wall = (doc: PlanDoc, test: (w: PlanDoc["walls"][number]) => boolean) => doc.walls.find(test)!;

  it("una puerta en la pared exterior es la de entrada; en un tabique, interior", () => {
    let doc = house();
    const front = wall(doc, (w) => w.a.z === 8 && w.b.z === 8 || (w.a.z === 8 && w.b.z === 8));
    const partition = wall(doc, (w) => w.a.z === 4 && w.b.z === 4);
    doc = addOpening(doc, "puerta", front.id, 3, id).doc;
    doc = addOpening(doc, "puerta", partition.id, 3, id).doc;
    const a = analyzePlan(doc);
    expect(a.openings.map((o) => o.type).sort()).toEqual(["entrada", "interior"]);
    expect(a.openings.every((o) => !o.problem)).toBe(true);
    expect(catalogType("puerta", true)).toBe("entrada");
    expect(catalogType("ventanal", false)).toBeNull();
  });

  it("el offset es la distancia al centro de la pared, con el sentido del diseñador 3D", () => {
    let doc = rect(6, 8);
    const top = doc.walls.find((w) => w.a.z === 0 && w.b.z === 0)!;
    doc = addOpening(doc, "ventana", top.id, 1.5, id).doc;
    const o = analyzePlan(doc).openings[0]!;
    expect(o.segment).toBe("edge-0");
    expect(o.offset).toBeCloseTo(-1.5, 6);
    expect(o.center).toEqual(P(1.5, 0));
  });

  it("una ventana pegada a la esquina no entra (25 cm)", () => {
    let doc = rect(6, 8);
    const top = doc.walls.find((w) => w.a.z === 0 && w.b.z === 0)!;
    doc = addOpening(doc, "ventana", top.id, 0.4, id).doc;
    expect(analyzePlan(doc).openings[0]!.problem).toMatch(/25 cm/);
    doc = addOpening(rect(6, 8), "ventana", top.id, 3, id).doc;
  });

  it("dos aberturas superpuestas: la segunda se marca", () => {
    let doc = rect(6, 8);
    const top = doc.walls.find((w) => w.a.z === 0 && w.b.z === 0)!;
    doc = addOpening(doc, "ventana", top.id, 3, id).doc;
    doc = addOpening(doc, "ventana", top.id, 3.5, id).doc;
    const [first, second] = analyzePlan(doc).openings;
    expect(first!.problem).toBeNull();
    expect(second!.problem).toMatch(/superpone/);
  });

  it("el ventanal en un tabique no corresponde", () => {
    let doc = house();
    const partition = wall(doc, (w) => w.a.z === 4 && w.b.z === 4);
    doc = addOpening(doc, "ventanal", partition.id, 3, id).doc;
    expect(analyzePlan(doc).openings[0]!.problem).toMatch(/exterior/);
  });

  it("una abertura sobre una pared suelta se marca y se avisa", () => {
    let doc = addWall(rect(6, 8), P(6, 4), P(9, 4), id).doc;
    const loose = doc.walls.at(-1)!;
    doc = addOpening(doc, "ventana", loose.id, 1.5, id).doc;
    const a = analyzePlan(doc);
    expect(a.openings[0]!.segment).toBeNull();
    expect(a.warnings.join(" ")).toMatch(/abertura/);
  });

  it("una abertura sobre una pared larga cortada por un tabique sigue en su pared", () => {
    let doc = rect(8, 6);
    doc = addWall(doc, P(4, 0), P(4, 6), id).doc;
    const top = doc.walls.find((w) => w.a.z === 0 && w.b.z === 0)!;
    doc = addOpening(doc, "ventana", top.id, 6, id).doc;
    const o = analyzePlan(doc).openings[0]!;
    expect(o.segment).toBe("edge-0");
    expect(o.offset).toBeCloseTo(2, 6);
  });
});

describe("plano: nombres de ambientes", () => {
  it("el nombre se asocia al ambiente que lo contiene y se reemplaza al volver a nombrar", () => {
    let doc = addWall(rect(6, 8), P(0, 4), P(6, 4), id).doc;
    doc = setLabel(doc, P(3, 2), "Dormitorio", id);
    doc = setLabel(doc, P(3, 6), "  Living ", id);
    const a = analyzePlan(doc);
    expect(a.rooms.map((r) => r.label?.text).sort()).toEqual(["Dormitorio", "Living"]);
    doc = setLabel(doc, P(3, 2), "Baño", id);
    expect(doc.labels).toHaveLength(2);
    expect(doc.labels.some((l) => l.text === "Baño")).toBe(true);
    expect(setLabel(doc, P(3, 2), "   ", id).labels).toHaveLength(1);
  });

  it("el nombre se recorta a 32 letras", () => {
    expect(setLabel(EMPTY_PLAN, P(0, 0), "x".repeat(80), id).labels[0]!.text).toHaveLength(32);
  });
});

describe("plano: imán del lápiz", () => {
  const doc = rect(6, 8);
  it("se pega a una esquina cercana", () => {
    const s = snapPoint(doc, P(5.93, 0.08), { tol: 0.2 });
    expect(s.kind).toBe("vertex");
    expect(s.point).toEqual(P(6, 0));
  });

  it("sin nada cerca, cae en la cuadrícula de 10 cm", () => {
    const s = snapPoint(doc, P(12.34, 3.07), { tol: 0.05 });
    expect(s.kind).toBe("grid");
    expect(s.point).toEqual(P(12.3, 3.1));
  });

  it("con ángulos rectos, el trazo sale horizontal o vertical del punto anterior", () => {
    const s = snapPoint(doc, P(10.04, 1.3), { tol: 0.05, from: P(8, 1), ortho: true });
    expect(s.point.z).toBe(1);
    expect(s.point.x).toBe(10);
    const v = snapPoint(doc, P(8.2, 5.04), { tol: 0.05, from: P(8, 1), ortho: true });
    expect(v.point.x).toBe(8);
  });

  it("un trazo recto que llega a una pared se apoya justo en ella", () => {
    const s = snapPoint(doc, P(2.1, 7.95), { tol: 0.2, from: P(2, 4), ortho: true });
    expect(s.kind).toBe("wall");
    expect(s.point.x).toBeCloseTo(2, 6);
    expect(s.point.z).toBeCloseTo(8, 6);
  });

  it("se alinea con otras esquinas y avisa con una guía", () => {
    const inner = addWall(doc, P(3, 4), P(3, 8), id).doc;
    const s = snapPoint(inner, P(3.03, 1.5), { tol: 0.05 });
    expect(s.kind).toBe("grid");
    expect(s.guide.x).toBe(3);
    expect(s.point.x).toBe(3);
  });

  it("encuentra la pared tocada y a qué distancia de su inicio", () => {
    const hit = hitWall(doc, P(2.5, 0.05), 0.2)!;
    expect(hit.wall.a.z).toBe(0);
    expect(hit.at).toBeCloseTo(2.5, 6);
    expect(hitWall(doc, P(3, 4), 0.2)).toBeNull();
  });
});

describe("plano: guardado", () => {
  it("guarda y vuelve a leer el mismo plano", () => {
    let doc = addWall(rect(6, 8), P(0, 4), P(6, 4), id).doc;
    doc = addOpening(doc, "ventana", doc.walls[0]!.id, 3, id).doc;
    doc = setLabel(doc, P(3, 2), "Dormitorio", id);
    expect(parsePlan(serializePlan(doc))).toEqual(doc);
  });

  it("un texto roto o ajeno no rompe el editor", () => {
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan("no es json")).toBeNull();
    expect(parsePlan('{"walls": 3}')).toBeNull();
    const text = JSON.stringify({ walls: [{ id: "a", a: { x: 0, z: 0 }, b: { x: "x", z: 1 } }, { id: "b", a: { x: 0, z: 0 }, b: { x: 4, z: 0 } }], openings: [{ id: "o", kind: "tele", wall: "b", at: 1 }, { id: "p", kind: "ventana", wall: "zzz", at: 1 }], labels: [{ id: "l", at: { x: 1, z: 1 }, text: "" }] });
    const doc = parsePlan(text)!;
    expect(doc.walls).toHaveLength(1);
    expect(doc.openings).toHaveLength(0);
    expect(doc.labels).toHaveLength(0);
  });
});
