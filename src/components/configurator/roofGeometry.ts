import * as THREE from "three";
import {
  bounds,
  distance,
  isOrthogonal,
  offsetContour,
  planeHeight,
  project,
  roofFaces,
  signedArea,
  type Point,
  type RoofFace,
} from "@/config/geometry";
import { exteriorThickness } from "@/config/systems";
import { TOP_WALL_HEIGHT, type HouseConfig } from "@/store/useConfigurator";

/**
 * Techo de las casas livianas (woodframe), separado del componente para poder probarlo: los faldones de chapa y los frontones
 * (el muro que sigue hasta el techo). Las coordenadas son las de la casa; el techo se apoya en `TOP_WALL_HEIGHT` sobre el piso de
 * la última planta, así que las alturas empiezan en 0 sobre el borde superior del muro.
 */
export function buildRoofGeometry(c: Pick<HouseConfig, "contour" | "roofType" | "roofPitch" | "roofDirection" | "overhang" | "finish">) {
    const pts: number[] = [],
      uv: number[] = [],
      gables: number[] = [];
    const b=bounds(c.contour),slope=Math.tan((c.roofType==='plano'?3:c.roofPitch)*Math.PI/180);
    const faces:RoofFace[]=c.roofType==='dos'&&isOrthogonal(c.contour)
      ? roofFaces(c.contour,c.roofDirection,slope)
      : [{rings:[c.contour],plane:c.roofDirection==='x'?{x:slope,z:0,c:-b.minX*slope}:{x:0,z:slope,c:-b.minZ*slope}}];
    const roof= c.roofType==='dos'&&isOrthogonal(c.contour)?roofFaces(c.contour,c.roofDirection,slope,c.overhang):[{...faces[0],rings:[offsetContour(c.contour,c.overhang)],plane:faces[0]?.plane??{x:0,z:0,c:0}}];
    for(const face of roof){
      const outer=face.rings[0];if(!outer)continue;
      const holes=face.rings.slice(1),flat=[...outer,...holes.flat()];
      const indices=THREE.ShapeUtils.triangulateShape(outer.map(p=>new THREE.Vector2(p.x,p.z)),holes.map(r=>r.map(p=>new THREE.Vector2(p.x,p.z))));
      for(const triangle of indices)for(const i of triangle){const p=flat[i];if(!p)continue;const h=planeHeight(face.plane,p);pts.push(p.x,h,p.z);if(c.roofDirection==='x')uv.push(p.z,p.x);else uv.push(p.x,p.z);}
    }
    // Frontones: el muro sigue hasta el techo, a ras de la cara EXTERIOR del muro (no del eje) y con el mismo revestimiento, para
    // que no se note un escalón ni un tramo más angosto entre el muro de la casa y el muro que sube bajo el techo.
    const half=exteriorThickness(c.finish)/2,n=c.contour.length,sign=signedArea(c.contour)>0?1:-1,outerCorners=offsetContour(c.contour,half);
    const edgeOf=(p:Point,q:Point)=>{for(let k=0;k<n;k++){const a=c.contour[k],e=c.contour[(k+1)%n];if(a&&e&&distance(project(p,a,e).point,p)<1e-6&&distance(project(q,a,e).point,q)<1e-6)return k;}return -1;};
    const shiftOut=(p:Point,k:number):Point=>{
      for(let j=0;j<n;j++){const v=c.contour[j];if(v&&distance(v,p)<1e-6)return outerCorners[j]??p;}
      const a=c.contour[k],e=c.contour[(k+1)%n];if(!a||!e)return p;const len=distance(a,e)||1;
      return {x:p.x+sign*(e.z-a.z)/len*half,z:p.z-sign*(e.x-a.x)/len*half};
    };
    const gableUv:number[]=[];
    for(const face of faces){
      // Solo sobre el borde de la planta, nunca sobre cumbreras ni limahoyas.
      face.rings.forEach(r=>r.forEach((a0,i)=>{const b0=r[(i+1)%r.length];if(!b0)return;
        const k=edgeOf(a0,b0);if(k<0)return;
        const a=shiftOut(a0,k),b=shiftOut(b0,k),
          ha=Math.max(0,planeHeight(face.plane,a)),hb=Math.max(0,planeHeight(face.plane,b));
        if(ha+hb<1e-7)return;
        const w0=c.contour[k],w1=c.contour[(k+1)%n];if(!w0||!w1)return;
        // UV como las del muro de abajo (a lo largo del muro desde su centro; la altura sigue contando desde el piso de esa planta).
        const wl=distance(w0,w1)||1,ux=(w1.x-w0.x)/wl,uz=(w1.z-w0.z)/wl,mx=(w0.x+w1.x)/2,mz=(w0.z+w1.z)/2,
          u=(p:Point)=>(p.x-mx)*ux+(p.z-mz)*uz;
        gables.push(a.x,0,a.z,b.x,0,b.z,b.x,hb,b.z,a.x,0,a.z,b.x,hb,b.z,a.x,ha,a.z);
        const T=TOP_WALL_HEIGHT;
        gableUv.push(u(a),T,u(b),T,u(b),T+hb,u(a),T,u(b),T+hb,u(a),T+ha);
      }));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const ends = new THREE.BufferGeometry();
    ends.setAttribute("position", new THREE.Float32BufferAttribute(gables, 3));
    ends.setAttribute("uv", new THREE.Float32BufferAttribute(gableUv, 2));
    ends.computeVertexNormals();
    return { g, ends };
}
