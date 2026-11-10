import { describe, expect, it } from "vitest";
import { GA_MEASUREMENT_ID, isValidMeasurementId } from "./analytics";

describe("Google Analytics 4", () => {
  it("valida el formato G-XXXXXXXXXX", () => {
    expect(isValidMeasurementId("G-ABC123XYZ9")).toBe(true);
    expect(isValidMeasurementId("G-XXXXXXXXXX")).toBe(true);
    expect(isValidMeasurementId("")).toBe(false);
    expect(isValidMeasurementId("UA-12345-1")).toBe(false);
    expect(isValidMeasurementId("g-abc123xyz9")).toBe(false);
    expect(isValidMeasurementId("G-<script>")).toBe(false);
  });

  it("o está vacío (no carga nada) o es un ID válido", () => {
    expect(GA_MEASUREMENT_ID === "" || isValidMeasurementId(GA_MEASUREMENT_ID)).toBe(true);
  });
});
