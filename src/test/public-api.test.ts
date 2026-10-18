import { describe, it, expect } from 'vitest';
import { allowedOrigins, staySchema, bookingSchema, quoteStay, publicSettings, type Snapshot } from '@/lib/public-api/contract';
import { signQuote, verifyQuote, preflight } from '@/lib/public-api/http.server';
const stay = { room_id: '11111111-1111-4111-8111-111111111111', check_in: '2026-10-19', check_out: '2026-10-20', guests: { adults: 1, children: 1, petSmall: 1, petMedium: 0, petLarge: 0 } };
const snapshot: Snapshot = { rooms: [{ id: stay.room_id, name: 'Suíte', capacity: 4, daily_rate: 165, bookable: true, revision: 'a'.repeat(32), amenities: [], bed_configuration: [], room_position: '', public_description: '', room_type: 'suite' }], settings: {}, blocks: [] };
describe('Public booking contracts', () => {
  it('uses original child and pet percentages over an adult rate', () => { expect(quoteStay(stay, snapshot, '2026-10-18').price.total).toBe(306.41); });
  it('rejects overlapping blocked dates', () => { expect(() => quoteStay(stay, { ...snapshot, blocks: [{ room_id: stay.room_id, check_in: '2026-10-18', check_out: '2026-10-20' }] }, '2026-10-18')).toThrow('Datas indisponíveis'); });
  it('permits same-day check-out and next check-in', () => { expect(quoteStay(stay, { ...snapshot, blocks: [{ room_id: stay.room_id, check_in: '2026-10-18', check_out: '2026-10-19' }] }, '2026-10-18').price.nights).toBe(1); });
  it('rejects capacity overflow', () => { expect(() => quoteStay({ ...stay, guests: { ...stay.guests, adults: 4 } }, snapshot, '2026-10-18')).toThrow('Capacidade'); });
  it('rejects invalid calendar dates', () => { expect(staySchema.safeParse({ ...stay, check_in: '2026-02-30' }).success).toBe(false); });
  it('rejects caller-provided totals and status', () => { expect(bookingSchema.safeParse({ quote_token: 'x'.repeat(30), guest_name: 'Teste', guest_phone: '5513999999999', total: 1, status: 'confirmada' }).success).toBe(false); });
  it('never exposes webhook and PIX secrets', () => { expect(publicSettings({ name: 'Pousada Vale do Sol', whatsapp_webhook: 'secret', pix_key: 'secret', private_value: 'secret' })).toEqual({ name: 'Pousada Vale do Sol' }); });
  it('only allows the public and new admin origins', () => { expect(allowedOrigins.has('https://pousadavaledosol2024.com.br')).toBe(true); expect(allowedOrigins.has('https://admin.pousadavaledosol2024.com.br')).toBe(true); expect(allowedOrigins.has('https://attacker.example')).toBe(false); });
  it('returns exact allowed origin on preflight without credentials', () => {
    const response = preflight(new Request('https://admin.pousadavaledosol2024.com.br/api/public/reservations', { method: 'OPTIONS', headers: { Origin: 'https://pousadavaledosol2024.com.br' } }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://pousadavaledosol2024.com.br');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });
  it('rejects unapproved origin at the preflight handler', () => {
    const response = preflight(new Request('https://admin.pousadavaledosol2024.com.br/api/public/reservations', { method: 'OPTIONS', headers: { Origin: 'https://attacker.example' } }));
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('rejects tampered signed quotes', async () => {
    const previous = process.env['PUBLIC_BOOKING_SIGNING_SECRET']; process.env['PUBLIC_BOOKING_SIGNING_SECRET'] = 'test-only-secret';
    try {
      const token = await signQuote({ id: stay.room_id, stay, total: 306.41, revision: 'a'.repeat(32), expires: Date.now() + 60000 });
      expect((await verifyQuote(token)).total).toBe(306.41);
      await expect(verifyQuote(token.slice(0, -4) + 'AAAA')).rejects.toThrow('Cotação inválida');
      const expired = await signQuote({ id: stay.room_id, stay, total: 306.41, revision: 'a'.repeat(32), expires: Date.now() - 1 });
      await expect(verifyQuote(expired)).rejects.toThrow('Cotação inválida');
    } finally { if (previous === undefined) delete process.env['PUBLIC_BOOKING_SIGNING_SECRET']; else process.env['PUBLIC_BOOKING_SIGNING_SECRET'] = previous; }
  });
});
