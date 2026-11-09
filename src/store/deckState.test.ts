import { beforeEach, describe, expect, it } from "vitest";
import LZString from "lz-string";
import { PLAN_CATALOG } from "@/config/layoutProposals";
import { DEFAULT_DECK } from "@/config/deck";
import {
  buildLayoutProposal,
  decodeDesign,
  encodeDesign,
  initialConfig,
  useConfigurator,
} from "./useConfigurator";

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

describe("deck en el estado del diseño", () => {
  beforeEach(fresh);

  it("arranca apagado y no cambia el resto del diseño al tocarlo", () => {
    const before = st().config;
    expect(before.deck).toEqual(DEFAULT_DECK);
    st().setDeck({ enabled: true, roofed: true, width: 5, depth: 2.5, railFront: true });
    const after = st().config;
    expect(after.deck).toMatchObject({
      enabled: true,
      roofed: true,
      width: 5,
      depth: 2.5,
      railFront: true,
      steps: false,
    });
    expect({ ...after, deck: before.deck }).toEqual(before);
  });

  it("apagar el deck apaga el techo; las medidas no tienen límite comercial, solo el tope técnico del visor", () => {
    st().setDeck({ enabled: true, roofed: true });
    st().setDeck({ enabled: false });
    expect(st().config.deck.roofed).toBe(false);
    st().setDeck({ enabled: true, width: 99, depth: 0 });
    expect(st().config.deck.width).toBe(99);
    expect(st().config.deck.depth).toBe(1);
    st().setDeck({ width: 500, depth: 500 });
    expect(st().config.deck.width).toBe(100);
    expect(st().config.deck.depth).toBe(50);
  });

  it("por defecto el deck cubre todo el frente; al darle un frente propio deja de seguirlo", () => {
    st().setDeck({ enabled: true });
    expect(st().config.deck.fullFront).toBe(true);
    st().setDeck({ width: 5, fullFront: false });
    expect(st().config.deck.fullFront).toBe(false);
    expect(st().config.deck.width).toBe(5);
    st().setDeck({ fullFront: true });
    expect(st().config.deck.fullFront).toBe(true);
  });

  it("se puede deshacer y rehacer", () => {
    st().setDeck({ enabled: true });
    expect(st().config.deck.enabled).toBe(true);
    st().undo();
    expect(st().config.deck.enabled).toBe(false);
    st().redo();
    expect(st().config.deck.enabled).toBe(true);
  });

  it("viaja en el link compartido", () => {
    st().setDeck({ enabled: true, roofed: true, width: 6, depth: 3, railLeft: true, steps: true });
    const back = decodeDesign(encodeDesign(st().config));
    expect(back?.deck).toEqual(st().config.deck);
  });

  it("un diseño guardado antes del deck se abre con el deck apagado", () => {
    const old: Record<string, unknown> = { ...initialConfig() };
    delete old.deck;
    const text = LZString.compressToEncodedURIComponent(
      JSON.stringify({ version: 2, config: old }),
    );
    expect(decodeDesign(text)?.deck).toEqual(DEFAULT_DECK);
    const garbage = { ...old, deck: { enabled: "sí", roofed: 1, width: "x", depth: null } };
    expect(
      decodeDesign(
        LZString.compressToEncodedURIComponent(JSON.stringify({ version: 2, config: garbage })),
      )?.deck,
    ).toEqual(DEFAULT_DECK);
  });

  it("al aplicar una distribución sugerida el deck se mantiene; al reiniciar vuelve a apagarse", () => {
    st().setDeck({ enabled: true, roofed: true });
    const plan = PLAN_CATALOG.find((p) => p.version === 2)!;
    useConfigurator.setState({ config: buildLayoutProposal(st().config, plan) });
    expect(st().config.deck.enabled).toBe(true);
    expect(st().config.deck.roofed).toBe(true);
    st().reset();
    expect(st().config.deck).toEqual(DEFAULT_DECK);
  });

  it("cambiar la superficie o el sistema no toca el deck", () => {
    st().setDeck({ enabled: true, width: 6 });
    st().update({ m2: 70 });
    expect(st().config.deck.width).toBe(6);
    st().update({ finish: "esencial" });
    expect(st().config.deck.enabled).toBe(true);
  });
});
