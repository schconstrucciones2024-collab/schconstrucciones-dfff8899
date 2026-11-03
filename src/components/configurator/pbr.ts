import * as THREE from 'three';
import { drawMaterial, materialTextureUrl, MATERIAL_TILE_M, type MaterialKind } from '@/config/materials';

type Bundle = { normalMap: THREE.Texture; roughnessMap: THREE.Texture; aoMap: THREE.Texture };
const bundles = new WeakMap<THREE.Texture, Bundle>();
const tileRepeat = (kind: MaterialKind) => 1 / (MATERIAL_TILE_M[kind] ?? 1);

/**
 * Versión provisoria y sincrónica (se dibuja en el navegador). Se usa mientras se descargan los mapas reales
 * y como respaldo si no se pueden cargar. UV en metros; los mapas de datos quedan lineales.
 */
export function createPBR(kind:MaterialKind,size:number){
 const color=drawMaterial(kind,size),ctx=color.getContext('2d');if(!ctx)throw new Error('No se pudo generar el material.');
 const pixels=ctx.getImageData(0,0,size,size).data,normal=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),ao=new Uint8Array(size*size*4);
 const height=(x:number,y:number)=>{const i=(((y+size)%size)*size+(x+size)%size)*4;return ((pixels[i]??0)+(pixels[i+1]??0)+(pixels[i+2]??0))/765;};
 const strength=kind==='drywall'?0.3:kind==='arena'?0.65:2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,h=height(x,y),dx=(height(x-1,y)-height(x+1,y))*strength,dz=(height(x,y-1)-height(x,y+1))*strength,l=Math.hypot(dx,dz,1);normal[i]=Math.round((dx/l+1)*127.5);normal[i+1]=Math.round((dz/l+1)*127.5);normal[i+2]=Math.round((1/l+1)*127.5);normal[i+3]=255;const r=kind==='chapa'?130:kind==='drywall'?240:Math.round(190+h*55);rough.fill(r,i,i+3);rough[i+3]=255;const a=Math.round(180+h*75);ao.fill(a,i,i+3);ao[i+3]=255;}
 const map=new THREE.CanvasTexture(color);map.colorSpace=THREE.SRGBColorSpace;
 const normalMap=new THREE.DataTexture(normal,size,size),roughnessMap=new THREE.DataTexture(rough,size,size),aoMap=new THREE.DataTexture(ao,size,size);
 const repeat=tileRepeat(kind);
 for(const t of [map,normalMap,roughnessMap,aoMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.needsUpdate=true;}
 bundles.set(map,{normalMap,roughnessMap,aoMap});
 return map;
}

type Entry = { refs: number; disposed: boolean; timer: ReturnType<typeof setTimeout> | null; textures: THREE.Texture[]; promise: Promise<THREE.Texture> };
const cache = new Map<string, Entry>();
let loader: THREE.TextureLoader | null = null;

function loadTexture(url: string) {
  if (!loader) loader = new THREE.TextureLoader();
  const l = loader;
  return new Promise<THREE.Texture>((resolve, reject) => {
    l.load(url, resolve, undefined, () => reject(new Error(`No se pudo cargar la textura ${url}`)));
  });
}

export type PBRHandle = {
  /** Se resuelve con el mapa de color ya cargado (usar `pbrProps` para el resto) y se rechaza si no se pudo cargar. */
  promise: Promise<THREE.Texture>;
  /** Devuelve la referencia; cuando nadie usa el material se libera de la memoria de video. */
  release: () => void;
};

/**
 * Carga los mapas PBR reales de `public/textures/` (color, normal y ORM). Cada material se descarga una sola vez
 * aunque lo usen varias piezas de la casa, y se comparte entre ellas. El mapa ORM sirve como oclusión (R) y rugosidad (G).
 * `low` usa las versiones de 512 px y menos anisotropía (celulares).
 */
export function loadPBR(kind: MaterialKind, low: boolean): PBRHandle {
  const key = `${kind}:${low ? 'low' : 'high'}`;
  let entry = cache.get(key);
  if (!entry) {
    const fresh = { refs: 0, disposed: false, timer: null, textures: [] } as unknown as Entry;
    fresh.promise = Promise.all([
      loadTexture(materialTextureUrl(kind, 'albedo', low)),
      loadTexture(materialTextureUrl(kind, 'normal', low)),
      loadTexture(materialTextureUrl(kind, 'orm', low)),
    ]).then(([map, normalMap, orm]) => {
      fresh.textures = [map, normalMap, orm];
      if (fresh.disposed) {
        for (const t of fresh.textures) t.dispose();
        throw new Error('Material liberado antes de terminar de cargar.');
      }
      const repeat = tileRepeat(kind);
      const anisotropy = low ? 4 : 16;
      for (const t of fresh.textures) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat, repeat);
        t.anisotropy = anisotropy;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.needsUpdate = true;
      }
      map.colorSpace = THREE.SRGBColorSpace;
      normalMap.colorSpace = THREE.NoColorSpace;
      orm.colorSpace = THREE.NoColorSpace;
      bundles.set(map, { normalMap, roughnessMap: orm, aoMap: orm });
      return map;
    }).catch((error: unknown) => {
      if (cache.get(key) === fresh) cache.delete(key);
      throw error;
    });
    cache.set(key, fresh);
    entry = fresh;
  }
  const current = entry;
  current.refs += 1;
  if (current.timer) { clearTimeout(current.timer); current.timer = null; }
  let released = false;
  return {
    promise: current.promise,
    release: () => {
      if (released) return;
      released = true;
      current.refs -= 1;
      if (current.refs > 0) return;
      // Pequeña espera: si el mismo material se vuelve a pedir enseguida (cambio de terminación), se reutiliza.
      current.timer = setTimeout(() => {
        current.timer = null;
        if (current.refs > 0) return;
        current.disposed = true;
        if (cache.get(key) === current) cache.delete(key);
        for (const t of current.textures) t.dispose();
      }, 2000);
    },
  };
}

export function pbrProps(map?:THREE.Texture){return map?bundles.get(map)??{}:{};}
export function disposePBR(map:THREE.Texture){for(const t of Object.values(bundles.get(map)??{}))if(t instanceof THREE.Texture)t.dispose();map.dispose();}

export function linkPBR(source:THREE.Texture,target:THREE.Texture){const bundle=bundles.get(source);if(bundle)bundles.set(target,bundle);}

/**
 * Copia liviana del juego de mapas (comparte las imágenes) con la repetición multiplicada por `factor`.
 * Sirve para el terreno, que estira un plano de 80 m. Hay que repetir TODOS los mapas: cada uno tiene su propia transformación UV.
 * Se libera con `disposePBR` sin afectar al original compartido.
 */
export function repeatPBR(source: THREE.Texture, factor: number): THREE.Texture {
  const scaled = (t: THREE.Texture) => {
    const copy = t.clone();
    copy.repeat.set(t.repeat.x * factor, t.repeat.y * factor);
    copy.needsUpdate = true;
    return copy;
  };
  const map = scaled(source);
  const bundle = bundles.get(source);
  if (bundle) bundles.set(map, { normalMap: scaled(bundle.normalMap), roughnessMap: scaled(bundle.roughnessMap), aoMap: scaled(bundle.aoMap) });
  return map;
}
