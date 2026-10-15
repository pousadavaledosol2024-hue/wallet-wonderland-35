import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateStay } from "@/lib/pricing";

const count = z.number().int().min(0).max(100);
export const registerCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    roomId: z.string().uuid(), checkIn: z.string(), checkOut: z.string(),
    guestName: z.string().trim().min(1).max(200), guestDocument: z.string().trim().min(1).max(100),
    guestPhone: z.string().max(100), guestEmail: z.string().max(254),
    guests: z.object({ adults: count.min(1), children: count, petSmall: count, petMedium: count, petLarge: count }),
    paid: z.number().finite().min(0), source: z.string().max(100), notes: z.string().max(10000),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: account, error: accountError } = await context.supabase.rpc("account_owner");
    if (accountError || !account) throw Error("Sua sessão expirou. Entre novamente.");
    const [roomResult, settingsResult] = await Promise.all([
      context.supabase.from("rooms").select("*").eq("id", data.roomId).eq("user_id", account).single(),
      context.supabase.from("site_settings").select("settings").eq("user_id", account).maybeSingle(),
    ]);
    const room = roomResult.data;
    if (roomResult.error || !room || settingsResult.error) throw Error("Não foi possível carregar as tarifas do quarto.");
    if (room.status !== "disponivel") throw Error("O quarto não está disponível para check-in.");
    if (data.guests.adults + data.guests.children > room.capacity) throw Error("A quantidade de hóspedes excede a capacidade do quarto.");
    const price = calculateStay(Number(room.daily_rate), data.checkIn, data.checkOut, data.guests, (settingsResult.data?.settings ?? {}) as Record<string, string>);
    const composition = `${data.guests.adults} adulto(s), ${data.guests.children} criança(s); pets: ${data.guests.petSmall} pequeno(s), ${data.guests.petMedium} médio(s), ${data.guests.petLarge} grande(s).`;
    const { error } = await context.supabase.from("reservations").insert({
      user_id: account, room_id: room.id, guest_name: data.guestName, guest_document: data.guestDocument,
      guest_phone: data.guestPhone || null, guest_email: data.guestEmail || null,
      guests_count: data.guests.adults + data.guests.children, check_in: data.checkIn, check_out: data.checkOut,
      total_amount: price.total, paid_amount: data.paid, status: "hospedado", source: data.source,
      notes: [data.notes, composition].filter(Boolean).join("\n"),
    });
    if (error) throw Error("Não foi possível registrar o check-in. Confira a disponibilidade do período.");
    const { error: roomError } = await context.supabase.from("rooms").update({ status: "ocupado" }).eq("id", room.id);
    return { total: price.total, roomStatusUpdated: !roomError };
  });