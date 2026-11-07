import { describe, expect, it } from 'vitest';
import { inquirySchema, inquiryUrl } from './contactInquiry';
const valid = { nombre: 'Cliente de prueba', telefono: '095 123 456', tipo: 'Ampliación', ubicacion: 'Punta del Diablo', descripcion: '' };
describe('Consulta real por WhatsApp', () => {
  it('acepta descripción opcional y dirige al número oficial', () => {
    const url = new URL(inquiryUrl(valid));
    expect(url.origin + url.pathname).toBe('https://wa.me/59895564068');
    expect(url.searchParams.get('text')).toContain('ampliación');
    expect(url.searchParams.get('text')).toContain('Punta del Diablo');
  });
  it('requiere nombre, teléfono, tipo y ubicación', () => {
    for (const field of ['nombre', 'telefono', 'tipo', 'ubicacion']) expect(inquirySchema.safeParse({ ...valid, [field]: '' }).success).toBe(false);
  });
  it('rechaza exceso de texto y teléfonos inválidos', () => {
    expect(inquirySchema.safeParse({ ...valid, descripcion: 'x'.repeat(1001) }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...valid, telefono: 'no es teléfono' }).success).toBe(false);
  });
  it('codifica caracteres especiales sin alterar el destino', () => {
    const url = new URL(inquiryUrl({ ...valid, descripcion: 'Cocina & baño? #nuevo' }));
    expect(url.hash).toBe('');
    expect(url.searchParams.get('text')).toContain('Cocina & baño? #nuevo');
  });
});