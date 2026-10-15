import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getFeeds = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("ical_feeds").select("*").order("created_at"); if (error) throw Error("Não foi possível carregar os calendários."); return data ?? [];
});
export const saveFeed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ room_id: z.string().uuid(), provider: z.string().trim().min(1).max(100), import_url: z.string().max(2000) }).parse(data)).handler(async ({ data, context }) => {
  if (data.import_url) { const { allowedFeedUrl } = await import("@/lib/ical"); allowedFeedUrl(data.import_url); }
  const { data: account } = await context.supabase.rpc("account_owner"); if (!account) throw Error("Sem acesso.");
  const { error } = await context.supabase.from("ical_feeds").insert({ ...data, user_id: account }); if (error) throw Error("Não foi possível salvar. Verifique o quarto e seu perfil de acesso."); return { ok: true };
});
export const updateFeed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean().optional(), remove: z.boolean().optional(), rotate: z.boolean().optional() }).parse(data)).handler(async ({ context, data }) => {
  const { data: feed, error: accessError } = await context.supabase.from("ical_feeds").select("id").eq("id", data.id).single();
  if (accessError || !feed) throw Error("Calendário não encontrado ou sem permissão.");
  if (data.remove) { const { error: ce } = await context.supabase.from("reservations").update({ status: "cancelada" }).eq("import_feed_id", data.id).in("status", ["confirmada", "pre_reserva"]); if (ce) throw Error("Não foi possível liberar os bloqueios."); const { error } = await context.supabase.from("ical_feeds").update({ active: false, export_token: crypto.randomUUID(), import_url: "" }).eq("id", data.id); if (error) throw Error("Não foi possível desativar."); }
  else { const { error } = await context.supabase.from("ical_feeds").update(data.rotate ? { export_token: crypto.randomUUID() } : { active: data.active ?? true }).eq("id", data.id); if (error) throw Error("Não foi possível atualizar."); } return { ok: true };
});
export const syncFeed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid(), content: z.string().max(2000000).optional() }).parse(data)).handler(async ({ context, data }) => {
  const { data: feed, error } = await context.supabase.from("ical_feeds").select("*").eq("id", data.id).single(); if (error || !feed || !feed.active) throw Error("Calendário inativo ou sem acesso.");
  try {
    const { allowedFeedUrl, parseCalendar } = await import("@/lib/ical");
    let text = data.content;
    if (text === undefined) {
      const response = await fetch(allowedFeedUrl(feed.import_url), { redirect: "error", signal: AbortSignal.timeout(15000), headers: { Accept: "text/calendar" } });
      if (!response.ok) throw Error("O provedor não disponibilizou o calendário.");
      const reader = response.body?.getReader(); if (!reader) throw Error("Calendário vazio.");
      const decoder = new TextDecoder(); let size = 0; text = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2000000) { await reader.cancel(); throw Error("Arquivo acima de 2 MB."); } text += decoder.decode(value, { stream: true }); } text += decoder.decode();
    }
    const events = parseCalendar(text);
    const { data: count, error: syncError } = await context.supabase.rpc("apply_ical_events", { _feed: feed.id, _events: events });
    if (syncError) throw Error(syncError.code === "23P01" ? "Conflito de datas: há reserva existente. Nenhum bloqueio desta importação foi alterado." : "Não foi possível aplicar o calendário.");
    return { ok: true, count: count ?? 0 };
  } catch (err) {
    const message = err instanceof Error && !/fetch|network|redirect/i.test(err.message) ? err.message : "Não foi possível acessar o link. Importe o arquivo .ics ou verifique o provedor.";
    await context.supabase.from("ical_feeds").update({ last_error: message }).eq("id", feed.id);
    return { ok: false, count: 0, message };
  }
});