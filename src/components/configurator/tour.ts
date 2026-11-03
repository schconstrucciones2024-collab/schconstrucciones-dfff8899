/**
 * Recorrido automático del visor: vuelta exterior y barrido suave por el interior.
 * Son funciones puras (sin Three) para poder probarlas y para que el visor y la grabación usen los mismos tiempos.
 */
export type Vec3 = [number, number, number];
export type CameraPose = { position: Vec3; target: Vec3 };

/** Segundos de la vuelta exterior. */
export const TOUR_EXTERIOR_S = 9;
/** Segundos del barrido interior que sigue a la vuelta exterior. */
export const TOUR_INTERIOR_S = 6;
/** Tiempo extra que sigue grabando después de terminar la vuelta exterior (barrido interior + un respiro). */
export const TOUR_TAIL_MS = TOUR_INTERIOR_S * 1000 + 800;

export const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Posición de la cámara en la vuelta exterior: gira alrededor de la casa (centrada en `center`) a altura constante. */
export function exteriorOrbitPose(elapsed: number, extent: number, height: number, center: { x: number; z: number } = { x: 0, z: 0 }): CameraPose {
  const a = 0.65 + elapsed * 0.45;
  return {
    position: [center.x + Math.sin(a) * extent * 1.6, height * 0.65 + extent * 0.45, center.z + Math.cos(a) * extent * 1.6],
    target: [center.x, height * 0.45, center.z],
  };
}

/**
 * Barrido interior: parte de la vista general (`base`), gira 0,7 rad alrededor del eje vertical que pasa por el objetivo
 * y baja la cámara hasta el 72 % de su altura. Con t = 0 devuelve exactamente la vista de partida.
 */
export function interiorSweepPose(base: CameraPose, t: number, duration: number): CameraPose {
  const p = easeInOut(duration > 0 ? t / duration : 1);
  const yaw = 0.7 * p;
  const ox = base.position[0] - base.target[0];
  const oy = base.position[1] - base.target[1];
  const oz = base.position[2] - base.target[2];
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  return {
    position: [base.target[0] + ox * cos + oz * sin, base.target[1] + oy * (1 - 0.28 * p), base.target[2] - ox * sin + oz * cos],
    target: base.target,
  };
}
