import { describe, it, expect, beforeEach } from 'vitest';
import { initialConfig, entranceStair, canUseFloors, houseDimensions, resizeConfig, validateOpening, useConfigurator, type Opening } from './useConfigurator';
import { OPENINGS_CATALOG } from '@/config/openingsCatalog';
import { configPrice, configWhatsAppText, ADJUSTMENTS } from '@/config/pricing';
const opening = (patch: Partial<Opening> = {}): Opening => ({ id: 'test', type: 'ventana', wall: 'left', floor: 0, offset: 0, manual: true, ...patch });
describe('configurador paramétrico', () => {
  beforeEach(() => useConfigurator.setState({ config: initialConfig(), past: [], future: [], selectedId: null, error: null }));
  it('conserva 48 m² iniciales y tarifas 850/900/990', () => {
    const c = initialConfig(); expect(c.m2).toBe(48);
    for (const [finish, total] of [['rustica', 40800], ['moderna', 43200], ['allwood', 47520]] as const) expect(configPrice({ ...c, finish, extraOpenings: 0 }).total).toBe(total);
  });
  it('el diseño inicial tiene ventanal corredizo en la entrada', () => {
    const c = initialConfig();
    expect(c.openings.some(o => o.type === 'ventanal' && o.wall === 'edge-2')).toBe(true);
    expect(c.openings.some(o => o.type === 'entrada')).toBe(false);
  });
  it('el diseño inicial es la distribución Compacta abierta', () => {
    const c = initialConfig(), d = houseDimensions(c);
    expect(c.m2).toBe(48);
    expect([d.width, d.depth].sort((a, b) => a - b)).toEqual([6, 8]);
    expect(Object.values(c.roomLabels)).toContain('Dormitorio');
    expect(Object.values(c.roomLabels)).toContain('Baño');
    expect(c.counters.some(v => v.kind === 'cocina')).toBe(true);
  });
  it('apretar "Distribución sugerida" sobre la Compacta abierta no la cambia', () => {
    const before = initialConfig();
    useConfigurator.setState({ config: before, past: [], future: [] });
    useConfigurator.getState().layout(false);
    const after = useConfigurator.getState().config;
    expect(JSON.stringify(after.walls)).toBe(JSON.stringify(before.walls));
    expect(JSON.stringify(after.fixtures)).toBe(JSON.stringify(before.fixtures));
    expect(JSON.stringify(after.counters)).toBe(JSON.stringify(before.counters));
    expect(JSON.stringify(after.openings)).toBe(JSON.stringify(before.openings));
  });
  it('la escalera exterior mide lo mismo que el ventanal de la entrada', () => {
    const c = initialConfig(), v = c.openings.find(o => o.type === 'ventanal' && o.wall === 'edge-2');
    expect(v).toBeDefined();
    expect(entranceStair().width).toBe(OPENINGS_CATALOG.ventanal.width);
    expect(c.stairs.find(s => s.exterior)?.width).toBe(OPENINGS_CATALOG.ventanal.width);
  });
  it('requiere 20 m² por planta para varias plantas', () => {
    expect(canUseFloors(39, 2)).toBe(false); expect(canUseFloors(40, 2)).toBe(true);
    expect(canUseFloors(59, 3)).toBe(false); expect(canUseFloors(60, 3)).toBe(true); expect(canUseFloors(10, 1)).toBe(true);
  });
  it('limita superficie a 10–200 y reparte metraje total sin multiplicarlo', () => {
    expect(resizeConfig(initialConfig(), { m2: 1 }).m2).toBe(10); expect(resizeConfig(initialConfig(), { m2: 250 }).m2).toBe(200);
    const c = resizeConfig(initialConfig(), { m2: 60, floors: 3 }); const d = houseDimensions(c); expect(d.width * d.depth * 3).toBeCloseTo(60); expect(d.area).toBe(20);
  });
  it('mantiene ajustes opcionales en cero', () => {
    expect(ADJUSTMENTS.foundationPerM2).toEqual({ hormigon: 0, madera: 0 }); expect(ADJUSTMENTS.perExtraFloor).toBe(0); expect(ADJUSTMENTS.perExtraOpening).toBe(0); expect(Object.values(ADJUSTMENTS.roofPerM2)).toEqual([0, 0, 0]);
  });
  it('aplica logística 10% por separado: 40800 + 4080 = 44880', () => {
    const p = configPrice({ ...initialConfig(), extraOpenings: 0, logistics: { zoneId: 'medium', separateTrip: false } }); expect(p.base).toBe(40800); expect(p.surcharge).toBe(4080); expect(p.total).toBe(44880);
  });
  it('rechaza esquinas, superposición y puertas interiores afuera', () => {
    const c = initialConfig(); expect(validateOpening(c, opening({ offset: 100 }))).not.toBeNull();
    const first = c.openings[0]; if (!first) throw new Error('Falta abertura sugerida'); expect(validateOpening(c, { ...first, id: 'another' }, 'another')).not.toBeNull();
    expect(validateOpening(c, opening({ type: 'interior', wall: 'left' }))).not.toBeNull(); expect(validateOpening(c, opening({ type: 'entrada', wall: 'partition' }))).not.toBeNull();
  });
  it('coloca, mueve a grilla de 10 cm, elimina y deshace/rehace', () => {
    const s = useConfigurator.getState(); expect(s.addOpening({ type: 'ventana', wall: 'left', floor: 0, offset: 0.04 })).toBe(true);
    const id = useConfigurator.getState().selectedId; expect(id).not.toBeNull(); if (!id) return;
    s.editOpening(id, { offset: 0.26 }); expect(useConfigurator.getState().config.openings.find(o => o.id === id)?.offset).toBe(0.3);
    s.deleteOpening(id); expect(useConfigurator.getState().config.openings.find(o => o.id === id)).toBeUndefined();
    s.undo(); expect(useConfigurator.getState().config.openings.find(o => o.id === id)).toBeDefined(); s.redo(); expect(useConfigurator.getState().config.openings.find(o => o.id === id)).toBeUndefined();
  });
  it('conserva y reubica manuales al redimensionar', () => {
    const c = initialConfig(); c.openings.push(opening()); const n = resizeConfig(c, { m2: 80, floors: 2 }); expect(n.openings.find(o => o.id === 'test')?.manual).toBe(true); expect(n.openings.some(o => o.floor === 1)).toBe(true); expect(n.openings.every(o => validateOpening(n, o) === null)).toBe(true);
  });
  it('WhatsApp incluye configuración completa y logística', () => {
    const text = configWhatsAppText({ ...initialConfig(), extraOpenings: 0, openings: 5, logistics: { zoneId: 'medium', separateTrip: false } });
    for (const part of ['48 m²', '1 planta', 'RÚSTICA', 'pilotes de madera curada', 'Doble agua', 'Aberturas: 5', 'USD 40.800', '10%', 'USD 4.080', 'USD 44.880']) expect(text).toContain(part);
  });
});

describe('cimentación inicial', () => {
  it('arranca con pilotes de madera curada', () => { expect(initialConfig().foundation).toBe('madera'); });
});
