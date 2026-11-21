import { describe, expect, it } from "vitest";
import { PLAN_CATALOG } from "@/config/layoutProposals";
import { bounds, distance, inside, isOrthogonal, offsetContour, planeHeight, project, roofFaces, signedArea, type Point } from "@/config/geometry";
import { exteriorThickness } from "@/config/systems";
import { buildLayoutProposal, initialConfig } from "@/store/useConfigurator";
import { buildRoofGeometry, roofLift } from "./roofGeometry";

const ROOFS = ["una", "dos", "plano"] as const;

describe("techo de chapa y frontones de las casas livianas", () => {
  const plans = PLAN_CATALOG.filter((p) => p.version === 2 && (p.system ?? "woodframe") === "woodframe");

  it("hay faldones válidos en las tres formas de techo, en todas las distribuciones", () => {
    for (const plan of plans)
      for (const roofType of ROOFS)
        for (const roofDirection of ["x", "z"] as const) {
          const c = { ...buildLayoutProposal(initialConfig("woodframe"), plan), roofType, roofDirection },
            { g } = buildRoofGeometry(c),
            pos = g.getAttribute("position");
          expect(pos.count, `${plan.id} ${roofType}/${roofDirection}`).toBeGreaterThan(0);
          expect(pos.count % 3).toBe(0);
          for (let i = 0; i < pos.count; i++) {
            expect(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i))).toBe(true);
            // el alero baja un poco por debajo del borde del muro, pero nunca medio metro
            expect(pos.getY(i)).toBeGreaterThan(-0.5);
          }
        }
  });

  it("el muro bajo el techo (frontón) queda a ras de la cara exterior del muro de la casa: no se nota una pared más angosta", () => {
    const bad: string[] = [];
    for (const plan of plans)
      for (const roofType of ROOFS) {
        const c = { ...buildLayoutProposal(initialConfig("woodframe"), plan), roofType },
          half = exteriorThickness(c.finish) / 2,
          outer = offsetContour(c.contour, half),
          { ends } = buildRoofGeometry(c),
          pos = ends.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          const p = { x: pos.getX(i), z: pos.getZ(i) },
            onFace = outer.some((a, k) => {
              const b = outer[(k + 1) % outer.length]!;
              return distance(project(p, a, b).point, p) < 1e-4;
            });
          if (!onFace) {
            bad.push(`${plan.id} ${roofType}: un vértice del frontón está fuera de la cara exterior del muro`);
            break;
          }
        }
      }
    expect(bad).toEqual([]);
  });

  it("a dos aguas hay frontones en los dos extremos de una casa rectangular", () => {
    const plan = plans.find((p) => p.footprint === "rectangular")!,
      c = { ...buildLayoutProposal(initialConfig("woodframe"), plan), roofType: "dos" as const, roofDirection: "x" as const },
      { ends } = buildRoofGeometry(c);
    // un frontón es un triángulo (3 vértices) por cada extremo
    expect(ends.getAttribute("position").count).toBeGreaterThanOrEqual(6);
  });

  /** Casas con el techo armado como lo arma `buildRoofGeometry`: las caras (sin alero) con su plano, para saber a qué altura queda el techo. */
  const facesOf = (c: ReturnType<typeof buildLayoutProposal> & { roofType: (typeof ROOFS)[number]; roofDirection: "x" | "z" }) => {
    const b = bounds(c.contour),
      slope = Math.tan(((c.roofType === "plano" ? 3 : c.roofPitch) * Math.PI) / 180);
    return {
      slope,
      faces:
        c.roofType === "dos" && isOrthogonal(c.contour)
          ? roofFaces(c.contour, c.roofDirection, slope)
          : [{ rings: [c.contour], plane: c.roofDirection === "x" ? { x: slope, z: 0, c: -b.minX * slope } : { x: 0, z: slope, c: -b.minZ * slope } }],
    };
  };
  const cases = () => {
    const out: { plan: (typeof plans)[number]; roofType: (typeof ROOFS)[number]; roofDirection: "x" | "z"; c: ReturnType<typeof buildLayoutProposal> & { roofType: (typeof ROOFS)[number]; roofDirection: "x" | "z" } }[] = [];
    for (const plan of plans)
      for (const roofType of ROOFS)
        for (const roofDirection of ["x", "z"] as const) out.push({ plan, roofType, roofDirection, c: { ...buildLayoutProposal(initialConfig("woodframe"), plan), roofType, roofDirection } });
    return out;
  };
  /** Cada tramo de pared bajo el techo guardado como [x0,z0,h0, x1,z1,h1]. */
  const quadsOf = (ends: ReturnType<typeof buildRoofGeometry>["ends"]) => {
    const pos = ends.getAttribute("position"),
      out: { a: Point; b: Point; ha: number; hb: number }[] = [];
    for (let i = 0; i + 5 < pos.count; i += 6)
      out.push({ a: { x: pos.getX(i), z: pos.getZ(i) }, b: { x: pos.getX(i + 1), z: pos.getZ(i + 1) }, ha: pos.getY(i + 5), hb: pos.getY(i + 2) });
    return out;
  };

  it("en todo el borde de la planta donde el techo sube por encima del muro hay pared hasta el techo (no falta ningún pedazo, ni en una L)", () => {
    const bad: string[] = [];
    for (const { plan, roofType, roofDirection, c } of cases()) {
      const { slope, faces } = facesOf(c),
        half = exteriorThickness(c.finish) / 2,
        n = c.contour.length,
        sign = signedArea(c.contour) > 0 ? 1 : -1,
        quads = quadsOf(buildRoofGeometry(c).ends);
      for (let k = 0; k < n; k++) {
        const w0 = c.contour[k]!,
          w1 = c.contour[(k + 1) % n]!,
          len = distance(w0, w1),
          dx = (w1.x - w0.x) / len,
          dz = (w1.z - w0.z) / len,
          nx = sign * dz,
          nz = -sign * dx;
        // se muestrea lejos de las esquinas: en una esquina cóncava la cara exterior empieza medio espesor más adentro
        for (let t = half + 0.03; t < len - half - 0.03; t += 0.1) {
          const inner = { x: w0.x + dx * t - nx * 0.01, z: w0.z + dz * t - nz * 0.01 },
            outer = { x: w0.x + dx * t + nx * half, z: w0.z + dz * t + nz * half },
            face = faces.find((f) => inside(inner, f.rings[0]!, true));
          if (!face) continue;
          const wanted = Math.max(0, planeHeight(face.plane, outer) + slope * half);
          if (wanted < 0.02) continue;
          // altura de la pared que hay en ese punto de la cara exterior
          let got = 0;
          for (const q of quads) {
            const ex = q.b.x - q.a.x,
              ez = q.b.z - q.a.z,
              l2 = ex * ex + ez * ez;
            if (l2 < 1e-12) continue;
            const s = ((outer.x - q.a.x) * ex + (outer.z - q.a.z) * ez) / l2;
            if (s < -1e-6 || s > 1 + 1e-6) continue;
            if (Math.hypot(outer.x - (q.a.x + ex * s), outer.z - (q.a.z + ez * s)) > 2e-3) continue;
            got = Math.max(got, q.ha + (q.hb - q.ha) * s);
          }
          if (got < wanted - 0.02) {
            bad.push(`${plan.id} ${roofType}/${roofDirection}: en el lado ${k} a ${t.toFixed(2)} m falta pared bajo el techo (hay ${got.toFixed(2)} m y tendría que haber ${wanted.toFixed(2)} m)`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("la chapa apoya por encima del borde superior del muro en todo el espesor del muro (no asoma una línea blanca del muro)", () => {
    const bad: string[] = [];
    for (const { plan, roofType, roofDirection, c } of cases()) {
      const half = exteriorThickness(c.finish) / 2,
        { g } = buildRoofGeometry(c),
        pos = g.getAttribute("position"),
        height = (p: Point) => {
          for (let i = 0; i + 2 < pos.count; i += 3) {
            const ax = pos.getX(i), az = pos.getZ(i), bx = pos.getX(i + 1), bz = pos.getZ(i + 1), cx = pos.getX(i + 2), cz = pos.getZ(i + 2),
              d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
            if (Math.abs(d) < 1e-12) continue;
            const l1 = ((bz - cz) * (p.x - cx) + (cx - bx) * (p.z - cz)) / d,
              l2 = ((cz - az) * (p.x - cx) + (ax - cx) * (p.z - cz)) / d,
              l3 = 1 - l1 - l2;
            if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return l1 * pos.getY(i) + l2 * pos.getY(i + 1) + l3 * pos.getY(i + 2);
          }
          return null;
        },
        n = c.contour.length,
        sign = signedArea(c.contour) > 0 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const w0 = c.contour[k]!,
          w1 = c.contour[(k + 1) % n]!,
          len = distance(w0, w1),
          dx = (w1.x - w0.x) / len,
          dz = (w1.z - w0.z) / len,
          nx = sign * dz,
          nz = -sign * dx;
        for (let t = 0.2; t < len - 0.2; t += 0.4)
          for (const d of [half, 0, -half]) {
            const h = height({ x: w0.x + dx * t + nx * d, z: w0.z + dz * t + nz * d });
            if (h !== null && h < 0.002) bad.push(`${plan.id} ${roofType}/${roofDirection}: la chapa queda a ${h.toFixed(3)} m del borde del muro en el lado ${k}`);
          }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("la altura de apoyo es la justa: sube con la pendiente y con el espesor del muro", () => {
    expect(roofLift(0, 0.15)).toBeGreaterThan(0);
    expect(roofLift(0.5, 0.2)).toBeGreaterThan(roofLift(0.25, 0.2));
    expect(roofLift(0.3, 0.3)).toBeGreaterThan(roofLift(0.3, 0.15));
  });

  it("los faldones miran hacia arriba y las paredes bajo el techo miran hacia afuera de la casa", () => {
    const bad: string[] = [];
    for (const { plan, roofType, roofDirection, c } of cases()) {
      const { g, ends } = buildRoofGeometry(c),
        pos = g.getAttribute("position"),
        nor = g.getAttribute("normal");
      for (let i = 0; i < nor.count; i++)
        if (nor.getY(i) < 0) {
          bad.push(`${plan.id} ${roofType}/${roofDirection}: un faldón mira hacia abajo`);
          break;
        }
      void pos;
      const outerRing = offsetContour(c.contour, exteriorThickness(c.finish) / 2),
        en = ends.getAttribute("normal"),
        ep = ends.getAttribute("position");
      for (let i = 0; i + 2 < en.count; i += 3) {
        const mid = { x: (ep.getX(i) + ep.getX(i + 1) + ep.getX(i + 2)) / 3, z: (ep.getZ(i) + ep.getZ(i + 1) + ep.getZ(i + 2)) / 3 },
          nx = en.getX(i), nz = en.getZ(i);
        if (Math.abs(nx) + Math.abs(nz) < 1e-6) continue;
        if (inside({ x: mid.x + nx * 0.1, z: mid.z + nz * 0.1 }, outerRing, false) || !inside({ x: mid.x - nx * 0.1, z: mid.z - nz * 0.1 }, outerRing, true)) {
          bad.push(`${plan.id} ${roofType}/${roofDirection}: una pared bajo el techo mira hacia adentro`);
          break;
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("en una casa en L a dos aguas hay pared bajo el techo también en el tramo que da al rincón", () => {
    const plan = plans.find((p) => p.id === "wf-l-dos-plantas");
    if (!plan) return;
    const c = { ...buildLayoutProposal(initialConfig("woodframe"), plan), roofType: "dos" as const, roofDirection: "x" as const },
      quads = quadsOf(buildRoofGeometry(c).ends),
      // los lados del contorno que miran hacia el rincón son los que no son borde del rectángulo envolvente
      b = bounds(c.contour),
      inner = quads.filter((q) => Math.abs(q.a.x - q.b.x) > 0.5 && Math.abs(q.a.z - b.minZ) > 0.3 && Math.abs(q.a.z - b.maxZ) > 0.3);
    expect(inner.length).toBeGreaterThan(0);
    expect(Math.max(...inner.map((q) => Math.max(q.ha, q.hb)))).toBeGreaterThan(0.5);
  });
});
