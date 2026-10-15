import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getFeeds = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("ical_feeds").select("*").order("created_at"); if (error) throw Error("Não foi possível carregar os calendários."); return data ?? [];
});
export const saveFeed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid().optional(), room_id: z.string().uuid(), provider: z.string().trim().min(1).max(100), import_url: z.string().max(2000) }).parse(data)).handler(async ({ data, context }) => {
  if (data.import_url) { const { allowedFeedUrl } = await import("@/lib/ical"); allowedFeedUrl(data.import_url); }
  const { data: account } = await context.supabase.rpc("account_owner"); if (!account) throw Error("Sem acesso.");
  if (data.id) {
    const { data: current, error } = await context.supabase.from("ical_feeds").select("room_id").eq("id", data.id).eq("user_id", account).single();
    if (error || !current) throw Error("Calendário não encontrado ou sem acesso.");
    if (current.room_id !== data.room_id) throw Error("Para trocar o quarto, desvincule o calendário e crie um novo vínculo.");
  }
  const payload = { room_id: data.room_id, provider: data.provider, import_url: data.import_url };
  const result = data.id ? await context.supabase.from("ical_feeds").update(payload).eq("id", data.id).eq("user_id", account).select("id").single() : await context.supabase.from("ical_feeds").insert({ ...payload, user_id: account }).select("id").single();
  if (result.error || !result.data) throw Error("Não foi possível salvar. Verifique o quarto e seu perfil de acesso."); return { ok: true };
});
export const updateFeed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean().optional(), remove: z.boolean().optional(), rotate: z.boolean().optional() }).parse(data)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!allowed) throw Error("Apenas administradores podem alterar calendários.");
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