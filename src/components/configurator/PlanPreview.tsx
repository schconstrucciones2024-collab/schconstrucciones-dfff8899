import {
  bounds,
  detectRooms,
  distance,
  exteriorStairPose,
  inside,
  project,
  stairGeometry,
  transformPoint,
  type Point,
  type Stair,
} from "@/config/geometry";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { FLOOR_STEP, designWalls, roomName, type HouseConfig } from "@/store/useConfigurator";

type RoomShape = { polygon: Point[]; holes?: Point[][]; center: Point };
type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
/** Caja alineada a los ejes de un rectángulo girado (las plantas solo giran de a 90°). */
const rotatedBox = (x: number, z: number, w: number, d: number, rotation: number): Box => {
  const turned = Math.abs(Math.sin(rotation)) > 0.5,
    hw = (turned ? d : w) / 2,
    hd = (turned ? w : d) / 2;
  return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
};
const boxOf = (points: Point[]): Box => {
  const b = bounds(points);
  return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
};
const gapTo = (p: Point, o: Box) =>
  Math.hypot(Math.max(o.minX - p.x, 0, p.x - o.maxX), Math.max(o.minZ - p.z, 0, p.z - o.maxZ));

/**
 * Punto del ambiente más alejado de sus muros y del mobiliario: ahí se escribe el nombre (el centro de un ambiente en L cae
 * sobre un muro, y el de un dormitorio sobre la cama). Si el mobiliario no deja lugar, se usa solo la distancia a los muros.
 */
function labelAnchor(r: RoomShape, obstacles: Box[] = [], width = 0): { at: Point; room: number } {
  const xs = r.polygon.map((p) => p.x),
    zs = r.polygon.map((p) => p.z),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs),
    rings = [r.polygon, ...(r.holes ?? [])],
    step = Math.max(0.1, Math.max(maxX - minX, maxZ - minZ) / 40),
    near = obstacles.filter(
      (o) => o.maxX > minX && o.minX < maxX && o.maxZ > minZ && o.minZ < maxZ,
    );
  let best = r.center,
    bestD = -1,
    plain = r.center,
    plainD = -1;
  for (let x = minX + step / 2; x < maxX; x += step)
    for (let z = minZ + step / 2; z < maxZ; z += step) {
      const p = { x, z };
      if (!inside(p, r.polygon, false) || (r.holes ?? []).some((h) => inside(p, h))) continue;
      let d = Infinity;
      for (const ring of rings)
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i]!,
            b = ring[(i + 1) % ring.length]!;
          d = Math.min(d, distance(project(p, a, b).point, p));
        }
      if (d > plainD) {
        plainD = d;
        plain = p;
      }
      let free = d;
      for (const o of near) free = Math.min(free, gapTo(p, o));
      if (free > bestD) {
        bestD = free;
        best = p;
      }
    }
  // Si el mobiliario deja solo una franja donde el nombre no entra (un dormitorio con la cama), va sobre el centro del ambiente.
  return bestD * 2 < Math.min(width, plainD * 1.2)
    ? { at: plain, room: Math.max(0.6, plainD * 2) }
    : { at: best, room: Math.max(0.6, bestD * 2) };
}

const ring = (points: Point[]) => points.map((p) => `${p.x},${p.z}`).join(" ");
const fmt = (n: number) => n.toFixed(2).replace(".", ",");
const tint = (name: string) =>
  name.startsWith("Baño") || name.startsWith("Toilette") || name.startsWith("Lavadero")
    ? "var(--scene-glass)"
    : name.startsWith("Dormitorio") || name.startsWith("Suite")
      ? "var(--scene-fabric)"
      : "var(--secondary)";

function StairDrawing({
  stair,
  config,
  hole,
}: {
  stair: Stair;
  config: HouseConfig;
  hole?: boolean;
}) {
  const pose = stair.exterior
      ? { ...stair, ...exteriorStairPose(stair, config.contour, FLOOR_STEP) }
      : stair,
    g = stairGeometry(pose, FLOOR_STEP);
  if (hole)
    return (
      <polygon
        points={ring(g.hole)}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth="0.03"
        strokeDasharray="0.15 0.12"
      />
    );
  const first = g.steps[0],
    last = g.steps[g.first > 1 && g.first < g.steps.length ? g.first - 1 : g.steps.length - 1],
    from = first && transformPoint({ x: first.x, z: first.z }, pose.x, pose.z, pose.rotation),
    to = last && transformPoint({ x: last.x, z: last.z }, pose.x, pose.z, pose.rotation);
  return (
    <g>
      <polygon
        points={ring(g.footprint)}
        fill="var(--background)"
        fillOpacity="0.6"
        stroke="var(--foreground)"
        strokeWidth="0.04"
      />
      {pose.type !== "caracol" &&
        g.steps.map((s, i) => {
          const a = transformPoint(
              {
                x: s.x - (s.width / 2) * Math.cos(s.rotation),
                z: s.z - (s.width / 2) * Math.sin(s.rotation),
              },
              pose.x,
              pose.z,
              pose.rotation,
            ),
            b = transformPoint(
              {
                x: s.x + (s.width / 2) * Math.cos(s.rotation),
                z: s.z + (s.width / 2) * Math.sin(s.rotation),
              },
              pose.x,
              pose.z,
              pose.rotation,
            );
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.z}
              x2={b.x}
              y2={b.z}
              stroke="var(--foreground)"
              strokeOpacity="0.45"
              strokeWidth="0.015"
            />
          );
        })}
      {pose.type !== "caracol" && from && to && !stair.exterior && (
        <line
          x1={from.x}
          y1={from.z}
          x2={to.x}
          y2={to.z}
          stroke="var(--primary)"
          strokeWidth="0.05"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

/** Planta de una distribución, con ambientes nombrados, aberturas, artefactos y escaleras. */
export function PlanPreview({
  config,
  floor = 0,
  className = "h-60 w-full bg-secondary",
}: {
  config: HouseConfig;
  floor?: number;
  className?: string;
}) {
  const b = bounds(config.contour),
    rooms = detectRooms(config.contour, config.walls[floor] ?? []),
    walls = designWalls(config, floor),
    pad = 1.1,
    unit = Math.max(b.width, b.depth) / 12;
  const interiorStairs = config.stairs.filter((s) => !s.exterior);
  // Lo que ocupa lugar en esta planta: camas, artefactos, mesadas, escaleras y el hueco de la escalera que llega desde abajo.
  const obstacles: Box[] = [
    ...config.fixtures
      .filter((f) => f.floor === floor)
      .map((f) =>
        f.kind === "cama"
          ? rotatedBox(f.x, f.z, 1.4, 1.9, f.rotation)
          : f.kind === "ducha"
            ? rotatedBox(f.x, f.z, 0.9, 0.9, 0)
            : rotatedBox(f.x, f.z, 0.4, 0.7, 0),
      ),
    ...config.counters
      .filter((v) => v.floor === floor)
      .map((v) => rotatedBox(v.x, v.z, v.length, v.depth, v.rotation)),
    ...interiorStairs
      .filter((s) => s.floor === floor)
      .map((s) => boxOf(stairGeometry(s, FLOOR_STEP).footprint)),
    ...interiorStairs
      .filter((s) => s.floor === floor - 1)
      .map((s) => boxOf(stairGeometry(s, FLOOR_STEP).hole)),
  ];
  return (
    <svg
      viewBox={`${b.minX - pad} ${b.minZ - pad} ${b.width + pad * 2} ${b.depth + pad * 2}`}
      className={className}
      role="img"
      aria-label={
        floor === 0 ? "Planta baja de la distribución" : `Planta ${floor} de la distribución`
      }
    >
      <polygon points={ring(config.contour)} fill="var(--background)" />
      {rooms.map((r, i) => {
        const name = roomName(config, floor, r, i);
        return <polygon key={r.id} points={ring(r.polygon)} fill={tint(name)} fillOpacity="0.45" />;
      })}
      {interiorStairs
        .filter((s) => s.floor === floor)
        .map((s) => (
          <StairDrawing key={s.id} stair={s} config={config} />
        ))}
      {interiorStairs
        .filter((s) => s.floor === floor - 1)
        .map((s) => (
          <StairDrawing key={s.id} stair={s} config={config} hole />
        ))}
      {floor === 0 &&
        config.stairs
          .filter((s) => s.exterior)
          .map((s) => <StairDrawing key={s.id} stair={s} config={config} />)}
      {config.fixtures
        .filter((f) => f.floor === floor)
        .map((f) =>
          f.kind === "cama" ? (
            <rect
              key={f.id}
              x={f.x - 0.7}
              y={f.z - 0.95}
              width="1.4"
              height="1.9"
              rx="0.06"
              fill="var(--foreground)"
              fillOpacity="0.2"
              stroke="var(--foreground)"
              strokeWidth="0.03"
              transform={`rotate(${(f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
            />
          ) : f.kind === "ducha" ? (
            <rect
              key={f.id}
              x={f.x - 0.45}
              y={f.z - 0.45}
              width="0.9"
              height="0.9"
              fill="var(--scene-glass)"
              stroke="var(--foreground)"
              strokeWidth="0.03"
            />
          ) : (
            <ellipse
              key={f.id}
              cx={f.x}
              cy={f.z}
              rx="0.2"
              ry="0.35"
              fill="var(--background)"
              stroke="var(--foreground)"
              strokeWidth="0.03"
            />
          ),
        )}
      {config.counters
        .filter((v) => v.floor === floor)
        .map((v) => (
          <rect
            key={v.id}
            x={v.x - v.length / 2}
            y={v.z - v.depth / 2}
            width={v.length}
            height={v.depth}
            transform={`rotate(${(v.rotation * 180) / Math.PI} ${v.x} ${v.z})`}
            fill={v.kind === "cocina" ? "var(--primary)" : "var(--foreground)"}
            fillOpacity={v.kind === "cocina" ? 0.75 : 0.35}
          />
        ))}
      {walls.map((w) => (
        <line
          key={w.id}
          x1={w.a.x}
          y1={w.a.z}
          x2={w.b.x}
          y2={w.b.z}
          stroke="var(--foreground)"
          strokeWidth={w.thickness}
          strokeLinecap="square"
        />
      ))}
      {config.openings
        .filter((o) => o.floor === floor)
        .map((o) => {
          const w = walls.find((v) => v.id === o.wall);
          if (!w) return null;
          const len = distance(w.a, w.b),
            t = 0.5 + o.offset / len,
            ux = (w.b.x - w.a.x) / len,
            uz = (w.b.z - w.a.z) / len,
            half = OPENINGS_CATALOG[o.type].width / 2,
            x = w.a.x + (w.b.x - w.a.x) * t,
            z = w.a.z + (w.b.z - w.a.z) * t,
            door = OPENINGS_CATALOG[o.type].door;
          return (
            <g key={o.id}>
              <line
                x1={x - ux * half}
                y1={z - uz * half}
                x2={x + ux * half}
                y2={z + uz * half}
                stroke="var(--background)"
                strokeWidth={w.thickness + 0.04}
              />
              <line
                x1={x - ux * half}
                y1={z - uz * half}
                x2={x + ux * half}
                y2={z + uz * half}
                stroke="var(--primary)"
                strokeWidth={door ? 0.07 : 0.05}
              />
            </g>
          );
        })}
      {rooms.map((r, i) => {
        const name = roomName(config, floor, r, i),
          { at, room } = labelAnchor(r, obstacles, Math.max(name.length, 6) * 0.56 * unit * 0.2),
          size = Math.max(
            unit * 0.17,
            Math.min(unit * 0.3, room / (Math.max(name.length, 6) * 0.56)),
          );
        return (
          <text
            key={r.id}
            x={at.x}
            y={at.z}
            textAnchor="middle"
            fontSize={size}
            fill="var(--foreground)"
            stroke="var(--background)"
            strokeWidth={size * 0.3}
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{ pointerEvents: "none" }}
          >
            <tspan x={at.x} dy="-0.15em" fontWeight="600">
              {name}
            </tspan>
            <tspan x={at.x} dy="1.25em" fillOpacity="0.7">
              {fmt(r.area)} m²
            </tspan>
          </text>
        );
      })}
      <text
        x={(b.minX + b.maxX) / 2}
        y={b.minZ - 0.45}
        textAnchor="middle"
        fontSize={unit * 0.26}
        fill="var(--foreground)"
        fillOpacity="0.7"
      >
        {fmt(b.width)} m
      </text>
      <text
        x={b.minX - 0.45}
        y={(b.minZ + b.maxZ) / 2}
        textAnchor="middle"
        fontSize={unit * 0.26}
        fill="var(--foreground)"
        fillOpacity="0.7"
        transform={`rotate(-90 ${b.minX - 0.45} ${(b.minZ + b.maxZ) / 2})`}
      >
        {fmt(b.depth)} m
      </text>
    </svg>
  );
}
