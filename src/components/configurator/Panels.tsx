import { useMemo } from "react";
import { isOrthogonal } from "@/config/geometry";
import { Copy, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SYSTEMS, AREA_MIN, AREA_MAX, AREA_CONSULT_URL, formatUSD } from "@/lib/cotizador";
import {
  FINISH_NAMES,
  FOUNDATION_NAMES,
  RATES,
  configRate,
  roofName,
} from "@/config/pricing";
import { IncluyeAccordion } from "@/components/cotizador/PrecioTradicional";
import type { TradicionalId } from "@/config/tradicional";
import {
  FINISHES_BY_SYSTEM,
  FOUNDATIONS_BY_SYSTEM,
  allowedRoofs,
  exteriorThickness,
  systemOf,
} from "@/config/systems";
import { isLShape } from "@/config/layoutProposals";
import { OPENINGS_CATALOG, OPENING_TYPES } from "@/config/openingsCatalog";
import {
  designWalls,
  canUseFloors,
  houseDimensions,
  useConfigurator,
  placedRooms,
  type WallId,
} from "@/store/useConfigurator";
import { ExtrasSection } from "@/components/cotizador/ExtrasSection";
import { deckFrontSpan, resolveDeck } from "@/config/deckGeometry";
import { PAINT_TEXTOS } from "@/config/paint";
import { paintSurfacesOf } from "./paintSurfaces";
import { MaterialsSheet } from "./MaterialsSheet";
import { Summary } from "./Summary";
export const STEPS = [
  "Metraje",
  "Plantas",
  "Fundación",
  "Terminación",
  "Techo",
  "Aberturas",
  "Extras y opcionales",
  "Resumen",
];
const WALLS: { id: WallId; label: string }[] = [
  { id: "front", label: "Frente" },
  { id: "back", label: "Fondo" },
  { id: "left", label: "Izquierda" },
  { id: "right", label: "Derecha" },
  { id: "partition", label: "Interior" },
];
export function Panels({ step }: { step: number }) {
  const s = useConfigurator(),
    c = s.config,
    d = houseDimensions(c),
    selected = c.openings.find((o) => o.id === s.selectedId),
    system = systemOf(c.finish),
    inL = isLShape(c.contour);
  return (
    <div className="min-h-64 py-6">
      {step === 0 && (
        <>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="config-area" className="text-sm">
              Superficie total
            </label>
            <div className="flex items-center gap-2">
              <input
                id="config-area"
                type="number"
                min={AREA_MIN}
                max={AREA_MAX}
                className="config-input w-24 text-center"
                value={c.m2}
                onChange={(e) => s.update({ m2: Number(e.target.value) })}
              />
              <span className="text-sm">m²</span>
            </div>
          </div>
          <input
            aria-label="Superficie total en metros cuadrados"
            type="range"
            min={AREA_MIN}
            max={AREA_MAX}
            value={c.m2}
            onChange={(e) => s.update({ m2: Number(e.target.value) })}
            className="mt-5 h-11 w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-foreground/60">
            <span>{AREA_MIN} m²</span>
            <span>{AREA_MAX} m²</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-foreground/60">
            ¿Necesitás más de {AREA_MAX} m²?{" "}
            <a href={AREA_CONSULT_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
              Consultalo con SCH
            </a>
            .
          </p>
          <fieldset className="mt-7">
            <legend className="mb-3 text-xs text-foreground/70">Forma de la casa</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["compacta", "alargada", "L"] as const).map((v) => {
                const active = v === "L" ? inL : !inL && c.shape === v;
                return (
                  <Button
                    key={v}
                    variant={active ? "default" : "outline"}
                    className="min-h-12 px-1 text-sm capitalize"
                    aria-pressed={active}
                    onClick={() => s.applyShape(v)}
                  >
                    {v === "L" ? "En L" : v}
                  </Button>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-6 text-foreground/60">
              {inL
                ? "Casa en L: dos alas alrededor de un patio o jardín. Se aplicó la distribución recomendada; podés cambiarla en Distribuciones."
                : "La forma en L abre un patio de servicio y separa la zona social de los dormitorios."}
            </p>
          </fieldset>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-xs text-foreground/60">Ancho</dt>
              <dd className="mt-1">{d.width.toFixed(2)} m</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/60">Profundidad</dt>
              <dd className="mt-1">{d.depth.toFixed(2)} m</dd>
            </div>
          </dl>
        </>
      )}
      {step === 1 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <Button
                key={n}
                variant={n === c.floors ? "default" : "outline"}
                className="min-h-14"
                disabled={!canUseFloors(c.m2, n)}
                title={!canUseFloors(c.m2, n) ? "Mínimo 20 m² por planta" : undefined}
                aria-pressed={n === c.floors}
                onClick={() => s.update({ floors: n })}
              >
                {n} planta{n > 1 ? "s" : ""}
              </Button>
            ))}
          </div>
          <p className="mt-5 text-sm text-foreground/75">{d.area.toFixed(1)} m² por planta</p>
          <RoomPicker />
          <p className="mt-3 text-xs leading-6 text-foreground/60">
            Mínimo 20 m² por planta para viviendas de dos o tres plantas.
          </p>
        </>
      )}
      {step === 2 && (
        <>
          <label className="block text-xs">
            Suelo
            <select
              className="config-input mt-2 mb-4"
              value={c.ground}
              onChange={(e) =>
                s.update({ ground: e.target.value === "cesped" ? "cesped" : "arena" })
              }
            >
              <option value="arena">Suelo de arena</option>
              <option value="cesped">Suelo firme con césped</option>
            </select>
          </label>
          {c.foundation !== "platea" && (
            <label className="block text-xs mb-4">
              Altura de pilotes · {c.pileHeight.toFixed(2)} m
              <input
                className="h-11 w-full"
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={c.pileHeight}
                onChange={(e) => s.update({ pileHeight: Number(e.target.value) })}
              />
            </label>
          )}
          <div className="space-y-3">
            {FOUNDATIONS_BY_SYSTEM[system].map((id) => (
              <Button
                key={id}
                variant={c.foundation === id ? "default" : "outline"}
                className="min-h-14 w-full capitalize"
                aria-pressed={c.foundation === id}
                onClick={() => s.update({ foundation: id })}
              >
                {FOUNDATION_NAMES[id]}
              </Button>
            ))}
          </div>
          <p className="mt-5 text-xs leading-6 text-foreground/70">
            {system === "tradicional"
              ? "La construcción tradicional va sobre platea de hormigón. Si el terreno es de arena o costero, se puede elegir pilotes de hormigón."
              : "En suelo arenoso/costero recomendamos pilotes de hormigón o de madera curada"}
          </p>
          {c.foundation === "platea" && c.ground === "arena" && (
            <p className="mt-3 text-xs leading-6 text-foreground/70" role="note">
              La platea está pensada para suelo firme. Si tu terreno es de arena o costero, consultanos: en ese caso solemos
              recomendar pilotes de hormigón.
            </p>
          )}
          <Button
            className="mt-4 min-h-11 w-full"
            variant="outline"
            aria-pressed={s.underHouse}
            onClick={s.toggleUnder}
          >
            Ver bajo la casa
          </Button>
        </>
      )}
      {step === 3 && (
        <>
          <div className={`grid gap-2 ${FINISHES_BY_SYSTEM[system].length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {FINISHES_BY_SYSTEM[system].map((id) => (
              <Button
                key={id}
                variant={c.finish === id ? "default" : "outline"}
                className="h-auto min-h-16 flex-col gap-1 px-1 text-xs"
                aria-pressed={c.finish === id}
                onClick={() => s.update({ finish: id })}
              >
                {FINISH_NAMES[id]}
                <span className="text-[10px]">{formatUSD(configRate(id, c.m2))}/m²</span>
                {system === "tradicional" && configRate(id, c.m2) !== RATES[id] && (
                  <s className="text-[10px] font-normal opacity-60">{formatUSD(RATES[id])}/m²</s>
                )}
              </Button>
            ))}
          </div>
          {system === "tradicional" && (
            <>
              <p className="mt-4 text-xs leading-6 text-foreground/70">
                {SYSTEMS.tradicional.categories.find((x) => x.id === c.finish)?.interior}
              </p>
              {/* La bonificación por superficie y las exclusiones se muestran debajo del total (Summary). */}
              <IncluyeAccordion className="mt-3" variant="panel" option={c.finish as TradicionalId} />
            </>
          )}
          <MaterialsSheet finish={c.finish} />
        </>
      )}
      {step === 4 && (
        <>
          <div className={`grid gap-2 ${allowedRoofs(c.finish).length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {allowedRoofs(c.finish).map((id) => (
              <Button
                key={id}
                variant={c.roofType === id ? "default" : "outline"}
                className="min-h-12 text-xs"
                disabled={id === "dos" && !isOrthogonal(c.contour)}
                title={
                  id === "dos" && !isOrthogonal(c.contour)
                    ? "Doble agua requiere un contorno ortogonal"
                    : undefined
                }
                aria-pressed={c.roofType === id}
                onClick={() => s.update({ roofType: id })}
              >
                {roofName(id, c.finish)}
              </Button>
            ))}
          </div>
          {system === "tradicional" && (
            <p className="mt-3 text-xs leading-6 text-foreground/70">
              {c.finish === "clasica"
                ? "La Clásica lleva losa llena de hormigón armado ejecutada en obra, con antepecho, aislación térmica e impermeabilización de azotea con membrana asfáltica (planta baja)."
                : "La Esencial lleva techo liviano: estructura de madera 100% curada, aislación térmica/hidrófuga reforzada y cubierta de chapa con zinguería completa (cenefa y canaleta)."}
            </p>
          )}
          {c.finish !== "clasica" && (
          <>
          <label className="block mt-4 text-xs">
            Dirección
            <select
              className="config-input mt-1"
              value={c.roofDirection}
              onChange={(e) => s.update({ roofDirection: e.target.value === "z" ? "z" : "x" })}
            >
              <option value="x">Eje X</option>
              <option value="z">Eje Z</option>
            </select>
          </label>
          <label className="block mt-4 text-xs">
            Alero · {c.overhang.toFixed(2)} m
            <input
              className="h-11 w-full"
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={c.overhang}
              onChange={(e) => s.update({ overhang: Number(e.target.value) })}
            />
          </label>
          </>
          )}
          {c.roofType !== "plano" && (
            <label className="mt-6 block text-sm">
              Pendiente · {c.roofPitch}°
              <input
                type="range"
                min={5}
                max={system === "tradicional" ? 25 : 40}
                value={c.roofPitch}
                className="mt-3 h-11 w-full accent-primary"
                onChange={(e) => s.update({ roofPitch: Number(e.target.value) })}
              />
            </label>
          )}
        </>
      )}
      {step === 5 && (
        <>
          <label className="block text-xs text-foreground/70">
            Planta
            <select
              className="config-input mt-2"
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
          <div className="mt-4 grid grid-cols-2 gap-2">
            {OPENING_TYPES.map((type) => (
              <Button
                key={type}
                variant={s.placing === type ? "default" : "outline"}
                className="min-h-11 justify-start gap-2 whitespace-normal text-left text-xs"
                aria-pressed={s.placing === type}
                onClick={() => s.setPlacing(s.placing === type ? null : type)}
              >
                <Plus size={14} className="shrink-0" />
                {OPENINGS_CATALOG[type].name}
              </Button>
            ))}
          </div>
          {s.placing && (
            <Button
              variant="ghost"
              className="mt-2 min-h-11 w-full"
              onClick={() => s.setPlacing(null)}
            >
              <X size={14} />
              Cancelar colocación
            </Button>
          )}
          <div className="mt-5 max-h-40 space-y-1 overflow-y-auto">
            {c.openings
              .filter((o) => o.floor === s.activeFloor)
              .map((o, i) => (
                <Button
                  key={o.id}
                  variant={o.id === s.selectedId ? "secondary" : "ghost"}
                  className="min-h-11 w-full justify-between text-xs"
                  onClick={() => s.select(o.id)}
                >
                  <span>
                    {OPENINGS_CATALOG[o.type].name} {i + 1}
                  </span>
                  <span className="text-foreground/60">
                    {WALLS.find((w) => w.id === o.wall)?.label}
                  </span>
                </Button>
              ))}
          </div>
          {selected && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <label className="block text-xs">
                Tipo
                <select
                  className="config-input mt-2"
                  value={selected.type}
                  onChange={(e) => {
                    const type = OPENING_TYPES.find((t) => t === e.target.value);
                    if (type) s.editOpening(selected.id, { type });
                  }}
                >
                  {OPENING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {OPENINGS_CATALOG[t].name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                Muro
                <select
                  className="config-input mt-2"
                  value={selected.wall}
                  onChange={(e) => {
                    const wall = WALLS.find((w) => w.id === e.target.value);
                    if (wall) s.editOpening(selected.id, { wall: wall.id });
                  }}
                >
                  {designWalls(c, s.activeFloor).map((w, i) => (
                    <option key={w.id} value={w.id}>
                      {w.id.startsWith("edge-") ? `Exterior ${i + 1}` : `Interior ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                Posición desde el centro (m)
                <input
                  className="config-input mt-2"
                  type="number"
                  step={0.1}
                  value={selected.offset}
                  onChange={(e) => s.editOpening(selected.id, { offset: Number(e.target.value) })}
                />
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={() => s.duplicateOpening(selected.id)}
                >
                  <Copy size={15} />
                  Duplicar
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Eliminar abertura"
                  title="Eliminar abertura"
                  onClick={() => s.deleteOpening(selected.id)}
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            </div>
          )}
          {!selected && (
            <Button
              variant="outline"
              className="mt-3 min-h-11 w-full text-xs"
              disabled={!s.placing}
              onClick={() => {
                const type = s.placing;
                if (!type) return;
                const spec = OPENINGS_CATALOG[type];
                s.addOpening({
                  type,
                  floor: s.activeFloor,
                  wall: spec.walls === "interior" ? "partition" : "left",
                  offset: 0,
                });
              }}
            >
              <Plus size={15} />
              Agregar en posición central
            </Button>
          )}
        </>
      )}
      {step === 6 && <ExtrasStep />}
      {step === 7 && <Summary full />}
      {s.error && (
        <p role="alert" className="mt-4 text-xs leading-6 text-destructive">
          {s.error}
        </p>
      )}
    </div>
  );
}

/**
 * Paso «Extras y opcionales»: los mismos extras del cotizador (deck y pintura), leyendo y guardando en el diseño. La pintura
 * se mide sobre las paredes reales del diseño y el color elegido se ve enseguida sobre la casa en 3D.
 */
function ExtrasStep() {
  const config = useConfigurator((s) => s.config),
    setDeck = useConfigurator((s) => s.setDeck),
    setPaint = useConfigurator((s) => s.setPaint),
    setView = useConfigurator((s) => s.setView),
    { deck: stored, contour, finish, logistics, paint } = config,
    thickness = exteriorThickness(finish),
    deck = resolveDeck(stored, contour, thickness),
    frontLength = deckFrontSpan(contour, thickness)?.length ?? null,
    // Medir las paredes recorre el diseño: solo se hace con la pintura agregada.
    surfaces = useMemo(() => (paint.enabled ? paintSurfacesOf(config) : { exterior: 0, interior: 0 }), [config, paint.enabled]);
  return (
    <ExtrasSection
      variant="panel"
      idPrefix="config-extras"
      logistics={logistics}
      deck={deck}
      // Al dejar de cubrir todo el frente, el deck conserva el ancho que tenía en ese momento (no salta a otra medida).
      onDeckChange={(patch) => setDeck(patch.fullFront === false && patch.width === undefined ? { ...patch, width: deck.width } : patch)}
      frontLength={frontLength === null ? null : Math.round(frontLength * 100) / 100}
      paint={paint}
      onPaintChange={setPaint}
      paintOptions={[{ finish, name: FINISH_NAMES[finish], surfaces }]}
      paintNota={PAINT_TEXTOS.superficieDiseno}
      onPaintLook={(zone) => setView(zone)}
    />
  );
}

function RoomPicker() {
  const s = useConfigurator(),
    c = s.config,
    placed = placedRooms(c);
  return (
    <div className="mt-6 space-y-4">
      <p className="text-xs text-foreground/70">Cada diseño incluye cocina-living-comedor. Elegí dormitorios (cama matrimonial) y baños (WC, ducha y lavamanos sobre mesada de pino).</p>
      {([["bedrooms", "Dormitorios", [1, 2, 3, 4, 5, 6]], ["bathrooms", "Baños", [1, 2, 3, 4]]] as const).map(([key, label, opts]) => (
        <div key={key}>
          <p className="mb-2 text-xs font-medium">{label}</p>
          <div className={opts.length > 4 ? "grid grid-cols-3 gap-2" : "grid grid-cols-4 gap-2"}>
            {opts.map((n) => (
              <Button
                key={n}
                variant={n === c[key] ? "default" : "outline"}
                className="min-h-11"
                aria-pressed={n === c[key]}
                onClick={() => s.setRooms({ [key]: n })}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
      ))}
      {(placed.bedrooms < c.bedrooms || placed.bathrooms < c.bathrooms) && (
        <p role="status" className="text-xs text-destructive">
          Con esta superficie entran {placed.bedrooms} dormitorio(s) y {placed.bathrooms} baño(s). Sumá m² o una planta para el resto.
        </p>
      )}
    </div>
  );
}
