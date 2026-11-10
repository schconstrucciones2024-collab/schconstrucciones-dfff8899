import { useEffect } from "react";
import { GA_MEASUREMENT_ID, isValidMeasurementId } from "@/config/analytics";

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/**
 * Carga Google Analytics 4 solo si hay un ID de medición válido en src/config/analytics.ts.
 * Sin ID no descarga nada ni envía datos. Los eventos propios los emite ConversionEvents.tsx.
 */
export function Analytics() {
  useEffect(() => {
    if (!isValidMeasurementId(GA_MEASUREMENT_ID)) return;
    const w = window as GtagWindow;
    if (w.gtag) return;
    w.dataLayer = w.dataLayer || [];
    // gtag.js espera el objeto `arguments` (no un arreglo) dentro de dataLayer.
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag("js", new Date());
    w.gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  }, []);
  return null;
}
