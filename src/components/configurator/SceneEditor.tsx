import { useState, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { useConfigurator, floorBase, FLOOR_STEP, designWalls } from "@/store/useConfigurator";
import { distance, magnet, snap, validateContour, type Point } from "@/config/geometry";
export function eventPoint(e: ThreeEvent<PointerEvent>, y: number): Point {
  const point = new THREE.Vector3();
  e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), point);
  const c = useConfigurator.getState().config,
    dx = point.x - c.position.x,
    dz = point.z - c.position.z;
  return {
    x: dx * Math.cos(c.rotation) + dz * Math.sin(c.rotation),
    z: -dx * Math.sin(c.rotation) + dz * Math.cos(c.rotation),
  };
}
export function useObjectDrag(
  id: string,
  x: number,
  z: number,
  y: number,
  onCommit: (p: Point) => void,
  locked = false,
  onPreview?: (p:Point|null)=>void,
) {
  const [preview, setPreview] = useState<Point | null>(null),
    start = useRef<Point | null>(null), activePointer=useRef<number|null>(null),latest=useRef<Point|null>(null);
  const cancel=()=>{start.current=null;activePointer.current=null;latest.current=null;setPreview(null);onPreview?.(null);useConfigurator.getState().setEditing(false);};
  return {
    preview,
    handlers: {
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const s = useConfigurator.getState();
        // First tap only selects so the camera can still orbit; drag moves only an already-selected object.
        const wasSelected = s.selectedId === id;
        s.select(id);
        if (!wasSelected) return;
        if (e.pointerType === "touch" && !e.isPrimary) return;
        if (locked || s.tool === "wall" || s.tool === "measure" || s.tool === "opening") return;
        start.current = eventPoint(e, y);
        activePointer.current=e.pointerId;
        s.setEditing(true);
        (e.target as unknown as {setPointerCapture:(id:number)=>void})?.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        if (!start.current||activePointer.current!==e.pointerId) return;
        e.stopPropagation();
        const p = eventPoint(e, y);
        const next={ x: snap(x + p.x - start.current.x), z: snap(z + p.z - start.current.z) };
        latest.current=next;setPreview(next);onPreview?.(next);
      },
      onPointerUp: (e: ThreeEvent<PointerEvent>) => {
        if (!start.current||activePointer.current!==e.pointerId) return;
        e.stopPropagation();
        if(latest.current){const p=eventPoint(e,y);onCommit({x:snap(x+p.x-start.current.x),z:snap(z+p.z-start.current.z)});}
        cancel();
        (e.target as unknown as {releasePointerCapture:(id:number)=>void})?.releasePointerCapture(e.pointerId);
      },
      onPointerCancel:cancel,
      onLostPointerCapture:cancel,
      onContextMenu: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        useConfigurator.getState().select(id);
      },
    },
  };
}
function Vertex({
  index,
  y,
  accent,
  invalid,
}: {
  index: number;
  y: number;
  accent: string;
  invalid: string;
}) {
  const s = useConfigurator(),
    p = s.config.contour[index],
    [preview, setPreview] = useState<Point | null>(null),activePointer=useRef<number|null>(null);
  if (!p) return null;
  const candidate = preview
      ? s.config.contour.map((v,i)=>{if(i===index)return preview;if(!s.config.orthogonal)return v;const prev=(index-1+s.config.contour.length)%s.config.contour.length,next=(index+1)%s.config.contour.length;if(i!==prev&&i!==next)return v;return {x:Math.abs(v.x-p.x)<1e-6?preview.x:v.x,z:Math.abs(v.z-p.z)<1e-6?preview.z:v.z};})
      : s.config.contour,
    error = validateContour(candidate, s.config.floors);
  const v = preview ?? p;
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const q = eventPoint(e, y);
    let n = { x: snap(q.x), z: snap(q.z) };

    setPreview(n);
  };
  return (
    <group>
      <mesh
        position={[v.x, y, v.z]}
        onPointerDown={(e) => {
          e.stopPropagation();
          activePointer.current=e.pointerId;
          s.setEditing(true);
          (e.target as unknown as {setPointerCapture:(id:number)=>void})?.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (activePointer.current===e.pointerId) move(e);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if(activePointer.current!==e.pointerId)return;
          if (preview){const q=eventPoint(e,y),point={x:snap(q.x),z:snap(q.z)};s.setContour(s.config.contour.map((v,i)=>{if(i===index)return point;if(!s.config.orthogonal)return v;const prev=(index-1+s.config.contour.length)%s.config.contour.length,next=(index+1)%s.config.contour.length;if(i!==prev&&i!==next)return v;return {x:Math.abs(v.x-p.x)<1e-6?point.x:v.x,z:Math.abs(v.z-p.z)<1e-6?point.z:v.z};}));}
          activePointer.current=null;
          setPreview(null);
          s.setEditing(false);
          (e.target as unknown as {releasePointerCapture:(id:number)=>void})?.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={()=>{activePointer.current=null;setPreview(null);s.setEditing(false);}}
        onLostPointerCapture={()=>{activePointer.current=null;setPreview(null);s.setEditing(false);}}
      >
        <sphereGeometry args={[0.18, 12, 8]} />
        <meshBasicMaterial color={error ? invalid : accent} transparent opacity={0.8} />
      </mesh>
      <Html position={[v.x, y + 0.2, v.z]} center>
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 text-xs"
          aria-label={`Eliminar vértice ${index + 1}`}
          title="Eliminar vértice"
          onClick={() => s.setContour(s.config.contour.filter((_, i) => i !== index))}
        >
          ×
        </Button>
      </Html>
      {preview && (
        <Line
          points={[...candidate, candidate[0] ?? v].map(
            (p) => [p.x, y, p.z] as [number, number, number],
          )}
          color={error ? invalid : accent}
          lineWidth={3}
        />
      )}
    </group>
  );
}
export function SceneEditor({
  accent,
  trim,
  invalid,
}: {
  accent: string;
  trim: string;
  invalid: string;
}) {
  const s = useConfigurator(),
    c = s.config,
    y = floorBase(c) + s.activeFloor * FLOOR_STEP + 0.04,
    [start, setStart] = useState<Point | null>(null),
    [end, setEnd] = useState<Point | null>(null),
    [measurement,setMeasurement]=useState<{a:Point;b:Point}|null>(null),
    walls = designWalls(c, s.activeFloor);
  return (
    <group>
      {(s.view === "planta" || s.tool === "contour") && (
        <>
          {c.contour.map((p, i) => {
            const b = c.contour[(i + 1) % c.contour.length];
            if (!b) return null;
            return (
              <group key={i}>
                {s.tool === "contour" && (
                  <>
                    <Vertex index={i} y={y + 0.2} accent={accent} invalid={invalid} />
                    <Html position={[(p.x + b.x) / 2, y + 0.1, (p.z + b.z) / 2]} center>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11"
                        title="Agregar vértice"
                        aria-label={`Agregar vértice en lado ${i + 1}`}
                        onClick={() => {
                          const n = [...c.contour];
                          n.splice(i + 1, 0, { x: (p.x + b.x) / 2, z: (p.z + b.z) / 2 });
                          s.setContour(n);
                        }}
                      >
                        +
                      </Button>
                    </Html>
                  </>
                )}
                <Html
                  position={[(p.x + b.x) / 2, y + 0.12, (p.z + b.z) / 2 + 0.35]}
                  center
                  className="pointer-events-none"
                >
                  <span className="whitespace-nowrap bg-background/90 px-1 text-[10px] text-foreground">
                    {distance(p, b).toFixed(2)} m
                  </span>
                </Html>
              </group>
            );
          })}
        </>
      )}
      {(s.tool === "wall" || s.tool === "measure") && (
        <mesh
          rotation-x={-Math.PI / 2}
          position-y={y}
          onPointerMove={(e) => {
            if (start) setEnd(magnet(eventPoint(e, y), walls, c.orthogonal ? start : undefined));
          }}
          onClick={(e) => {
            e.stopPropagation();
            const p = magnet(
              eventPoint(e as unknown as ThreeEvent<PointerEvent>, y),
              walls,
              c.orthogonal && start ? start : undefined,
            );
            if (start) {
              if (s.tool === "wall") s.addWall(start, p);
              else setMeasurement({a:start,b:p});
              setStart(null);
            } else {
              setStart(p);
              setEnd(null);
            }
          }}
        >
          <planeGeometry args={[80, 80]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {(start&&end||measurement) && (()=>{const a=start??measurement?.a,b=end??measurement?.b;if(!a||!b)return null;return (
        <>
          <Line
            points={[
              [a.x, y + 0.1, a.z],
              [b.x, y + 0.1, b.z],
            ]}
            color={accent}
            lineWidth={3}
          />
          <Html position={[(a.x + b.x) / 2, y + 0.2, (a.z + b.z) / 2]} center>
            <span className="whitespace-nowrap bg-background px-2 text-xs text-foreground">
              {distance(a, b).toFixed(2)} m
            </span>
          </Html>
        </>
      );})()}
      {s.view === "planta" && <gridHelper args={[60, 60, trim, trim]} position-y={y - 0.03} />}
    </group>
  );
}
