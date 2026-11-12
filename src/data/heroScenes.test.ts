import { describe, expect, it } from 'vitest';
import { HERO_MAIN_ID, HERO_SCENES, HERO_TIMING, heroDwellMs, heroPlaylist } from './heroScenes';

describe('Hero SCH', () => {
  it('usa solamente las cinco obras solicitadas', () => {
    expect(HERO_SCENES.map(s => s.id)).toEqual(['lo-de-cata', 'laslu', 'la-diosa', 'proyecto-2021', 'mi-sueno']);
  });
  it('la casa principal es Lo de Cata (la celeste con piscina) y es la primera escena', () => {
    expect(HERO_MAIN_ID).toBe('lo-de-cata');
    expect(HERO_SCENES[0].id).toBe(HERO_MAIN_ID);
  });
  it('cada obra tiene un encuadre propio para pantallas anchas (sin recortar la casa en celulares)', () => {
    for (const scene of HERO_SCENES) expect(scene.focus, scene.id).toMatch(/^\d{1,3}% \d{1,3}%$/);
  });

  describe('rotación', () => {
    const playlist = heroPlaylist();
    it('abre y cierra con la casa principal', () => {
      expect(playlist[0]).toBe(HERO_MAIN_ID);
      expect(playlist.at(-1)).toBe(HERO_MAIN_ID);
    });
    it('muestra las cinco obras y la principal vuelve entre cada par de obras', () => {
      expect(new Set(playlist)).toEqual(new Set(HERO_SCENES.map(s => s.id)));
      expect(playlist).toEqual(['lo-de-cata', 'laslu', 'la-diosa', 'lo-de-cata', 'proyecto-2021', 'mi-sueno', 'lo-de-cata']);
    });
    it('nunca repite la misma obra dos veces seguidas', () => {
      playlist.forEach((id, i) => { if (i > 0) expect(id).not.toBe(playlist[i - 1]); });
    });
    it('la casa principal se queda más del doble que cada una de las otras obras', () => {
      expect(heroDwellMs(HERO_MAIN_ID)).toBeGreaterThanOrEqual(2 * heroDwellMs('laslu'));
      expect(heroDwellMs('mi-sueno')).toBe(HERO_TIMING.otherMs);
    });
    it('al menos la mitad del tiempo en pantalla es la casa principal', () => {
      const shown = playlist.slice(0, -1); // la última queda fija, no cuenta como "vuelta"
      const total = shown.reduce((sum, id) => sum + heroDwellMs(id), 0);
      const main = shown.filter(id => id === HERO_MAIN_ID).reduce((sum, id) => sum + heroDwellMs(id), 0);
      expect(main / total).toBeGreaterThan(0.5);
    });
    it('funciona con una lista distinta de obras', () => {
      expect(heroPlaylist([{ id: 'lo-de-cata' }, { id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual(['lo-de-cata', 'a', 'b', 'lo-de-cata', 'c', 'lo-de-cata']);
    });
  });
});
