import { useEffect, useRef, useState, type RefObject } from "react";
import { HERO_MAIN_ID, HERO_SCENES, HERO_TIMING, heroDwellMs, heroPlaylist, type HeroScene } from "@/data/heroScenes";

export type HeroLayers = {
  /** Obra que se ve ahora. */
  current: HeroScene;
  /** Obra que se está yendo (solo durante el fundido). */
  leaving: HeroScene | null;
};

const byId = (id: string) => HERO_SCENES.find(scene => scene.id === id) ?? HERO_SCENES[0];

/** Descarga y decodifica la foto de una obra antes de mostrarla; si falla, esa obra se saltea. */
function ready(scene: HeroScene): Promise<boolean> {
  const image = new Image();
  image.src = window.matchMedia("(max-width: 767px)").matches ? scene.small : scene.src;
  const timeout = new Promise<boolean>(resolve => window.setTimeout(() => resolve(false), 4000));
  return Promise.race([image.decode().then(() => true, () => false), timeout]);
}

/**
 * Hero: arranca siempre en la casa principal (Lo de Cata), recorre las demás obras con un fundido suave
 * y vuelve a la principal, que queda fija al terminar la vuelta. No se mueve si la persona pidió menos
 * movimiento, ni con la pestaña oculta, ni cuando el hero no se está viendo.
 */
export function useHeroRotation(sectionRef: RefObject<HTMLElement | null>): HeroLayers & { skip: () => void } {
  const [layers, setLayers] = useState<HeroLayers>({ current: byId(HERO_MAIN_ID), leaving: null });
  const visible = useRef(true);
  const failed = useRef(new Set<string>());

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => { visible.current = entries.some(entry => entry.isIntersecting); }, { threshold: 0.2 });
    observer.observe(section);
    return () => observer.disconnect();
  }, [sectionRef]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const playlist = heroPlaylist();
    let index = 0;
    let cancelled = false;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

    const tick = async () => {
      if (cancelled) return;
      if (document.hidden || !visible.current) return later(tick, 1000);
      let next = index + 1;
      // Salta las obras cuya foto no se pudo cargar; la principal siempre está disponible.
      while (next < playlist.length && failed.current.has(playlist[next]!)) next++;
      if (next >= playlist.length) return;
      const scene = byId(playlist[next]!);
      if (scene.id !== HERO_MAIN_ID && !(await ready(scene))) { failed.current.add(scene.id); return tick(); }
      if (cancelled) return;
      index = next;
      setLayers(previous => ({ current: scene, leaving: previous.current }));
      later(() => setLayers(previous => ({ ...previous, leaving: null })), HERO_TIMING.fadeMs + 150);
      if (index < playlist.length - 1) later(tick, heroDwellMs(scene.id));
    };

    later(tick, heroDwellMs(HERO_MAIN_ID));
    // Mientras mira la casa principal se van descargando las otras, para que el cambio no espere a la red.
    later(() => HERO_SCENES.filter(scene => scene.id !== HERO_MAIN_ID).forEach(scene => { void ready(scene); }), 2500);
    return () => { cancelled = true; timers.forEach(id => window.clearTimeout(id)); };
  }, []);

  /** Si una foto falla al mostrarse, vuelve a la principal. */
  const skip = () => setLayers({ current: byId(HERO_MAIN_ID), leaving: null });
  return { ...layers, skip };
}
