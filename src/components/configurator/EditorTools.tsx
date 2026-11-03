import {
  MousePointer2,
  Pentagon,
  BrickWall,
  DoorOpen,
  Footprints,
  RectangleHorizontal,
  Ruler,
  Copy,
  Trash2,
  RotateCw,
  Lock,
  Unlock,
  Plus,
  Pencil,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LayoutGallery } from './LayoutGallery';
import { StairAssistant } from './StairAssistant';
import { useConfigurator, designWalls, roomName, type ToolId } from "@/store/useConfigurator";
import { detectRooms, presetPolygon, isOrthogonal, FIXTURE_SIZES, type Footprint, type FixtureKind } from "@/config/geometry";
const tools: { id: ToolId; name: string; Icon: typeof Plus }[] = [
  { id: "select", name: "Seleccionar", Icon: MousePointer2 },
  { id: "contour", name: "Forma exterior", Icon: Pencil },
  { id: "wall", name: "Paredes interiores", Icon: BrickWall },
  { id: "opening", name: "Aberturas", Icon: DoorOpen },
  { id: "stair", name: "Escalera", Icon: Footprints },
  { id: "counter", name: "Muebles", Icon: RectangleHorizontal },
  { id: "measure", name: "Medir", Icon: Ruler },
];
export function EditorToolbar() {
  const s = useConfigurator();
  return (
    <div className="config-toolbar flex flex-wrap gap-1 border-b border-border py-3">
      {tools.map(({ id, name, Icon }) => (
        <Button
          key={id}
          variant={s.tool === id ? "default" : "outline"}
          className="h-11 gap-2 px-3 text-xs"
          title={name}
          aria-label={name}
          aria-pressed={s.tool === id}
          onClick={() => {
            s.setTool(id);
            if (id !== "select") s.setView("planta");
          }}
        >
          <Icon size={18} />
          {(id === 'contour' || id === 'wall') && name}
        </Button>
      ))}
      <div className="ml-auto flex flex-wrap gap-2">
        <LayoutGallery />
        <Button variant="outline" className="min-h-11 gap-2 text-xs" onClick={() => { s.setTool('select'); s.setView('exterior'); }}><Eye size={16} />Ver en 3D</Button>
        <Button variant="outline" className="min-h-11 text-xs" onClick={() => s.layout(false)}>
          Distribución sugerida
        </Button>
        <Button variant="outline" className="min-h-11 text-xs" onClick={() => s.layout(true)}>
          Empezar en blanco
        </Button>
      </div>
    </div>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = 0.1,
  max = 20,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block text-xs text-foreground/75">
      {label}
      <input
        className="config-input mt-1"
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(3))}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
    </label>
  );
}
export function EditorPanel() {
  const s = useConfigurator(),
    c = s.config,
    co = c.counters.find((v) => v.id === s.selectedId),
    st = c.stairs.find((v) => v.id === s.selectedId),
    fx = c.fixtures.find((v) => v.id === s.selectedId),
    w = c.walls.flat().find((v) => v.id === s.selectedId),
    edge = designWalls(c, s.activeFloor).find(
      (v) => v.id === s.selectedId && v.id.startsWith("edge-"),
    ),
    rooms = detectRooms(c.contour, c.walls[s.activeFloor] ?? []),
    obj = co ?? st ?? w ?? fx;
  const lock = () => {
    if (co) s.editCounter(co.id, { locked: !co.locked });
    if (st) s.editStair(st.id, { locked: !st.locked });
    if (w) s.editWall(w.id, { locked: !w.locked });
    if (fx) s.editFixture(fx.id, { locked: !fx.locked });
  };
  return (
    <div className="space-y-4 border-b border-border pb-5">
      <label className="block text-xs">
        Planta
        <select
          className="config-input mt-1"
          value={s.activeFloor}
          onChange={(e) => s.setFloor(Number(e.target.value))}
        >
          {Array.from({ length: c.floors }, (_, i) => (
            <option key={i} value={i}>
              {i === 0 ? "Planta baja" : `${i}ª planta`}
            </option>
          ))}
        </select>
      </label>
      {s.tool === "contour" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(["rectangular", "L", "U", "T", "escalonada"] as Footprint[]).map((v) => (
              <Button
                key={v}
                variant={c.footprint === v ? "default" : "outline"}
                className="min-h-11 capitalize text-xs"
                onClick={() =>
                  s.update({
                    contour: presetPolygon(v, c.m2 / c.floors),
                    footprint: v,
                    walls: Array.from({ length: c.floors }, () => []),
                    openings: [],
                  })
                }
              >
                {v === "rectangular"
                  ? "Rectangular"
                  : v === "escalonada"
                    ? "Escalonada"
                    : `En ${v}`}
              </Button>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={c.orthogonal}
              onChange={(e) => s.update({ orthogonal: e.target.checked })}
            />
            Ortogonal
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Mover casa X (m)"
              value={c.position.x}
              min={-30}
              max={30}
              onChange={(x) => s.update({ position: { ...c.position, x } })}
            />
            <NumberField
              label="Mover casa Z (m)"
              value={c.position.z}
              min={-30}
              max={30}
              onChange={(z) => s.update({ position: { ...c.position, z } })}
            />
            <NumberField
              label="Rotación casa (°)"
              value={(c.rotation * 180) / Math.PI}
              min={-360}
              max={360}
              step={15}
              onChange={(v) => s.update({ rotation: (v * Math.PI) / 180 })}
            />
          </div>
        </>
      )}
      {s.tool === "counter" && (
        <Button className="min-h-11 w-full" variant="outline" onClick={s.addCounter}>
          <Plus size={16} />
          Agregar mesada
        </Button>
      )}
      {s.tool === "counter" && (
        <div className="grid grid-cols-3 gap-2">
          {(["cama", "wc", "ducha"] as FixtureKind[]).map((k) => (
            <Button key={k} variant="outline" className="min-h-11 px-2 text-xs" onClick={() => s.addFixture(k)}>
              <Plus size={14} />
              {k === "cama" ? "Cama" : k === "wc" ? "WC" : "Ducha"}
            </Button>
          ))}
        </div>
      )}
      {fx && (
        <>
          <h4 className="text-sm font-medium">{FIXTURE_SIZES[fx.kind].name}</h4>
          <p className="text-xs text-foreground/60">
            {FIXTURE_SIZES[fx.kind].width.toFixed(2)} × {FIXTURE_SIZES[fx.kind].depth.toFixed(2)} m · Arrastralo para moverlo.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(["x", "z", "rotation"] as const).map((k) => (
              <NumberField
                key={k}
                label={{ x: "Posición X (m)", z: "Posición Z (m)", rotation: "Rotación (°)" }[k]}
                min={k === "rotation" ? -360 : -30}
                max={k === "rotation" ? 360 : 30}
                step={k === "rotation" ? 15 : 0.1}
                value={k === "rotation" ? (fx[k] * 180) / Math.PI : fx[k]}
                onChange={(v) => s.editFixture(fx.id, { [k]: k === "rotation" ? (v * Math.PI) / 180 : v })}
              />
            ))}
          </div>
        </>
      )}
      {s.tool === "stair" && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="min-h-11 text-xs" onClick={() => s.addStair()}>
            Interior
          </Button>
          <Button variant="outline" className="min-h-11 text-xs" onClick={() => s.addStair(true)}>
            Exterior
          </Button>
          <StairAssistant />
        </div>
      )}
      {s.tool === "opening" && (
        <div className="grid grid-cols-2 gap-2">
          {(["entrada", "interior", "ventana", "ventanaGrande", "ventanal", "ventanaCocina"] as const).map(
            (type) => (
              <Button
                key={type}
                variant={s.placing === type ? "default" : "outline"}
                className="min-h-11 text-xs"
                onClick={() => s.setPlacing(type)}
              >
                {type === "entrada"
                  ? "Entrada"
                  : type === "interior"
                    ? "Puerta interior"
                    : type === "ventanaGrande"
                      ? "Ventana grande"
                      : type === "ventanal"
                        ? "Ventanal"
                        : type === "ventanaCocina"
                          ? "Ventana cocina"
                          : "Ventana"}
              </Button>
            ),
          )}
        </div>
      )}
      {co && (
        <>
          <h4 className="text-sm font-medium">Mesada</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              Tipo
              <select
                className="config-input mt-1"
                value={co.kind}
                onChange={(e) =>
                  s.editCounter(co.id, { kind: e.target.value === "bano" ? "bano" : "cocina" })
                }
              >
                <option value="cocina">Cocina</option>
                <option value="bano">Baño</option>
              </select>
            </label>
            <label className="text-xs">
              Material
              <select
                className="config-input mt-1"
                value={co.material}
                onChange={(e) =>
                  s.editCounter(co.id, {
                    material: e.target.value === "drywall" ? "drywall" : "pino",
                  })
                }
              >
                <option value="pino">Tablones de pino</option>
                <option value="drywall">Drywall</option>
              </select>
            </label>
            <label className="text-xs">
              Forma
              <select
                className="config-input mt-1"
                value={co.shape}
                onChange={(e) =>
                  s.editCounter(co.id, { shape: e.target.value === "L" ? "L" : "lineal" })
                }
              >
                <option value="lineal">Lineal</option>
                <option value="L">En L</option>
              </select>
            </label>
            {(["length", "depth", "height", "x", "z", "rotation"] as const).map((k) => (
              <NumberField
                key={k}
                label={
                  {
                    length: "Largo (m)",
                    depth: "Profundidad (m)",
                    height: "Altura (m)",
                    x: "Posición X (m)",
                    z: "Posición Z (m)",
                    rotation: "Rotación (°)",
                  }[k]
                }
                min={k === "x" || k === "z" ? -30 : k === "rotation" ? -360 : 0.3}
                max={k === "rotation" ? 360 : 20}
                step={k === "rotation" ? 15 : 0.1}
                value={k === "rotation" ? (co[k] * 180) / Math.PI : co[k]}
                onChange={(v) =>
                  s.editCounter(co.id, { [k]: k === "rotation" ? (v * Math.PI) / 180 : v })
                }
              />
            ))}
          </div>
        </>
      )}
      {st && (
        <>
          <h4 className="text-sm font-medium">Escalera {st.exterior ? "exterior" : "interior"}</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              Tipo
              <select
                className="config-input mt-1"
                value={st.type}
                onChange={(e) =>
                  s.editStair(st.id, {
                    type: e.target.value === "L" ? "L" : e.target.value === "U" ? "U" : e.target.value === "caracol" ? "caracol" : "recta",
                  })
                }
              >
                <option value="recta">Recta</option>
                {!st.exterior && (
                  <>
                    <option value="L">En L</option>
                    <option value="U">En U</option>
                    <option value="caracol">Caracol (compacta)</option>
                  </>
                )}
              </select>
            </label>
            {!st.exterior && (
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <Button variant={st.type === "caracol" ? "outline" : "default"} className="min-h-11" onClick={() => s.editStair(st.id, { type: "U" })}>Escalera normal</Button>
                <Button variant={st.type === "caracol" ? "default" : "outline"} className="min-h-11" onClick={() => s.editStair(st.id, { type: "caracol" })}>Escalera caracol</Button>
              </div>
            )}
            <div className="col-span-2 flex items-center gap-2">
              <Button variant="outline" className="min-h-11 flex-1" disabled={st.width <= 0.6} onClick={() => s.editStair(st.id, { width: Math.max(0.6, Math.round((st.width - 0.1) * 10) / 10) })}>− Más angosta</Button>
              <span className="text-xs tabular-nums">{st.width.toFixed(2)} m</span>
              <Button variant="outline" className="min-h-11 flex-1" disabled={st.width >= 2.4} onClick={() => s.editStair(st.id, { width: Math.min(2.4, Math.round((st.width + 0.1) * 10) / 10) })}>+ Más ancha</Button>
            </div>
            <NumberField
              label="Ancho (m)"
              value={st.width}
              min={0.6}
              max={2.4}
              onChange={(width) => s.editStair(st.id, { width })}
            />
            {!st.exterior && (
              <>
                <NumberField
                  label="Posición X (m)"
                  value={st.x}
                  min={-30}
                  onChange={(x) => s.editStair(st.id, { x })}
                />
                <NumberField
                  label="Posición Z (m)"
                  value={st.z}
                  min={-30}
                  onChange={(z) => s.editStair(st.id, { z })}
                />
              </>
            )}
            {st.exterior && (
              <>
                <label className="text-xs">
                  Pared
                  <select
                    className="config-input mt-1"
                    value={st.wall ?? "edge-2"}
                    onChange={(e) => s.editStair(st.id, { wall: e.target.value })}
                  >
                    {designWalls(c, st.floor)
                      .filter((w) => w.id.startsWith("edge-"))
                      .map((w, i) => (
                        <option key={w.id} value={w.id}>
                          Lado {i + 1}
                        </option>
                      ))}
                  </select>
                </label>
                <NumberField
                  label="Posición en la pared (m)"
                  value={st.offset ?? 0}
                  min={-20}
                  onChange={(offset) => s.editStair(st.id, { offset })}
                />
                <p className="col-span-2 text-xs text-foreground/60">
                  {c.openings.some(
                    (o) =>
                      o.wall === st.wall &&
                      o.floor === st.floor &&
                      Math.abs(o.offset - (st.offset ?? 0)) < 0.8,
                  )
                    ? "Acceso junto a la puerta."
                    : "Conviene colocar una puerta en este acceso."}
                </p>
              </>
            )}
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => s.editStair(st.id, { rotation: st.rotation + Math.PI / 2 })}
            >
              Rotar 90°
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => s.editStair(st.id, { reverse: !st.reverse })}
            >
              Invertir subida
            </Button>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={st.closed}
              onChange={(e) => s.editStair(st.id, { closed: e.target.checked })}
            />
            Contrahuella cerrada
          </label>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={st.rail}
              onChange={(e) => s.editStair(st.id, { rail: e.target.checked })}
            />
            Baranda
          </label>
        </>
      )}
      {w && (
        <>
          <h4 className="text-sm">Pared interior</h4>
          <div className="grid grid-cols-2 gap-3">
            {(["a", "b"] as const).flatMap((k) =>
              (["x", "z"] as const).map((axis) => (
                <NumberField
                  key={k + axis}
                  label={`${k === "a" ? "Inicio" : "Fin"} ${axis.toUpperCase()} (m)`}
                  value={w[k][axis]}
                  min={-30}
                  onChange={(v) => s.editWall(w.id, { [k]: { ...w[k], [axis]: v } })}
                />
              )),
            )}
            <NumberField
              label="Espesor (m)"
              value={w.thickness}
              min={0.05}
              max={0.5}
              step={0.01}
              onChange={(thickness) => s.editWall(w.id, { thickness })}
            />
            <NumberField
              label="Altura (m)"
              value={w.height}
              min={1}
              max={2.65}
              onChange={(height) => s.editWall(w.id, { height })}
            />
          </div>
          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => s.splitWall(w.id)}
          >
            Cortar al medio
          </Button>
        </>
      )}
      {edge && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-11 text-xs"
            onClick={() => {
              const i = c.contour.findIndex((p) => p === edge.a),
                n = [...c.contour];
              n.splice(i + 1, 0, { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 });
              s.setContour(n);
            }}
          >
            Agregar vértice
          </Button>
        </div>
      )}
      {obj && (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            title="Duplicar"
            aria-label="Duplicar objeto"
            onClick={() => s.duplicateObject(obj.id)}
          >
            <Copy size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            title="Eliminar"
            aria-label="Eliminar objeto"
            onClick={() => s.deleteObject(obj.id)}
          >
            <Trash2 size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            title="Rotar 90°"
            aria-label="Rotar objeto"
            onClick={() => {
              if (co) s.editCounter(co.id, { rotation: co.rotation + Math.PI / 2 });
              if (st) s.editStair(st.id, { rotation: st.rotation + Math.PI / 2 });
              if (fx) s.editFixture(fx.id, { rotation: fx.rotation + Math.PI / 2 });
            }}
          >
            <RotateCw size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            title="Bloquear"
            aria-label="Bloquear objeto"
            onClick={lock}
          >
            {obj.locked ? <Lock size={16} /> : <Unlock size={16} />}
          </Button>
        </div>
      )}
      {s.tool === "measure" &&
        rooms.map((r, i) => (
          <label key={r.id} className="block text-xs">
            <span className="mb-1 block">{r.area.toFixed(2)} m²</span>
            <select
              className="config-input"
              value={roomName(c, s.activeFloor, r, i)}
              onChange={(e) =>
                s.update({ roomLabels: { ...c.roomLabels, [r.id]: e.target.value } })
              }
            >
              {["Dormitorio", "Baño", "Cocina-living-comedor", "Estar", "Circulación", "Otro"].map(
                (label) => (
                  <option key={label}>{label}</option>
                ),
              )}
            </select>
          </label>
        ))}
      {!isOrthogonal(c.contour) && (
        <p className="text-xs text-foreground/60">
          Doble agua disponible solamente en contornos ortogonales.
        </p>
      )}
      {s.error && (
        <p role="alert" className="text-xs text-destructive">
          {s.error}
        </p>
      )}
    </div>
  );
}
