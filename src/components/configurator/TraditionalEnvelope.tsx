import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { buildEnvelope, type PartStyle } from "@/config/envelope";
import { GEOMETRY } from "@/config/geometry";
import { exteriorThickness } from "@/config/systems";
import {
  FLOOR_STEP,
  WALL_HEIGHT,
  floorBase,
  foundationHeight,
  type HouseConfig,
} from "@/store/useConfigurator";
import { pbrProps } from "./pbr";

export type EnvelopeMaps = { concrete: THREE.Texture; plaster: THREE.Texture; roof: THREE.Texture };

function Surface({
  style,
  clasica,
  maps,
}: {
  style: PartStyle;
  clasica: boolean;
  maps: EnvelopeMaps;
}) {
  if (style === "metal")
    return (
      <meshStandardMaterial
        color="#454a50"
        metalness={0.45}
        roughness={0.5}
        side={THREE.DoubleSide}
      />
    );
  if (style === "pipe")
    return <meshStandardMaterial color="#c4c7cb" metalness={0.1} roughness={0.55} />;
  if (style === "roof") {
    // Clásica: membrana asfáltica mate. Esencial: chapa prepintada gris grafito, mate.
    return (
      <meshStandardMaterial
        {...pbrProps(maps.roof)}
        map={maps.roof}
        color={clasica ? "#ffffff" : "#6c7279"}
        metalness={clasica ? 0 : 0.25}
        roughness={1}
        side={THREE.DoubleSide}
      />
    );
  }
  const map = style === "concrete" ? maps.concrete : maps.plaster;
  return (
    <meshStandardMaterial {...pbrProps(map)} map={map} roughness={1} side={THREE.DoubleSide} />
  );
}

/**
 * Zócalo, cintas entre plantas y techo de la construcción tradicional (ver `config/envelope.ts`). Reemplaza al techo
 * de woodframe: la casa se ve de mampostería, con losa plana y antepecho (Clásica) o chapa prolija con cenefa y canaleta (Esencial).
 */
export function TraditionalEnvelope({ c, maps }: { c: HouseConfig; maps: EnvelopeMaps }) {
  const base = floorBase(c),
    ground = foundationHeight(c);
  const parts = useMemo(
    () =>
      buildEnvelope({
        contour: c.contour,
        finish: c.finish,
        thickness: exteriorThickness(c.finish),
        floors: c.floors,
        groundTop: ground,
        floorBase: base,
        floorStep: FLOOR_STEP,
        wallHeight: WALL_HEIGHT,
        slabThickness: GEOMETRY.slabThickness,
        roofType: c.roofType,
        roofPitch: c.roofPitch,
        roofDirection: c.roofDirection,
        overhang: c.overhang,
      }),
    [
      c.contour,
      c.finish,
      c.floors,
      c.roofType,
      c.roofPitch,
      c.roofDirection,
      c.overhang,
      ground,
      base,
    ],
  );
  useEffect(
    () => () => {
      for (const p of parts) p.geometry.dispose();
    },
    [parts],
  );
  return (
    <group>
      {parts.map((p) => (
        <mesh key={p.id} geometry={p.geometry} castShadow receiveShadow>
          <Surface style={p.style} clasica={c.finish === "clasica"} maps={maps} />
        </mesh>
      ))}
    </group>
  );
}
