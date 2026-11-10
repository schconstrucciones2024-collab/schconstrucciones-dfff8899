import { describe, expect, it } from 'vitest';
import { chooseHeroScene, HERO_SCENES } from './heroScenes';

describe('Hero SCH por visita', () => {
  it('usa solamente las cinco obras solicitadas', () => {
    expect(HERO_SCENES.map(s => s.id)).toEqual(['lo-de-cata', 'laslu', 'la-diosa', 'proyecto-2021', 'mi-sueno']);
  });
  it('mantiene la fotografía de toda la sesión', () => {
    expect(chooseHeroScene('mi-sueno', 'mi-sueno', 0)).toBe('mi-sueno');
  });
  it('evita repetir inmediatamente la última obra en una nueva visita', () => {
    for (const scene of HERO_SCENES) for (const value of [0, .24, .5, .75, .999]) {
      expect(chooseHeroScene(null, scene.id, value)).not.toBe(scene.id);
    }
  });
  it('descarta valores de sesión desconocidos', () => {
    expect(chooseHeroScene('unknown', null, 0)).toBe('lo-de-cata');
  });
  it('cada obra tiene un encuadre propio para pantallas anchas (sin recortar la casa en celulares)', () => {
    for (const scene of HERO_SCENES) expect(scene.focus, scene.id).toMatch(/^\d{1,3}% \d{1,3}%$/);
  });
});
