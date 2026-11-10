/**
 * Google Analytics 4. Mientras GA_MEASUREMENT_ID esté vacío no se carga nada y no se envía ningún dato.
 * Para activarlo: pegar el ID de medición (formato G-XXXXXXXXXX) entre las comillas.
 * Los eventos (clic en WhatsApp, formularios, obras, servicios, redes y sistemas) ya están definidos en
 * src/components/home/ConversionEvents.tsx y se envían solos en cuanto GA4 está activo.
 */
export const GA_MEASUREMENT_ID = "";

export const isValidMeasurementId = (id: string): boolean => /^G-[A-Z0-9]{6,12}$/.test(id);
