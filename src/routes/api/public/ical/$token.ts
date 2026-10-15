import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
export const Route = createFileRoute("/api/public/ical/$token")({ server: { handlers: { GET: async ({ params }) => {
  if (!z.string().uuid().safeParse(params.token).success) return new Response("Não encontrado", { status: 404 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: feed } = await supabaseAdmin.from("ical_feeds").select("id,room_id").eq("export_token", params.token).eq("active", true).maybeSingle();
  if (!feed) return new Response("Não encontrado", { status: 404 });
  const { data, error } = await supabaseAdmin.from("availability_blocks").select("id,check_in,check_out,reservation_id").eq("room_id", feed.room_id);
  if (error) return new Response("Indisponível", { status: 503 });
  // Omit this provider's imported blocks to avoid an import/export echo loop.
  const { data: own } = await supabaseAdmin.from("reservations").select("id").eq("import_feed_id", feed.id);
  const excluded = new Set(own?.map((r) => r.id));
  const { exportCalendar } = await import("@/lib/ical");
  return new Response(exportCalendar((data ?? []).filter((b) => !excluded.has(b.reservation_id))), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "attachment; filename=disponibilidade.ics", "Cache-Control": "no-store" } });
} } } });