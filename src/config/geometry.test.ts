import { describe, it, expect } from "vitest";
import {
  polygonArea,
  presetPolygon,
  validateContour,
  detectRooms,
  stairGeometry,
  validateStair,
  roofModules,
  roofFaces, planeHeight, distance, project,
  GEOMETRY,
  inside, transformPoint,
  wallOverlap,
  exteriorStairPose, exteriorSegments,
  type Stair,
} from "./geometry";
import {
  initialConfig,
  resizeConfig,
  useConfigurator,
  encodeDesign,
  decodeDesign,
} from "@/store/useConfigurator";
import { configPrice, ADJUSTMENTS } from "./pricing";
const stair: Stair = {
  id: "s",
  floor: 0,
  x: 0,
  z: -2,
  rotation: 0,
  width: 0.9,
  type: "recta",
  reverse: false,
  closed: false,
  exterior: false,
  rail: true,
};
describe("reglas del editor", () => {
  it('ambientes cerrados aislados y anidados no duplican superficie',()=>{
    const contour=[{x:0,z:0},{x:10,z:0},{x:10,z:10},{x:0,z:10}];
    const loop=(min:number,max:number,prefix:string)=>exteriorSegments([{x:min,z:min},{x:max,z:min},{x:max,z:max},{x:min,z:max}]).map((w,i)=>({...w,id:prefix+i}));
    const rooms=detectRooms(contour,[...loop(2,8,'a'),...loop(4,6,'b')]);
    expect(rooms.map(r=>r.area).sort((a,b)=>a-b)).toEqual([4,32,64]);
    expect(rooms.reduce((sum,r)=>sum+r.area,0)).toBe(100);
    for(const r of rooms)expect(r.holes?.some(h=>inside(r.center,h))).toBe(false);
  });
  it('cada tramo de escalera orienta los peldaños según el avance',()=>{
    for(const type of ['recta','L','U'] as const)for(const reverse of [false,true]){
      const g=stairGeometry({...stair,type,reverse},2.85);
      g.steps.slice(0,-1).forEach((step,i)=>{const next=g.steps[i+1];if(!next||next.rotation!==step.rotation)return;const dx=next.x-step.x,dz=next.z-step.z,len=Math.hypot(dx,dz);expect(dx/len).toBeCloseTo(-Math.sin(step.rotation));expect(dz/len).toBeCloseTo(Math.cos(step.rotation));});
    }
  });
  it('la dirección elegida cambia la cumbrera de un techo rectangular',()=>{
    const p=presetPolygon('rectangular',60);
    expect(roofFaces(p,'x',0.35).every(f=>Math.abs(f.plane.z)<1e-8)).toBe(true);
    expect(roofFaces(p,'z',0.35).every(f=>Math.abs(f.plane.x)<1e-8)).toBe(true);
  });
  it('escaleras exteriores llegan a todos los lados desde fuera del contorno',()=>{
    const contour=presetPolygon('rectangular',60),height=0.85;
    for(const w of exteriorSegments(contour)){
      const s={...stair,exterior:true,wall:w.id,offset:0},pose=exteriorStairPose(s,contour,height),g=stairGeometry(s,height),run=g.count*g.tread;
      expect(inside(pose,contour)).toBe(false);
      expect(pose.x-Math.sin(pose.rotation)*run).toBeCloseTo((w.a.x+w.b.x)/2);
      expect(pose.z+Math.cos(pose.rotation)*run).toBeCloseTo((w.a.z+w.b.z)/2);
    }
  });
  it('cortar una pared conserva aberturas y deshacer restaura todo en una acción',()=>{
    const c=initialConfig();c.walls=[[{id:'wall-test',a:{x:-3,z:0},b:{x:3,z:0},height:2.65,thickness:0.1}]];c.openings=[{id:'door',wall:'wall-test',floor:0,offset:-1.5,type:'interior',manual:true}];
    useConfigurator.setState({config:c,past:[],future:[]});useConfigurator.getState().splitWall('wall-test');
    expect(useConfigurator.getState().config.walls[0]).toHaveLength(2);expect(useConfigurator.getState().config.openings[0]?.offset).toBe(0);expect(useConfigurator.getState().past).toHaveLength(1);
    useConfigurator.getState().undo();expect(useConfigurator.getState().config).toEqual(c);
  });
  it('rechaza vértices repetidos y retroceso collinear',()=>{
    expect(validateContour([{x:0,z:0},{x:6,z:0},{x:3,z:0},{x:3,z:6},{x:0,z:6}],1)).not.toBeNull();
    expect(validateContour([{x:0,z:0},{x:6,z:0},{x:6,z:6},{x:0,z:6},{x:6,z:0}],1)).not.toBeNull();
  });
  it('paredes permiten cruces y encuentros T pero no tramos superpuestos',()=>{
    const w={id:'a',a:{x:0,z:0},b:{x:6,z:0},thickness:0.1,height:2.65};
    expect(wallOverlap({...w,id:'b',a:{x:2,z:0},b:{x:4,z:0}},[w])).toBe(true);
    expect(wallOverlap({...w,id:'b',a:{x:3,z:-2},b:{x:3,z:2}},[w])).toBe(false);
    expect(wallOverlap({...w,id:'b',a:{x:3,z:0},b:{x:3,z:2}},[w])).toBe(false);
  });
  it('el contorno no elimina silenciosamente paredes interiores',()=>{
    const c=initialConfig();useConfigurator.setState({config:c,past:[],future:[]});
    useConfigurator.getState().setContour(c.contour.map(p=>({x:p.x+20,z:p.z})));
    expect(useConfigurator.getState().config).toEqual(c);
    expect(useConfigurator.getState().error).not.toBeNull();
  });
  it("contorno × plantas determina precio sin redondear metros", () => {
    const c = resizeConfig(initialConfig(), { contour: presetPolygon("L", 40.25) });
    expect(c.m2).toBeCloseTo(40.25);
    expect(configPrice({ ...c, extraOpenings: 0 }).base).toBe(34212.5);
  });
  it("reescala el contorno a 120 m² en tres plantas", () => {
    const c = resizeConfig(initialConfig(), { m2: 120, floors: 3 });
    expect(polygonArea(c.contour)).toBeCloseTo(40);
    expect(c.m2).toBeCloseTo(120);
  });
  it("rechaza lados menores a 1,5m", () => {
    expect(
      validateContour(
        [
          { x: 0, z: 0 },
          { x: 10, z: 0 },
          { x: 10, z: 1 },
          { x: 0, z: 1 },
        ],
        1,
      ),
    ).toContain("1,5");
  });
  it("rechaza cruces", () => {
    expect(
      validateContour(
        [
          { x: 0, z: 0 },
          { x: 7, z: 7 },
          { x: 0, z: 7 },
          { x: 7, z: 0 },
          { x: 0, z: 4 },
        ],
        1,
      ),
    ).not.toBeNull();
  });
  it("detecta ambientes al dividir con encuentros T", () => {
    const p = [
      { x: 0, z: 0 },
      { x: 8, z: 0 },
      { x: 8, z: 6 },
      { x: 0, z: 6 },
    ];
    const rooms = detectRooms(p, [
      { id: "a", a: { x: 0, z: 3 }, b: { x: 8, z: 3 }, thickness: 0.1, height: 2.65 },
      { id: "b", a: { x: 4, z: 3 }, b: { x: 4, z: 6 }, thickness: 0.1, height: 2.65 },
    ]);
    expect(rooms.map((r) => r.area).sort((a, b) => a - b)).toEqual([12, 12, 24]);
  });
  it("peldaños cumplen contrahuella huella y Blondel", () => {
    const g = stairGeometry(stair, 2.85);
    expect(g.rise).toBeGreaterThanOrEqual(0.17);
    expect(g.rise).toBeLessThanOrEqual(0.19);
    expect(g.tread).toBeGreaterThanOrEqual(0.24);
    expect(g.tread).toBeLessThanOrEqual(0.28);
    expect(g.blondel).toBeGreaterThanOrEqual(0.6);
    expect(g.blondel).toBeLessThanOrEqual(0.64);
    expect(g.steps.at(-1)?.y).toBeCloseTo(2.85);
  });
  it("hueco empieza donde se necesita paso libre 2m", () => {
    const g = stairGeometry(stair, 2.85);
    const start = Math.min(...g.hole.map((p) => p.z)) - stair.z;
    expect(start).toBeCloseTo(Math.floor((2.85 - GEOMETRY.slabThickness - 2) / g.rise) * g.tread);
  });
  it("rechaza huecos fuera y paredes de planta superior", () => {
    const p = presetPolygon("rectangular", 80);
    expect(validateStair({ ...stair, x: 100 }, p, [], 2.85)).not.toBeNull();
    expect(
      validateStair(
        stair,
        p,
        [{ id: "w", a: { x: -2, z: 0 }, b: { x: 2, z: 0 }, thickness: 0.1, height: 2.65 }],
        2.85,
      ),
    ).not.toBeNull();
  });
  it("módulos de techo cubren el área L U T y escalonada", () => {
    for (const shape of ["L", "U", "T", "escalonada"] as const) {
      const p = presetPolygon(shape, 100);
      expect(roofModules(p).reduce((a, r) => a + polygonArea(r), 0)).toBeCloseTo(100);
    }
  });
  it('faldones L U T y escalonados cubren 100 m² y coinciden en los encuentros',()=>{
    for(const shape of ['rectangular','L','U','T','escalonada'] as const)for(const direction of ['x','z'] as const){
      const contour=presetPolygon(shape,100),faces=roofFaces(contour,direction,Math.tan(20*Math.PI/180));
      expect(faces.reduce((sum,f)=>sum+polygonArea(f.rings[0]??[])-f.rings.slice(1).reduce((s,r)=>s+polygonArea(r),0),0)).toBeCloseTo(100,5);
      let seams=0;
      for(const face of faces)for(const p of face.rings.flat()){
        expect(Number.isFinite(planeHeight(face.plane,p))).toBe(true);
        for(const other of faces){if(other===face)continue;
          if(other.rings.some(r=>r.some((a,i)=>distance(project(p,a,r[(i+1)%r.length]??a).point,p)<1e-6))){
            expect(planeHeight(face.plane,p)).toBeCloseTo(planeHeight(other.plane,p),5);seams++;
          }
        }
      }
      expect(seams).toBeGreaterThan(0);
    }
  });
  it("historial conserva más de 50 acciones", () => {
    useConfigurator.setState({ config: initialConfig(), past: [], future: [] });
    for (let i = 0; i < 70; i++) useConfigurator.getState().update({ roofPitch: i % 2 ? 20 : 21 });
    expect(useConfigurator.getState().past).toHaveLength(70);
    for (let i = 0; i < 70; i++) useConfigurator.getState().undo();
    expect(useConfigurator.getState().config).toEqual(initialConfig());
  });
  it("link comprimido restaura exactamente diseño", () => {
    const c = initialConfig();
    expect(decodeDesign(encodeDesign(c))).toEqual(c);
    expect(decodeDesign("invalid")).toBeNull();
  });
  it("todos ajustes nuevos empiezan en cero", () => {
    expect(ADJUSTMENTS.perStair).toBe(0);
    expect(ADJUSTMENTS.perCounter).toBe(0);
    expect(ADJUSTMENTS.contourPerM2).toBe(0);
  });
  it("en blanco no deja paredes mesadas escaleras o aberturas", () => {
    useConfigurator.setState({ config: initialConfig(), past: [], future: [] });
    useConfigurator.getState().layout(true);
    const c = useConfigurator.getState().config;
    expect(c.walls).toEqual([[]]);
    expect(c.counters).toEqual([]);
    expect(c.stairs).toEqual([]);
    expect(c.openings).toEqual([]);
  });
  it('todos peldaños altos de U quedan dentro del hueco',()=>{const s={...stair,type:'U' as const};const g=stairGeometry(s,2.85);for(const t of g.steps.filter(t=>2.85-GEOMETRY.slabThickness-t.y<2)){expect(inside(transformPoint({x:t.x,z:t.z},s.x,s.z,s.rotation),g.hole)).toBe(true);}});
  it('pared superior no puede invadir hueco existente',()=>{const c=resizeConfig(initialConfig(),{m2:120,floors:2,walls:[[],[]]});c.stairs=[{...stair,z:-2}];useConfigurator.setState({config:c,past:[],future:[],activeFloor:1});useConfigurator.getState().addWall({x:-3,z:0},{x:3,z:0});expect(useConfigurator.getState().config.walls[1]).toEqual([]);expect(useConfigurator.getState().error).not.toBeNull();});

 it('reescala paredes alrededor del centro de contorno trasladado',()=>{const c=resizeConfig(initialConfig(),{m2:40});c.contour=c.contour.map(p=>({x:p.x+10,z:p.z+12}));c.walls=[[{id:'wall-test',a:{x:8,z:12},b:{x:12,z:12},height:2.65,thickness:0.1}]];c.stairs=[];const n=resizeConfig(c,{m2:160});expect(n.walls[0]?.[0]?.a.x).toBeCloseTo(6);expect(n.walls[0]?.[0]?.a.z).toBe(12);expect(n.walls[0]?.[0]?.b.x).toBeCloseTo(14);expect(n.walls[0]?.[0]?.b.z).toBe(12);});
 it('ambientes de encuentro T suman 48 m² sin contar la cara exterior',()=>{const p=presetPolygon('rectangular',48),b={minX:Math.min(...p.map(p=>p.x)),maxX:Math.max(...p.map(p=>p.x)),minZ:Math.min(...p.map(p=>p.z)),maxZ:Math.max(...p.map(p=>p.z))};const rooms=detectRooms(p,[{id:'a',a:{x:b.minX,z:0},b:{x:b.maxX,z:0},height:2.65,thickness:0.1},{id:'b',a:{x:0,z:0},b:{x:0,z:b.maxZ},height:2.65,thickness:0.1}]);expect(rooms).toHaveLength(3);expect(rooms.reduce((sum,r)=>sum+r.area,0)).toBeCloseTo(48);});

});
