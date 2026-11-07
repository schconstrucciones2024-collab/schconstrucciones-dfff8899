import { z } from 'zod';
import { CONTACT } from '@/data/projects';

export const PROJECT_TYPES = ['Construcción de vivienda', 'Wood Frame', 'Construcción tradicional', 'Ampliación', 'Reforma integral', 'Drywall y yeso', 'Pintura', 'Instalación eléctrica', 'Instalación sanitaria', 'Mobiliario a medida'] as const;
const safeText = (min: number, max: number) => z.string().trim().min(min, 'Completá este campo.').max(max, `Máximo ${max} caracteres.`).refine(value => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value), 'Revisá el texto ingresado.');
export const inquirySchema = z.object({
  nombre: safeText(2, 100),
  telefono: z.string().trim().min(7, 'Ingresá un teléfono válido.').max(25).regex(/^\+?[\d\s().-]+$/, 'Ingresá un teléfono válido.').refine(value => value.replace(/\D/g, '').length >= 7, 'Ingresá un teléfono válido.'),
  tipo: z.enum(PROJECT_TYPES),
  ubicacion: safeText(2, 150),
  descripcion: safeText(0, 1000),
});
export function inquiryUrl(input: unknown): string {
  const data = inquirySchema.parse(input);
  return whatsappUrl(`Hola SCH, soy ${data.nombre}. Teléfono: ${data.telefono}. Quiero consultar por ${data.tipo.toLowerCase()}. Ubicación de la obra: ${data.ubicacion}.${data.descripcion ? ` Detalles: ${data.descripcion}` : ''}`);
}
/** Validate again immediately before handing user input to an external URL. */
export function whatsappUrl(message: unknown): string {
  const text = safeText(1, 1800).parse(message);
  return `${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
}