import { beforeEach, describe, expect, it } from "vitest";
import LZString from "lz-string";
import { PLAN_CATALOG } from "@/config/layoutProposals";
import { DEFAULT_DECK } from "@/config/deck";
import { DEFAULT_PARRILLERO } from "@/config/parrillero";
import { buildLayoutProposal, decodeDesign, encodeDesign, initialConfig, useConfigurator } from "./useConfigurator";

const st = () => useConfigurator.getState();
const fresh = () =>
  useConfigurator.setState({
    config: initialConfig(),
    past: [],
    future: [],
    selectedId: null,
    error: null,
    activeFloor: 0,
  });

describe("parrillero en el estado del diseño (un solo estado)", () => {
  beforeEach(fresh);

  it("arranca apagado y tocarlo no cambia nada más del diseño", () => {
    const before = st().config;
    expect(before.parrillero).toEqual(DEFAULT_PARRILLERO);
    expect(before.parrillero.enabled).toBe(false);
    st().setParrillero({ enabled: true, finish: "revoque", side: "derecho" });
    const after = st().config;
    expect(after.parrillero).toEqual({ enabled: true, finish: "revoque", side: "derecho", sink: true });
    expect({ ...after, parrillero: before.parrillero }).toEqual(before);
  });

  it("la terminación y la ubicación se eligen antes o después de agregarlo; quitarlo no pierde lo elegido", () => {
    st().setParrillero({ finish: "revoque" });
    expect(st().config.parrillero).toMatchObject({ enabled: false, finish: "revoque" });
    st().setParrillero({ enabled: true });
    st().setParrillero({ side: "derecho", sink: false });
    expect(st().config.parrillero).toEqual({ enabled: true, finish: "revoque", side: "derecho", sink: false });
    st().setParrillero({ enabled: false });
    expect(st().config.parrillero).toEqual({ enabled: false, finish: "revoque", side: "derecho", sink: false });
  });

  it("un valor inválido vuelve al de fábrica", () => {
    st().setParrillero({ enabled: true, finish: "marmol" as never, side: "arriba" as never });
    expect(st().config.parrillero).toMatchObject({ enabled: true, finish: "ladrillo", side: "izquierdo" });
    st().setParrillero({ enabled: "sí" as never });
    expect(st().config.parrillero.enabled).toBe(false);
  });

  it("se puede deshacer y rehacer, incluida la terminación", () => {
    st().setParrillero({ enabled: true });
    st().setParrillero({ finish: "revoque" });
    st().undo();
    expect(st().config.parrillero).toMatchObject({ enabled: true, finish: "ladrillo" });
    st().undo();
    expect(st().config.parrillero.enabled).toBe(false);
    st().redo();
    st().redo();
    expect(st().config.parrillero).toMatchObject({ enabled: true, finish: "revoque" });
  });

  it("viaja en el link compartido, junto al deck", () => {
    st().setDeck({ enabled: true, roofed: true, width: 9, fullFront: false });
    st().setParrillero({ enabled: true, finish: "revoque", side: "derecho", sink: false });
    const back = decodeDesign(encodeDesign(st().config));
    expect(back?.parrillero).toEqual(st().config.parrillero);
    expect(back?.deck).toEqual(st().config.deck);
  });

  it("un diseño o link anterior, sin parrillero, se abre sin parrillero; datos rotos también", () => {
    const old: Record<string, unknown> = { ...initialConfig() };
    delete old.parrillero;
    const open = (config: unknown) => decodeDesign(LZString.compressToEncodedURIComponent(JSON.stringify({ version: 2, config })));
    expect(open(old)?.parrillero).toEqual(DEFAULT_PARRILLERO);
    expect(open({ ...old, parrillero: { enabled: "sí", finish: 3, side: null, sink: 0 } })?.parrillero).toEqual({
      ...DEFAULT_PARRILLERO,
      sink: true,
    });
    expect(open({ ...old, parrillero: { enabled: true, finish: "revoque" } })?.parrillero).toEqual({
      enabled: true,
      finish: "revoque",
      side: "izquierdo",
      sink: true,
    });
  });

  it("los demás cambios del diseño no tocan el parrillero; al aplicar una distribución se mantiene y al reiniciar se apaga", () => {
    st().setParrillero({ enabled: true, finish: "revoque", side: "derecho" });
    st().update({ m2: 70 });
    st().update({ finish: "esencial" });
    expect(st().config.parrillero).toMatchObject({ enabled: true, finish: "revoque", side: "derecho" });
    const plan = PLAN_CATALOG.find((p) => p.version === 2)!;
    useConfigurator.setState({ config: buildLayoutProposal(st().config, plan) });
    expect(st().config.parrillero.enabled).toBe(true);
    st().reset();
    expect(st().config.parrillero).toEqual(DEFAULT_PARRILLERO);
  });

  it("el deck y el parrillero son estados independientes: apagar el deck deja el parrillero como está", () => {
    st().setDeck({ enabled: true, roofed: true });
    st().setParrillero({ enabled: true, finish: "revoque" });
    st().setDeck({ enabled: false });
    expect(st().config.deck.enabled).toBe(false);
    expect(st().config.parrillero).toMatchObject({ enabled: true, finish: "revoque" });
    st().setDeck({ enabled: true });
    st().setParrillero({ enabled: false });
    expect(st().config.deck.enabled).toBe(true);
    expect(st().config.deck.roofed).toBe(false);
    // El deck vuelve a ser el de siempre: sin parrillero no hay nada que recortar.
    expect({ ...st().config.deck }).toMatchObject({ ...DEFAULT_DECK, enabled: true });
  });
});
