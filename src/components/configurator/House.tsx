import { useEffect, useMemo, useState, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import polygonClipping from "polygon-clipping";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { drawMaterial, FINISH_MATERIALS, type MaterialKind } from "@/config/materials";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { Html } from "@react-three/drei";
import { createPBR, pbrProps, disposePBR, loadPBR, repeatPBR } from "./pbr";
import { SceneEditor, useObjectDrag } from "./SceneEditor";
import { sceneGlow } from "@/store/useEntorno";
import { Button } from '@/components/ui/button';
import {
  GEOMETRY,
  bounds,
  inside,
  miterPolygon,
  detectRooms,
  stairGeometry,
  unionHoles,
  roofFaces,
  offsetContour,
  planeHeight,
  type RoofFace,
  isOrthogonal,
  distance,
  project,
  validateStair,
  exteriorStairPose,
  type Point,
  type Segment,
  type Counter,
  type Fixture,
  FIXTURE_SIZES,
  type Stair,
} from "@/config/geometry";
import { EXTERIOR_THICKNESS, PLATEA_HEIGHT, exteriorThickness, systemOf } from "@/config/systems";
import { TraditionalEnvelope } from "./TraditionalEnvelope";
import {
  floorBase,
  foundationHeight,
  designWalls,
  resolveWall,
  FLOOR_BASE,
  FLOOR_STEP,
  WALL_HEIGHT,
  houseDimensions,
  snapOffset,
  validateOpening,
  useConfigurator,
  roomName,
  type HouseConfig,
  type Opening,
  type WallId,
} from "@/store/useConfigurator";

export type ScenePalette = {
  sky: string;
  trim: string;
  glass: string;
  light: string;
  warm: string;
  fabric: string;
  accent: string;
  invalid: string;
};
type Vec3 = [number, number, number];
/**
 * Material PBR de la casa. Arranca con una muestra provisoria dibujada en el navegador y, en cuanto se descargan,
 * pasa a los mapas reales (color + normal + rugosidad/oclusión) de `public/textures/`, compartidos entre todas las piezas.
 * Si la descarga falla queda la provisoria.
 */
function useMaterial(kind: MaterialKind) {
  const low = useMemo(() => window.matchMedia("(max-width:767px)").matches, []);
  const placeholder = useMemo(() => createPBR(kind, 256), [kind]);
  useEffect(() => () => disposePBR(placeholder), [placeholder]);
  const [loaded, setLoaded] = useState<{ kind: MaterialKind; map: THREE.Texture } | null>(null);
  useEffect(() => {
    let alive = true;
    const handle = loadPBR(kind, low);
    handle.promise.then((map) => { if (alive) setLoaded({ kind, map }); }).catch(() => undefined);
    return () => {
      alive = false;
      handle.release();
      setLoaded((current) => (current && current.kind === kind ? null : current));
    };
  }, [kind, low]);
  return loaded && loaded.kind === kind ? loaded.map : placeholder;
}
function Box({
  size,
  position,
  map,
  color,
  rotation = [0, 0, 0],
}: {
  size: Vec3;
  position: Vec3;
  map?: THREE.Texture;
  color?: string;
  rotation?: Vec3;
}) {
  const geometry=useMemo(()=>{const g=new THREE.BoxGeometry(...size),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++){if(Math.abs(n.getY(i))>0.5)uv.setXY(i,p.getX(i),p.getZ(i));else if(Math.abs(n.getX(i))>0.5)uv.setXY(i,p.getZ(i),p.getY(i));else uv.setXY(i,p.getX(i),p.getY(i));}return g;},[size[0],size[1],size[2]]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return (
    <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow>
      <meshStandardMaterial
        {...pbrProps(map)}
        {...(map ? { map } : {})}
        {...(color ? { color } : {})}
        roughness={map ? 1 : 0.8}
      />
    </mesh>
  );
}
function MergedBoxes({
  boxes,
  map,
  color,
}: {
  boxes: { size: Vec3; pos: Vec3 }[];
  map?: THREE.Texture;
  color?: string;
}) {
  const geometry = useMemo(() => {
    const geos = boxes.map((b) => {
      const g = new THREE.BoxGeometry(...b.size);
      g.translate(...b.pos);
      const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
      for(let i=0;i<uv.count;i++)uv.setXY(i,Math.abs(n.getY(i))>0.5?p.getX(i):Math.abs(n.getX(i))>0.5?p.getZ(i):p.getX(i),Math.abs(n.getY(i))>0.5?p.getZ(i):p.getY(i));
      return g;
    });
    const merged = geos.length ? mergeGeometries(geos) : null;
    geos.forEach((g) => g.dispose());
    return merged;
  }, [boxes]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        {...pbrProps(map)}
        {...(map ? { map } : {})}
        {...(color ? { color } : {})}
        roughness={map ? 1 : 0.8}
      />
    </mesh>
  );
}
export function Ground({ underHouse }: { underHouse: boolean }) {
  const ground = useConfigurator((s) => s.config.ground);
  const map = useMaterial(ground === "arena" ? "arena" : "pasto");
  // El plano mide 80 m y su UV va de 0 a 1: la repetición se aplica a TODOS los mapas (color, normal, rugosidad, oclusión).
  const groundMap = useMemo(() => repeatPBR(map, 80), [map]);
  useEffect(() => () => disposePBR(groundMap), [groundMap]);
  return (
    <group>
    <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial
        map={groundMap}
        {...pbrProps(groundMap)}
        roughness={1}
        transparent={underHouse}
        opacity={underHouse ? 0.18 : 1}
        depthWrite={!underHouse}
      />
    </mesh>
    <GroundGrass hidden={underHouse} sand={ground==='arena'} />
    </group>
  );
}
function GroundGrass({hidden,sand}:{hidden:boolean;sand:boolean}){
  const c=useConfigurator(s=>s.config);
  const geometry=useMemo(()=>{
    const b=bounds(c.contour),pts:number[]=[],uv:number[]=[],colors:number[]=[];
    let seed=42;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const count=window.matchMedia('(max-width:767px)').matches?800:2800;
    for(let i=0;i<count;i++){
      const x=b.minX-3+rand()*(b.width+6),z=b.minZ-3+rand()*(b.depth+6);
      if(inside({x,z},c.contour)||sand&&rand()>0.06)continue;
      const angle=rand()*Math.PI,w=0.014,h=(sand?0.16:0.045)+rand()*(sand?0.2:0.075),dx=Math.cos(angle)*w,dz=Math.sin(angle)*w;
      pts.push(x-dx,0.005,z-dz,x+dx,0.005,z+dz,x+dx*3,h,z+dz*3);uv.push(0,0,1,0,0.5,1);
      const tone=0.7+rand()*0.6,root=sand?[0.1,0.09,0.03]:[0.018,0.05,0.01],tip=sand?[0.3,0.26,0.09]:[0.09,0.2,0.03];
      colors.push(root[0]*tone,root[1]*tone,root[2]*tone,root[0]*tone,root[1]*tone,root[2]*tone,tip[0]*tone,tip[1]*tone,tip[2]*tone);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
  },[c.contour,sand]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group position={[c.position.x,0,c.position.z]} rotation-y={-c.rotation} visible={!hidden}><mesh geometry={geometry}><meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.9}/></mesh></group>;
}
const NO_HOLES: Point[][] = [];
function Foundation({ c }: { c: HouseConfig }) {
  const platea = c.foundation === "platea";
  const map = useMaterial(c.foundation === "madera" ? "maderaPilote" : "hormigon");
  const { width, depth } = houseDimensions(c);
  const height = foundationHeight(c);
  // La platea sobresale de la cara exterior del muro unos centímetros, como el cimiento perimetral.
  const plinth = useMemo(() => offsetContour(c.contour, exteriorThickness(c.finish) / 2 + 0.08), [c.contour, c.finish]);
  const boxes = useMemo(() => {
    if (platea) return [];
    const nx = Math.max(2, Math.ceil(width / 2.4) + 1),
      nz = Math.max(2, Math.ceil(depth / 2.4) + 1);
    return Array.from({ length: nx * nz }, (_, i) => ({
      size: [0.24, height, 0.24] as Vec3,
      pos: [
        bounds(c.contour).minX + 0.3 + ((i % nx) * (width - 0.6)) / (nx - 1),
        height / 2,
        bounds(c.contour).minZ + 0.3 + (Math.floor(i / nx) * (depth - 0.6)) / (nz - 1),
      ] as Vec3,
    }));
  }, [platea, width, depth, height]);
  if (platea)
    return <FloorSlab contour={plinth} holes={NO_HOLES} map={map} y={PLATEA_HEIGHT} thickness={PLATEA_HEIGHT} />;
  return (
    <MergedBoxes
      boxes={boxes.filter((b) => inside({ x: b.pos[0], z: b.pos[2] }, c.contour))}
      map={map}
    />
  );
}
function OpeningModel({
  opening,
  palette,
  ghost = false,
  invalid = false,
  onDrag,
}: {
  opening: Opening;
  palette: ScenePalette;
  ghost?: boolean;
  invalid?: boolean;
  onDrag?: (id: string) => void;
}) {
  const selected = useConfigurator((s) => s.selectedId === opening.id),
    select = useConfigurator((s) => s.select);
  const s = OPENINGS_CATALOG[opening.type],
    y = s.sill + s.height / 2;
  // De noche las ventanas se iluminan con el nivel que calcula el cielo (ver Entorno.tsx). Las puertas macizas no cambian.
  const pane = useRef<THREE.MeshStandardMaterial>(null);
  const isWindow = !s.door || opening.type === "ventanal";
  useFrame(() => {
    const m = pane.current;
    if (!m || !isWindow || ghost) return;
    const v = sceneGlow.level * 0.9;
    if (Math.abs(m.emissiveIntensity - v) > 0.002) m.emissiveIntensity = v;
  });
  const color = invalid ? palette.invalid : ghost || selected ? palette.accent : palette.trim;
  // En una casa tradicional los muros son gruesos: la carpintería queda retranqueada hacia adentro (se ven las jambas
  // del muro) y las ventanas llevan alféizar de hormigón. En woodframe todo queda como antes.
  const masonry =
    useConfigurator((st) => systemOf(st.config.finish) === "tradicional") &&
    opening.wall !== "partition" &&
    !opening.wall.startsWith("wall-");
  const depth = masonry ? 0.1 : 0.22,
    zc = masonry ? -EXTERIOR_THICKNESS.tradicional / 2 + 0.07 + depth / 2 : 0;
  const frames = useMemo(
    () => [
      { size: [s.width + 0.1, 0.07, depth] as Vec3, pos: [0, s.sill + s.height, 0] as Vec3 },
      { size: [s.width + 0.1, 0.07, depth] as Vec3, pos: [0, s.sill, 0] as Vec3 },
      { size: [0.07, s.height, depth] as Vec3, pos: [-s.width / 2, y, 0] as Vec3 },
      { size: [0.07, s.height, depth] as Vec3, pos: [s.width / 2, y, 0] as Vec3 },
      ...(!s.door || opening.type === "ventanal"
        ? [{ size: [0.045, s.height, masonry ? 0.08 : 0.15] as Vec3, pos: [0, y, 0] as Vec3 }]
        : []),
    ],
    [s.width, s.height, s.sill, s.door, opening.type, y, depth, masonry],
  );
  return (
    <group
      position-x={opening.offset}
      onClick={(e) => {
        e.stopPropagation();
        if (!ghost) select(opening.id);
      }}
      onPointerDown={(e) => {
        if (ghost) return;
        e.stopPropagation();
        const wasSelected = useConfigurator.getState().selectedId === opening.id;
        select(opening.id);
        if (wasSelected) onDrag?.(opening.id);
      }}
    >
      {masonry && !s.door && (
        <Box
          size={[s.width + 0.16, 0.05, 0.17]}
          position={[0, s.sill - 0.025, -EXTERIOR_THICKNESS.tradicional / 2 - 0.03 + 0.085]}
          color="#cdc8bf"
        />
      )}
      <group position-z={zc}>
        <MergedBoxes boxes={frames} color={color} />
        <mesh position={[0, y, 0]}>
          <boxGeometry args={[s.width - 0.08, s.height - 0.08, 0.05]} />
          <meshStandardMaterial
            ref={pane}
            emissive="#ffcf86"
            emissiveIntensity={0}
            color={s.door && opening.type !== "ventanal" ? palette.warm : palette.glass}
            roughness={s.door ? 0.65 : 0.12}
            metalness={s.door ? 0.05 : 0.25}
            transparent
            opacity={ghost ? 0.45 : s.door && opening.type !== "ventanal" ? 1 : 0.28}
            depthWrite={!ghost && s.door}
          />
        </mesh>
        {s.door && opening.type !== "ventanal" && (
          <Box
            size={[0.12, 0.035, 0.07]}
            position={[s.width / 2 - 0.16, 1, 0.1]}
            color={palette.trim}
          />
        )}
      </group>
    </group>
  );
}
function wallTransform(
  c: HouseConfig,
  wall: WallId,
  floor = 0,
): { pos: Vec3; angle: number; length: number } {
  const w = resolveWall(c, wall, floor);
  if (!w) return { pos: [0, 0, 0], angle: 0, length: 0 };
  return {
    pos: [(w.a.x + w.b.x) / 2, 0, (w.a.z + w.b.z) / 2],
    angle: -Math.atan2(w.b.z - w.a.z, w.b.x - w.a.x),
    length: distance(w.a, w.b),
  };
}
function Wall({
  c,
  wall,
  floor,
  interiorMap,
  sidingMap,
  palette,
  dragging,
  setDragging,
}: {
  c: HouseConfig;
  wall: WallId;
  floor: number;
  interiorMap: THREE.Texture;
  sidingMap: THREE.Texture;
  palette: ScenePalette;
  dragging: string | null;
  setDragging: (v: string | null) => void;
}) {
  const placing = useConfigurator((s) => s.placing),
    add = useConfigurator((s) => s.addOpening),
    edit = useConfigurator((s) => s.editOpening);
  const [ghost, setGhost] = useState<Opening | null>(null);
  const { pos, angle, length } = wallTransform(c, wall, floor);
  const openings = c.openings.filter(
    (o) => resolveWall(c, o.wall, o.floor)?.id === wall && o.floor === floor,
  );
  const wallData = resolveWall(c, wall, floor),
    interior = wall.startsWith("wall-"),
    selected = useConfigurator((s) => s.selectedId === wall);
  const drag = useObjectDrag(
    wall,
    pos[0],
    pos[2],
    floorBase(c) + floor * FLOOR_STEP,
    (p) => {
      if (!wallData) return;
      let dx = p.x - pos[0],
        dz = p.z - pos[2];
      if(!interior && c.orthogonal){if(Math.abs(wallData.a.x-wallData.b.x)<1e-6)dz=0;else dx=0;}
      if (interior)
        useConfigurator
          .getState()
          .editWall(wall, {
            a: { x: wallData.a.x + dx, z: wallData.a.z + dz },
            b: { x: wallData.b.x + dx, z: wallData.b.z + dz },
          });
      else {
        const n = c.contour.map((v) =>
          distance(v, wallData.a) < 1e-6 || distance(v, wallData.b) < 1e-6
            ? { x: v.x + dx, z: v.z + dz }
            : v,
        );
        useConfigurator.getState().setContour(n);
      }
    },
    wallData?.locked,
  );
  const thickness = wallData?.thickness ?? 0.15;
  const wallHeight=wallData?.height??WALL_HEIGHT;
  const solidGeometry=useMemo(()=>{
    if(!wallData)return null;
    const ring=miterPolygon(wallData,designWalls(c,floor)).map(p=>{const dx=p.x-pos[0],dz=p.z-pos[2];return {x:dx*Math.cos(angle)-dz*Math.sin(angle),z:dx*Math.sin(angle)+dz*Math.cos(angle)};});
    const cuts=[Math.min(...ring.map(p=>p.x)),Math.max(...ring.map(p=>p.x)),...openings.flatMap(o=>[o.offset-OPENINGS_CATALOG[o.type].width/2,o.offset+OPENINGS_CATALOG[o.type].width/2])].sort((a,b)=>a-b), geos:THREE.BufferGeometry[]=[];
    for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1];if(a===undefined||b===undefined||b-a<1e-8)continue;const mid=(a+b)/2,o=openings.find(o=>Math.abs(o.offset-mid)<OPENINGS_CATALOG[o.type].width/2),spec=o?OPENINGS_CATALOG[o.type]:null;
      const bands=spec?[[0,spec.sill],[spec.sill+spec.height,wallHeight]]:[[0,wallHeight]];
      const clipped=polygonClipping.intersection([ring.map(p=>[p.x,p.z] as [number,number])],[[[a,-3],[b,-3],[b,3],[a,3]]]);
      for(const poly of clipped)for(const [low,high] of bands){if(low===undefined||high===undefined||high-low<1e-6)continue;const points=(poly[0]??[]).slice(0,-1).map(v=>new THREE.Vector2(v[0],v[1]));const sh=new THREE.Shape(points),g=new THREE.ExtrudeGeometry(sh,{depth:high-low,bevelEnabled:false});g.rotateX(-Math.PI/2);g.scale(1,1,-1);flipWinding(g);g.translate(0,low,0);const pos=g.getAttribute('position'),uv=g.getAttribute('uv');for(let j=0;j<uv.count;j++)uv.setXY(j,pos.getX(j),pos.getY(j));geos.push(g);}
    }
    const g=geos.length?mergeGeometries(geos):null;geos.forEach(g=>g.dispose());return g;
  },[wallData?.a.x,wallData?.a.z,wallData?.b.x,wallData?.b.z,thickness,wallHeight,c.contour,c.walls,openings.map(o=>`${o.id}-${o.type}-${o.offset}`).join('|')]);
  useEffect(()=>()=>solidGeometry?.dispose(),[solidGeometry]);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-length / 2, 0);
    s.lineTo(length / 2, 0);
    s.lineTo(length / 2, wallHeight);
    s.lineTo(-length / 2, wallHeight);
    s.closePath();
    for (const o of openings) {
      const spec = OPENINGS_CATALOG[o.type],
        x = o.offset - spec.width / 2,
        y = Math.max(0.001, spec.sill);
      const hole = new THREE.Path();
      hole.moveTo(x, y);
      hole.lineTo(x, y + spec.height);
      hole.lineTo(x + spec.width, y + spec.height);
      hole.lineTo(x + spec.width, y);
      hole.closePath();
      s.holes.push(hole);
    }
    return s;
  }, [length, openings.map((o) => `${o.id}-${o.type}-${o.offset}`).join("|")]);
  const candidate = (e: ThreeEvent<PointerEvent | MouseEvent>): Opening | null => {
    const old = c.openings.find((o) => o.id === dragging),
      type = placing ?? old?.type;
    if (!type) return null;
    const parent = e.object.parent;
    if (!parent) return null;
    const local = parent.worldToLocal(e.point.clone());
    return {
      id: dragging ?? "ghost",
      type,
      wall,
      floor,
      offset: snapOffset(local.x),
      manual: true,
    };
  };
  const invalid = ghost ? validateOpening(c, ghost, dragging ?? "ghost") : null;
  return (
    <group position={drag.preview ? [drag.preview.x, 0, drag.preview.z] : pos} rotation-y={angle}>
      <mesh {...drag.handlers} {...(solidGeometry?{geometry:solidGeometry}:{})} castShadow receiveShadow>
        <meshStandardMaterial
          {...pbrProps(interior?interiorMap:sidingMap)}
          map={interior ? interiorMap : sidingMap}
          {...(selected ? { emissive: palette.accent, emissiveIntensity: 0.15 } : {})}
          side={THREE.DoubleSide}
          roughness={1}
        />
      </mesh>
      {!interior && (
        <mesh position-z={thickness / 2 + 0.002}>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial {...pbrProps(interiorMap)} map={interiorMap} side={THREE.FrontSide} roughness={1} />
        </mesh>
      )}
      {openings.map((o) => (
        <OpeningModel key={o.id} opening={o} palette={palette} onDrag={setDragging} />
      ))}
      {(placing || dragging) && (
        <mesh
          position={[0, WALL_HEIGHT / 2, 0.13]}
          onPointerMove={(e) => {
            e.stopPropagation();
            const o = candidate(e);
            if (o) setGhost(o);
          }}
          onPointerOut={() => setGhost(null)}
          onPointerUp={(e) => {
            e.stopPropagation();
            const o = candidate(e);
            if (!o) return;
            if (dragging) {
              edit(dragging, o);
              setDragging(null);
            } else add(o);
            setGhost(null);
          }}
        >
          <planeGeometry args={[length, WALL_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {ghost && <OpeningModel opening={ghost} palette={palette} ghost invalid={!!invalid} />}
    </group>
  );
}
function FloorSlab({
  contour,
  holes,
  map,
  y,
  thickness,
}: {
  contour: Point[];
  holes: Point[][];
  map: THREE.Texture;
  y: number;
  thickness: number;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape(contour.map((p) => new THREE.Vector2(p.x, -p.z)));
    for (const ring of unionHoles(holes)) {
      const h = new THREE.Path(ring.map((p) => new THREE.Vector2(p.x, -p.z)));
      s.holes.push(h);
    }
    return s;
  }, [contour, holes]);
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    const uv = g.getAttribute("uv"),
      pos = g.getAttribute("position");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [shape, thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      position-y={y - thickness}
      geometry={geometry}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial {...pbrProps(map)} map={map} roughness={1} />
    </mesh>
  );
}
function CounterModel({ counter: v, palette }: { counter: Counter; palette: ScenePalette }) {
  const s = useConfigurator(),
    map = useMaterial(v.material === "pino" ? "pisoPino" : "drywall"),
    drag = useObjectDrag(
      v.id,
      v.x,
      v.z,
      floorBase(s.config) + v.floor * FLOOR_STEP,
      (p) => s.editCounter(v.id, p),
      v.locked,
    ),
    p = drag.preview ?? v,
    selected = s.selectedId === v.id;
  const [rotPreview, setRotPreview] = useState<number | null>(null);
  return (
    <group position={[p.x, 0, p.z]} rotation-y={-(rotPreview ?? v.rotation)} {...drag.handlers}>
      <Box
        size={[v.length, v.height - 0.06, v.depth]}
        position={[0, (v.height - 0.06) / 2, 0]}
        map={map}
      />
      <Box
        size={[v.length + 0.02, 0.06, v.depth + 0.02]}
        position={[0, v.height - 0.03, 0]}
        map={map}
      />
      {v.kind === "bano" && (
        <group position={[0, v.height, 0]}>
          <mesh position={[0, 0.06, 0]} castShadow>
            <cylinderGeometry args={[Math.min(0.2, v.depth * 0.4), Math.min(0.16, v.depth * 0.32), 0.12, 24]} />
            <meshStandardMaterial color={palette.light} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.2, -v.depth / 2 + 0.06]}>
            <cylinderGeometry args={[0.015, 0.015, 0.28, 8]} />
            <meshStandardMaterial color={palette.trim} metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      )}
      {v.kind === "cocina" && (
        <group position={[Math.min(v.length * 0.25, v.length / 2 - 0.35), v.height, 0]}>
          <mesh position={[0, -0.005, 0.03]}>
            <boxGeometry args={[0.5, 0.012, Math.min(0.4, v.depth * 0.7)]} />
            <meshStandardMaterial color={palette.trim} metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.0, 0.03]}>
            <boxGeometry args={[0.44, 0.014, Math.min(0.34, v.depth * 0.6)]} />
            <meshStandardMaterial color={palette.light} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.15, -v.depth / 2 + 0.07]} castShadow>
            <cylinderGeometry args={[0.018, 0.022, 0.3, 10]} />
            <meshStandardMaterial color={palette.trim} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.3, -v.depth / 2 + 0.15]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.014, 0.014, 0.17, 10]} />
            <meshStandardMaterial color={palette.trim} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.27, -v.depth / 2 + 0.23]}>
            <cylinderGeometry args={[0.014, 0.014, 0.07, 10]} />
            <meshStandardMaterial color={palette.trim} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      )}
      {v.shape === "L" && (
        <Box
          size={[v.depth, v.height, v.length * 0.65]}
          position={[-v.length / 2 + v.depth / 2, v.height / 2, v.length * 0.325 + v.depth / 2]}
          map={map}
        />
      )}{" "}
      {selected && (
        <group>
        <mesh position={[0, v.height + 0.02, 0]}>
          <boxGeometry args={[v.length + 0.04, 0.025, v.depth + 0.04]} />
          <meshBasicMaterial color={palette.accent} wireframe />
        </mesh>
        {(['length','depth','height'] as const).map(axis=><CounterHandle key={axis} counter={v} axis={axis} accent={palette.accent} />)}
        {!v.locked && <StairRotateHandle rotation={v.rotation} invalid={false} label="Rotar mesada libremente" y={v.height + 0.6} onPreview={setRotPreview} onCommit={r=>{s.editCounter(v.id,{rotation:r});setRotPreview(null);}} />}
        </group>
      )}
    </group>
  );
}
function FixtureModel({ fixture: v, palette }: { fixture: Fixture; palette: ScenePalette }) {
  const s = useConfigurator(),
    map = useMaterial("pisoPino"),
    drag = useObjectDrag(v.id, v.x, v.z, floorBase(s.config) + v.floor * FLOOR_STEP, (p) => s.editFixture(v.id, p), v.locked),
    p = drag.preview ?? v,
    size = FIXTURE_SIZES[v.kind],
    selected = s.selectedId === v.id,
    ceramic = palette.light;
  const [rotPreview, setRotPreview] = useState<number | null>(null);
  return (
    <group position={[p.x, 0, p.z]} rotation-y={-(rotPreview ?? v.rotation)} {...drag.handlers}>
      {v.kind === "wc" && (
        <>
          <Box size={[0.38, 0.32, 0.18]} position={[0, 0.62, -0.26]} color={ceramic} />
          <mesh position={[0, 0.2, 0.06]} castShadow>
            <cylinderGeometry args={[0.18, 0.13, 0.4, 20]} />
            <meshStandardMaterial color={ceramic} roughness={0.25} />
          </mesh>
          <Box size={[0.38, 0.03, 0.44]} position={[0, 0.415, 0.05]} color={ceramic} />
        </>
      )}
      {v.kind === "ducha" && (
        <>
          <Box size={[0.9, 0.06, 0.9]} position={[0, 0.03, 0]} color={ceramic} />
          <mesh position={[0.43, 1.05, 0]}>
            <boxGeometry args={[0.02, 1.95, 0.9]} />
            <meshStandardMaterial color={palette.glass} transparent opacity={0.35} roughness={0.05} />
          </mesh>
          <mesh position={[0, 1.05, 0.44]}>
            <boxGeometry args={[0.5, 1.95, 0.02]} />
            <meshStandardMaterial color={palette.glass} transparent opacity={0.35} roughness={0.05} />
          </mesh>
          <mesh position={[0, 2.05, -0.38]}>
            <cylinderGeometry args={[0.1, 0.1, 0.02, 20]} />
            <meshStandardMaterial color={palette.trim} metalness={0.8} roughness={0.3} />
          </mesh>
        </>
      )}
      {v.kind === "cama" && (
        <>
          <Box size={[1.5, 0.3, 2.0]} position={[0, 0.15, 0]} map={map} />
          <Box size={[1.4, 0.22, 1.9]} position={[0, 0.41, 0.02]} color={palette.light} />
          <Box size={[1.42, 0.06, 1.25]} position={[0, 0.54, 0.35]} color={palette.fabric} />
          <Box size={[0.55, 0.12, 0.35]} position={[-0.35, 0.58, -0.7]} color={palette.light} />
          <Box size={[0.55, 0.12, 0.35]} position={[0.35, 0.58, -0.7]} color={palette.light} />
          <Box size={[1.5, 0.9, 0.06]} position={[0, 0.45, -0.98]} map={map} />
        </>
      )}
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[size.width + 0.1, size.depth + 0.1]} />
          <meshBasicMaterial color={palette.accent} wireframe />
        </mesh>
      )}
      {selected && !v.locked && <StairRotateHandle rotation={v.rotation} invalid={false} label="Rotar objeto libremente" y={1.3} onPreview={setRotPreview} onCommit={r=>{s.editFixture(v.id,{rotation:r});setRotPreview(null);}} />}
    </group>
  );
}
function CounterHandle({counter:v,axis,accent}:{counter:Counter;axis:'length'|'depth'|'height';accent:string}){
  const s=useConfigurator(),[value,setValue]=useState<number|null>(null),start=useRef<{y:number;value:number}|null>(null);
  const commit=()=>{if(value!==null)s.editCounter(v.id,{[axis]:value});setValue(null);start.current=null;s.setEditing(false);};
  return <group position={axis==='length'?[v.length/2,v.height+0.08,0]:axis==='depth'?[0,v.height+0.08,v.depth/2]:[0,v.height+0.22,0]}>
    <Html center><Button variant="secondary" size="icon" className="h-11 w-11 touch-none" aria-label={`Redimensionar ${axis==='length'?'largo':axis==='depth'?'profundidad':'altura'} de mesada`} title={axis==='length'?'Largo':axis==='depth'?'Profundidad':'Altura'} onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);start.current={y:axis==='height'?e.clientY:e.clientX,value:v[axis]};s.setEditing(true);}} onPointerMove={e=>{if(!start.current)return;const delta=((axis==='height'?-e.clientY:e.clientX)-(axis==='height'?-start.current.y:start.current.y))/80;setValue(Math.max(0.3,Math.round((start.current.value+delta)*10)/10));}} onPointerUp={commit} onPointerCancel={commit}>{axis==='height'?'↕':'↔'}</Button>{value!==null&&<span className="block bg-background text-center text-xs text-foreground">{value.toFixed(2)} m</span>}</Html>
  </group>;
}
function StairModel({
  stair: s,
  palette,
  map,
  c,
  onPreview,
}: {
  stair: Stair;
  palette: ScenePalette;
  map: THREE.Texture;
  c: HouseConfig;
  onPreview:(id:string,p:Point|null)=>void;
}) {
  const store = useConfigurator(),
    height = s.exterior ? floorBase(c) + s.floor * FLOOR_STEP : FLOOR_STEP;
  let x = s.x,
    z = s.z,
    rotation = s.rotation;
  if (s.exterior) {
    const w = resolveWall(c, s.wall ?? "edge-2", s.floor);
    if (w) {
      const len = distance(w.a, w.b),
        dx = (w.b.x - w.a.x) / len,
        dz = (w.b.z - w.a.z) / len,
        off = Math.max(-len / 2 + s.width / 2, Math.min(len / 2 - s.width / 2, s.offset ?? 0));
      x = (w.a.x + w.b.x) / 2 + dx * off;
      z = (w.a.z + w.b.z) / 2 + dz * off;
      rotation = Math.atan2(dx, -dz);
    }
  }
  const [rotPreview,setRotPreview]=useState<number|null>(null);
  if(!s.exterior&&rotPreview!==null)rotation=rotPreview;
  const stair = { ...s, reverse:s.exterior?false:s.reverse, x, z, rotation },
    g = stairGeometry(stair, height),
    drag = useObjectDrag(
      s.id,
      x,
      z,
      s.exterior ? 0 : floorBase(c) + s.floor * FLOOR_STEP,
      (p) => {
        if(!s.exterior){store.editStair(s.id,p);return;}
        const nearest=designWalls(c,s.floor).filter(w=>w.id.startsWith('edge-')).map(w=>({w,p:project(p,w.a,w.b)})).sort((a,b)=>distance(a.p.point,p)-distance(b.p.point,p))[0];
        if(nearest)store.editStair(s.id,{wall:nearest.w.id,offset:(nearest.p.t-0.5)*distance(nearest.w.a,nearest.w.b)});
      },
      s.locked,
      p=>onPreview(s.id,p),
    ),
    p = drag.preview ?? { x, z };
  const invalid=(drag.preview||rotPreview!==null)&&!s.exterior?validateStair({...s,rotation,...drag.preview},c.contour,c.walls[s.floor+1]??[],FLOOR_STEP):null;
  const pose=s.exterior?exteriorStairPose(s,c.contour,height):null;
  const exteriorStart=pose?{x:pose.x+(p.x-x),z:pose.z+(p.z-z)}:p;
  const boxes = useMemo(
    () =>
      g.steps.map((t) => ({
        size: [s.width, s.closed ? g.rise : 0.05, t.depth] as Vec3,
        pos: [t.x, t.y - (s.closed ? g.rise : 0.05) / 2, t.z] as Vec3,
      })),
    [s.width, s.closed, g.count, g.rise, g.tread],
  );
  return (
    <group position={[exteriorStart.x, 0, exteriorStart.z]} rotation-y={pose?.rotation??-rotation} {...drag.handlers}>
      {drag.preview&&<mesh position={[0,0.035,0]}><boxGeometry args={[s.width*2,0.04,g.first*g.tread+s.width]} /><meshBasicMaterial color={invalid?palette.invalid:palette.accent} transparent opacity={0.3}/></mesh>}
      {g.steps.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]} rotation-y={-t.rotation}>
          <Box
            size={[t.width, s.closed ? g.rise : 0.05, t.depth]}
            position={[0, -(s.closed ? g.rise : 0.05) / 2, 0]}
            map={map}
          />
          {s.rail && (
            <>
              {[-1, 1].map((side) => (
                <Box
                  key={side}
                  size={[0.035, 1, 0.035]}
                  position={[(side * t.width) / 2, 0.5, 0]}
                  map={map}
                />
              ))}
            </>
          )}
        </group>
      ))}
      {s.type==='caracol'&&<Box size={[0.12,g.count*g.rise+1,0.12]} position={[0,(g.count*g.rise+1)/2,0]} map={map}/>}
      {g.steps.slice(0,-1).map((t,i)=>{const next=g.steps[i+1];if(!next||Math.abs(t.rotation-next.rotation)>0.1)return null;const run=distance({x:t.x,z:t.z},{x:next.x,z:next.z}),rise=next.y-t.y;return <group key={`stringer-${i}`} position={[(t.x+next.x)/2,(t.y+next.y)/2,(t.z+next.z)/2]} rotation-y={-t.rotation}>{[-1,1].map(side=><group key={side} position-x={side*s.width/2}><Box size={[0.05,0.15,Math.hypot(run,rise)+0.08]} position={[0,-0.12,0]} rotation={[-Math.atan2(rise,run),0,0]} map={map}/>{s.rail&&<Box size={[0.05,0.05,Math.hypot(run,rise)+0.08]} position={[0,1,0]} rotation={[-Math.atan2(rise,run),0,0]} map={map}/>}</group>)}</group>;})}
      {s.type === "caracol" && s.rail && g.steps.slice(0, -1).map((t, i) => {
        const n = g.steps[i + 1];
        if (!n) return null;
        const a = { x: t.x * 2, z: t.z * 2 }, b = { x: n.x * 2, z: n.z * 2 }, run = distance(a, b), rise = n.y - t.y;
        return <group key={`spiral-rail-${i}`} position={[(a.x + b.x) / 2, (t.y + n.y) / 2 + 1, (a.z + b.z) / 2]} rotation-y={Math.atan2(b.x - a.x, b.z - a.z)}><Box size={[0.05, 0.05, Math.hypot(run, rise) + 0.04]} position={[0, 0, 0]} rotation={[-Math.atan2(rise, run), 0, 0]} map={map} /></group>;
      })}
      {s.type !== "recta" && s.type !== "caracol" && (
        <Box
          size={[s.type === "U" ? s.width * 2 : s.width, 0.08, s.width]}
          position={[
            (s.reverse ? -1 : 1) * (s.type === "U" ? s.width / 2 : 0),
            g.first * g.rise,
            (s.reverse ? -1 : 1) * (g.first * g.tread + s.width / 2),
          ]}
          map={map}
        />
      )}

      {store.selectedId === s.id && (
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshBasicMaterial color={invalid?palette.invalid:palette.accent} />
        </mesh>
      )}
      {store.selectedId === s.id && !s.exterior && !s.locked && (
        <StairRotateHandle rotation={s.rotation} invalid={!!invalid} onPreview={setRotPreview} onCommit={r=>{store.editStair(s.id,{rotation:r});setRotPreview(null);}} />
      )}
    </group>
  );
}
/** Free rotation: drag around the icon; the angle follows the pointer (snaps to 5°, hold Shift for 1°). */
function StairRotateHandle({rotation,invalid,onPreview,onCommit,label="Rotar escalera libremente",y=1.5}:{rotation:number;invalid:boolean;label?:string;y?:number;onPreview:(r:number|null)=>void;onCommit:(r:number)=>void}){
  const s=useConfigurator(),start=useRef<{cx:number;cy:number;a:number;r:number}|null>(null),[deg,setDeg]=useState<number|null>(null),last=useRef<number|null>(null);
  const norm=(r:number)=>((r%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  const end=()=>{const r=last.current;start.current=null;last.current=null;setDeg(null);s.setEditing(false);if(r===null){onPreview(null);return;}onCommit(r);};
  return <group position={[0,y,0]}><Html center zIndexRange={[20,0]}>
    <Button variant="secondary" size="icon" className={`h-12 w-12 touch-none rounded-full text-xl shadow-lg ${invalid?'ring-2 ring-destructive':''}`} aria-label={label} title="Arrastrá en círculo para rotar"
      onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);const b=e.currentTarget.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2;start.current={cx,cy,a:Math.atan2(e.clientY-cy,e.clientX-cx),r:rotation};s.setEditing(true);}}
      onPointerMove={e=>{const st=start.current;if(!st)return;const dx=e.clientX-st.cx,dy=e.clientY-st.cy;if(Math.hypot(dx,dy)<8)return;const step=(e.shiftKey?1:5)*Math.PI/180,r=norm(Math.round((st.r+Math.atan2(dy,dx)-st.a)/step)*step);last.current=r;setDeg(Math.round(r*180/Math.PI)%360);onPreview(r);}}
      onPointerUp={end} onPointerCancel={end}>⟳</Button>
    {deg!==null&&<span className="mt-1 block rounded bg-background px-1 text-center text-xs text-foreground">{deg}°</span>}
  </Html></group>;
}
function HoleRail({ ring, map, stair }: { ring: Point[]; map: THREE.Texture; stair?:Stair | undefined }) {
  const g=stair?stairGeometry(stair,FLOOR_STEP):null,last=g?.steps.at(-1);
  const local=last&&stair?{x:stair.x+last.x*Math.cos(stair.rotation)-last.z*Math.sin(stair.rotation),z:stair.z+last.x*Math.sin(stair.rotation)+last.z*Math.cos(stair.rotation)}:null;
  const arrival=local?ring.map((a,i)=>({i,d:distance(project(local,a,ring[(i+1)%ring.length]??a).point,local)})).sort((a,b)=>a.d-b.d)[0]?.i:-1;
  return (
    <group>
      {ring.map((a, i) => {
        if(i===arrival)return null;
        const b = ring[(i+1)%ring.length];
        if (!b) return null;
        const len = distance(a, b);
        return (
          <group
            key={i}
            position={[(a.x + b.x) / 2, 0, (a.z + b.z) / 2]}
            rotation-y={-Math.atan2(b.z - a.z, b.x - a.x)}
          >
            <Box size={[len, 0.06, 0.06]} position={[0, 1, 0]} map={map} />
            {[-1, 1].map((side) => (
              <Box
                key={side}
                size={[0.05, 1, 0.05]}
                position={[(side * len) / 2, 0.5, 0]}
                map={map}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}
function Roof({ c, palette }: { c: HouseConfig; palette: ScenePalette }) {
  // Esencial lleva techo liviano de chapa; la Clásica, losa de hormigón con membrana asfáltica.
  const losa = c.finish === "clasica";
  const map = useMaterial(losa ? "membrana" : "chapa"),
    siding = useMaterial(FINISH_MATERIALS[c.finish].siding);
  const geo = useMemo(() => {
    const pts: number[] = [],
      uv: number[] = [],
      gables: number[] = [];
    const b=bounds(c.contour),slope=Math.tan((c.roofType==='plano'?3:c.roofPitch)*Math.PI/180);
    const faces:RoofFace[]=c.roofType==='dos'&&isOrthogonal(c.contour)
      ? roofFaces(c.contour,c.roofDirection,slope)
      : [{rings:[c.contour],plane:c.roofDirection==='x'?{x:slope,z:0,c:-b.minX*slope}:{x:0,z:slope,c:-b.minZ*slope}}];
    const exterior=designWalls(c,0).filter(w=>w.id.startsWith('edge-'));
    const roof= c.roofType==='dos'&&isOrthogonal(c.contour)?roofFaces(c.contour,c.roofDirection,slope,c.overhang):[{...faces[0],rings:[offsetContour(c.contour,c.overhang)],plane:faces[0]?.plane??{x:0,z:0,c:0}}];
    for(const face of roof){
      const outer=face.rings[0];if(!outer)continue;
      const holes=face.rings.slice(1),flat=[...outer,...holes.flat()];
      const indices=THREE.ShapeUtils.triangulateShape(outer.map(p=>new THREE.Vector2(p.x,p.z)),holes.map(r=>r.map(p=>new THREE.Vector2(p.x,p.z))));
      for(const triangle of indices)for(const i of triangle){const p=flat[i];if(!p)continue;const h=planeHeight(face.plane,p);pts.push(p.x,h,p.z);uv.push(p.x,p.z);}
    }
    for(const face of faces){
      // Infill only on footprint boundary, never on internal ridges or valleys.
      face.rings.forEach(r=>r.forEach((a,i)=>{const b=r[(i+1)%r.length];if(!b)return;
        if(!exterior.some(w=>distance(project(a,w.a,w.b).point,a)<1e-6&&distance(project(b,w.a,w.b).point,b)<1e-6))return;
        const ha=Math.max(0,planeHeight(face.plane,a)),hb=Math.max(0,planeHeight(face.plane,b));
        if(ha+hb<1e-7)return;
        gables.push(a.x,0,a.z,b.x,0,b.z,b.x,hb,b.z,a.x,0,a.z,b.x,hb,b.z,a.x,ha,a.z);
      }));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const ends = new THREE.BufferGeometry();
    ends.setAttribute("position", new THREE.Float32BufferAttribute(gables, 3));
    ends.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        gables.flatMap((_, i) => (i % 3 === 0 ? [gables[i] ?? 0, gables[i + 1] ?? 0] : [])),
        2,
      ),
    );
    ends.computeVertexNormals();
    return { g, ends };
  }, [c.contour, c.roofType, c.roofPitch, c.roofDirection,c.overhang]);
  useEffect(
    () => () => {
      geo.g.dispose();
      geo.ends.dispose();
    },
    [geo],
  );
  return (
    <group position-y={floorBase(c) + (c.floors - 1) * FLOOR_STEP + WALL_HEIGHT}>
      <mesh geometry={geo.g} castShadow receiveShadow>
        <meshStandardMaterial {...pbrProps(map)} map={map} metalness={losa ? 0 : 0.55} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.ends}>
        <meshStandardMaterial {...pbrProps(siding)} map={siding} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
/** Zócalo, cintas y techo de la construcción tradicional, con sus materiales (hormigón, revoque y membrana o chapa). */
function TradEnvelope({ c }: { c: HouseConfig }) {
  const concrete = useMaterial("hormigon"),
    plaster = useMaterial(FINISH_MATERIALS[c.finish].siding),
    roof = useMaterial(c.finish === "clasica" ? "membrana" : "chapa");
  return <TraditionalEnvelope c={c} maps={{ concrete, plaster, roof }} />;
}
export function House({
  palette,
  dragging,
  setDragging,
}: {
  palette: ScenePalette;
  dragging: string | null;
  setDragging: (v: string | null) => void;
}) {
  const c = useConfigurator((s) => s.config),
    view = useConfigurator((s) => s.view),
    activeFloor = useConfigurator((s) => s.activeFloor),
    finish = FINISH_MATERIALS[c.finish];
  const [stairPreview,setStairPreview]=useState<{id:string;p:Point}|null>(null);
  const previewStair=(id:string,p:Point|null)=>setStairPreview(p?{id,p}:null);
  const sceneStairs=c.stairs.map(s=>stairPreview?.id===s.id?{...s,...stairPreview.p}:s);
  const floorMap = useMaterial(finish.floor),
    interiorMap = useMaterial(finish.wall),
    ceilingMap = useMaterial(finish.ceiling),
    sidingMap = useMaterial(finish.siding),
    cut = view === "interior" || view === "corte" || view === "planta";
  return (
    <group position={[c.position.x, 0, c.position.z]} rotation-y={-c.rotation}>
      <Foundation c={c} />
      {Array.from({ length: cut ? 1 : c.floors }, (_, i) => {
        const floor=cut?activeFloor:i;
        const incoming = sceneStairs
            .filter((s) => !s.exterior && s.floor === floor - 1)
            .map((s) => stairGeometry(s, FLOOR_STEP).hole),
          outgoing = sceneStairs
            .filter((s) => !s.exterior && s.floor === floor)
            .map((s) => stairGeometry(s, FLOOR_STEP).hole),
          rooms = detectRooms(c.contour, c.walls[floor] ?? []);
        return (
          <group key={floor} position-y={floorBase(c) + floor * FLOOR_STEP}>
            <FloorSlab
              contour={c.contour}
              holes={incoming}
              map={floorMap}
              y={0}
              thickness={GEOMETRY.slabThickness}
            />
            {designWalls(c, floor)
              .filter((w) => view !== "corte" || (w.id !== "edge-1" && w.id !== "edge-2"))
              .map((w) => (
                <Wall
                  key={w.id}
                  c={c}
                  wall={w.id as WallId}
                  floor={floor}
                  interiorMap={interiorMap}
                  sidingMap={sidingMap}
                  palette={palette}
                  dragging={dragging}
                  setDragging={setDragging}
                />
              ))}
            {c.counters
              .filter((v) => v.floor === floor)
              .map((v) => (
                <CounterModel key={v.id} counter={v} palette={palette} />
              ))}
            {c.fixtures
              .filter((v) => v.floor === floor)
              .map((v) => (
                <FixtureModel key={v.id} fixture={v} palette={palette} />
              ))}
            {c.stairs
              .filter((v) => !v.exterior && v.floor === floor)
              .map((v) => (
                <StairModel key={v.id} stair={v} c={c} map={floorMap} palette={palette} onPreview={previewStair} />
              ))}
            {incoming.map((r, i) => {
              const below = sceneStairs.filter(s=>!s.exterior&&s.floor===floor-1)[i];
              const continues = below?.type==='caracol'&&sceneStairs.some(s=>!s.exterior&&s.floor===floor&&s.type==='caracol'&&Math.abs(s.x-below.x)<1e-3&&Math.abs(s.z-below.z)<1e-3);
              return continues ? null : <HoleRail key={i} ring={r} map={floorMap} stair={below} />;
            })}
            {!cut && (
              <FloorSlab
                contour={c.contour}
                holes={outgoing}
                map={ceilingMap}
                y={WALL_HEIGHT}
                thickness={GEOMETRY.ceilingThickness}
              />
            )}
            {view === "planta" &&
              floor === activeFloor &&
              rooms.map((r, i) => (
                <Html
                  key={r.id}
                  position={[r.center.x, 0.05, r.center.z]}
                  center
                  className="pointer-events-none"
                >
                  <span className="block whitespace-nowrap bg-background/85 px-2 py-1 text-center text-[10px] text-foreground">
                    {roomName(c, floor, r, i)}
                    <br />
                    {r.area.toFixed(2)} m²
                  </span>
                </Html>
              ))}
          </group>
        );
      })}
      {c.stairs
        .filter((s) => s.exterior)
        .map((s) => (
          <StairModel key={s.id} stair={s} c={c} map={floorMap} palette={palette} onPreview={previewStair} />
        ))}
      {!cut && (systemOf(c.finish) === "tradicional" ? <TradEnvelope c={c} /> : <Roof c={c} palette={palette} />)}
      <SceneEditor accent={palette.accent} trim={palette.trim} invalid={palette.invalid} />
    </group>
  );
}

/**
 * Un espejado (`scale(1,1,-1)`) invierte el orden de los vértices: las caras exteriores quedaban como "traseras" y el pase de
 * normales de la oclusión ambiental las veía hacia adentro, oscureciendo la pared entera salvo los bordes (efecto "transparente").
 * Se reordena cada triángulo para que vuelvan a mirar hacia afuera.
 */
function flipWinding(g: THREE.BufferGeometry) {
  const index = g.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); }
    index.needsUpdate = true;
    return;
  }
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute, n = a.itemSize, arr = a.array as Float32Array;
    for (let t = 0; t + 2 < a.count; t += 3) for (let k = 0; k < n; k++) { const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k, v = arr[i1]!; arr[i1] = arr[i2]!; arr[i2] = v; }
    a.needsUpdate = true;
  }
}
