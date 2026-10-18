import { z } from 'zod';
import { calculateStay } from '@/lib/pricing';

export const allowedOrigins = new Set(['https://pousadavaledosol2024.com.br', 'https://www.pousadavaledosol2024.com.br', 'https://admin.pousadavaledosol2024.com.br']);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
});
const count = z.number().int().min(0).max(100);
export const staySchema = z.object({
  room_id: z.string().uuid(), check_in: dateSchema, check_out: dateSchema,
  guests: z.object({ adults: count.min(1), children: count, petSmall: count, petMedium: count, petLarge: count }).strict(),
}).strict().superRefine((v, ctx) => {
  const nights = (Date.parse(v.check_out) - Date.parse(v.check_in)) / 86400000;
  if (nights < 1 || nights > 366) ctx.addIssue({ code: 'custom', message: 'Período inválido.' });
});
export const bookingSchema = z.object({
  quote_token: z.string().min(10).max(6000),
  guest_name: z.string().trim().min(1).max(200),
  guest_phone: z.string().regex(/^\+?\d{10,15}$/),
  guest_email: z.union([z.string().email().max(254), z.literal('')]).default(''),
  notes: z.string().trim().max(1500).default(''),
}).strict();
export const tokenSchema = z.object({ id: z.string().uuid(), stay: staySchema, total: z.number().finite().min(0).max(10000000), revision: z.string().length(32), expires: z.number().int() }).strict();
export type Quote = z.infer<typeof tokenSchema>;
export type PublicRoom = { id: string; name: string; room_type: string; capacity: number; daily_rate: number; public_description: string; amenities: string[]; bed_configuration: unknown; room_position: string; revision: string; bookable: boolean };
export type Snapshot = { settings: Record<string, string>; rooms: PublicRoom[]; blocks: { room_id: string; check_in: string; check_out: string }[] };
export function quoteStay(stay: z.infer<typeof staySchema>, snapshot: Snapshot, today: string) {
  if (stay.check_in < today) throw Error('Informe datas atuais ou futuras.');
  const room = snapshot.rooms.find(r => r.id === stay.room_id && r.bookable);
  if (!room) throw Error('Quarto indisponível.');
  if (stay.guests.adults + stay.guests.children > room.capacity) throw Error('Capacidade do quarto excedida.');
  if (snapshot.blocks.some(b => b.room_id === room.id && b.check_in < stay.check_out && b.check_out > stay.check_in)) throw Error('Datas indisponíveis.');
  return { room, price: calculateStay(Number(room.daily_rate), stay.check_in, stay.check_out, stay.guests, snapshot.settings) };
}
export function publicSettings(settings: Record<string, string>) {
  const keys = ['name','slogan','description','email','phone','whatsapp','address','latitude','longitude','checkin_time','checkout_time','instagram','facebook','airbnb','booking','triplar','holidays','weekend_percent','holiday_percent','extra_adult_discount','child_rate','pet_small','pet_medium','pet_large','cancellation'];
  return Object.fromEntries(keys.filter(k => typeof settings[k] === 'string').map(k => [k, settings[k]]));
}
