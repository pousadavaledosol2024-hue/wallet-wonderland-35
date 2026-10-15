import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const manageReservation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), id: z.string().uuid(), name: z.string().trim().min(1).max(120), phone: z.string().trim().max(30), email: z.union([z.string().email(), z.literal("")]), document: z.string().trim().max(60), notes: z.string().max(5000) }),
  z.object({ action: z.literal("cancel"), id: z.string().uuid() }),
]).parse(input)).handler(async ({ context, data }) => {
  const { data: account } = await context.supabase.rpc("account_owner");
  if (!account) throw Error("Sem permissão.");
  const { data: reservation, error } = await context.supabase.from("reservations").select("*").eq("id", data.id).eq("user_id", account).single();
  if (error || !reservation || reservation.import_feed_id || !["pre_reserva", "confirmada", "hospedado"].includes(reservation.status)) throw Error("Esta reserva é histórica ou importada e não pode ser alterada aqui.");
  if (data.action === "cancel") {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { count, error: orderError } = await context.supabase.from("orders").select("id", { count: "exact", head: true }).eq("reservation_id", data.id);
    if (!admin || reservation.status === "hospedado" || Number(reservation.paid_amount) > 0 || count || orderError) throw Error("Reservas com estadia iniciada, pagamentos ou comandas não podem ser canceladas por este controle.");
    const { data: row, error: cancelError } = await context.supabase.from("reservations").update({ status: "cancelada" }).eq("id", data.id).eq("user_id", account).in("status", ["pre_reserva", "confirmada"]).eq("paid_amount", 0).select("id").single();
    if (cancelError || !row) throw Error("Não foi possível cancelar a reserva.");
  } else {
    const { data: row, error: updateError } = await context.supabase.from("reservations").update({ guest_name: data.name, guest_phone: data.phone || null, guest_email: data.email || null, guest_document: data.document || null, notes: data.notes || null }).eq("id", data.id).eq("user_id", account).in("status", ["pre_reserva", "confirmada", "hospedado"]).select("id").single();
    if (updateError || !row) throw Error("Não foi possível atualizar a ficha do hóspede.");
  }
  return { ok: true };
});