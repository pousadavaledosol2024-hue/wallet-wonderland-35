import { createClient } from "npm:@supabase/supabase-js@2";
import ICAL from "npm:ical.js@2.2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_BYTES = 2_000_000;
const allowedHosts = ["airbnb.com", "airbnb.com.br", "booking.com", "triplar.com", "triplar.com.br"];
type Event = { uid: string; start: string; end: string };
type Feed = { id: string; user_id: string; room_id: string; provider: string; import_url: string; active: boolean };

function validFeedUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error("Use um link HTTPS de Airbnb, Booking.com ou TripLar.");
  }
  return url;
}

function parseCalendar(text: string): Event[] {
  const calendar = new ICAL.Component(ICAL.parse(text));
  if (calendar.name !== "vcalendar") throw new Error("Arquivo iCal inválido.");
  const components = calendar.getAllSubcomponents("vevent");
  if (components.length > 1000) throw new Error("O calendário excede 1.000 eventos.");
  return components.filter((component) => component.getFirstPropertyValue("status") !== "CANCELLED").map((component) => {
    const event = new ICAL.Event(component);
    if (event.isRecurring() || event.isRecurrenceException()) throw new Error("Eventos recorrentes não são compatíveis.");
    if (!event.uid || !event.startDate || !event.endDate) throw new Error("Evento sem identificação ou datas.");
    const start = event.startDate.toString().slice(0, 10);
    const end = event.endDate.toString().slice(0, 10);
    if (end <= start) throw new Error("A saída de um evento deve ser posterior à entrada.");
    return { uid: event.uid.slice(0, 500), start, end };
  });
}

async function readCalendar(url: URL): Promise<string> {
  let next: URL | null = url;
  for (let redirects = 0; next && redirects <= 5; redirects++) {
    const response = await fetch(next, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "text/calendar", "User-Agent": "Mozilla/5.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento sem destino.");
      next = validFeedUrl(new URL(location, next).href);
      continue;
    }
    if (!response.ok) throw new Error("O provedor não disponibilizou o calendário.");
    if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("Arquivo acima de 2 MB.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Calendário vazio.");
    const decoder = new TextDecoder();
    let size = 0;
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Arquivo acima de 2 MB."); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  }
  throw new Error("O provedor excedeu o limite de redirecionamentos.");
}

async function applyWithServiceRole(client: ReturnType<typeof createClient>, feed: Feed, events: Event[]) {
  const rows = events.map((event) => ({
    user_id: feed.user_id,
    room_id: feed.room_id,
    guest_name: `Bloqueio externo · ${feed.provider}`,
    check_in: event.start,
    check_out: event.end,
    status: "confirmada",
    source: `iCal · ${feed.provider}`,
    import_feed_id: feed.id,
    external_uid: event.uid,
  }));
  if (rows.length) {
    const { error } = await client.from("reservations").upsert(rows, { onConflict: "import_feed_id,external_uid" });
    if (error) throw new Error(error.code === "23P01" ? "Conflito de datas com outra reserva." : "Não foi possível reconciliar as reservas importadas.");
  }
  const activeIds = events.map((event) => event.uid);
  let query = client.from("reservations").update({ status: "cancelada" }).eq("import_feed_id", feed.id).in("status", ["confirmada", "pre_reserva"]);
  if (activeIds.length) query = query.not("external_uid", "in", `(${activeIds.map((id) => `\"${id.replaceAll('"', '\\"')}\"`).join(",")})`);
  const { error: cancelError } = await query;
  if (cancelError) throw new Error("Não foi possível liberar bloqueios removidos pelo provedor.");
  const { error: feedError } = await client.from("ical_feeds").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", feed.id);
  if (feedError) throw new Error("Não foi possível atualizar o status do calendário.");
  return rows.length;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Método não permitido." }, { status: 405, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return Response.json({ error: "Configuração de backend incompleta." }, { status: 500, headers: corsHeaders });

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const isScheduled = token === serviceKey;
  if (!token) return Response.json({ error: "Não autorizado." }, { status: 401, headers: corsHeaders });

  const client = createClient(supabaseUrl, isScheduled ? serviceKey : anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!isScheduled) {
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return Response.json({ error: "Sessão inválida." }, { status: 401, headers: corsHeaders });
    const { data: role } = await client.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
    if (role?.role !== "admin") return Response.json({ error: "Apenas administradores podem sincronizar calendários." }, { status: 403, headers: corsHeaders });
  }

  let body: { feedId?: string; content?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400, headers: corsHeaders }); }
  if (body.content !== undefined && new TextEncoder().encode(body.content).byteLength > MAX_BYTES) return Response.json({ error: "Arquivo acima de 2 MB." }, { status: 413, headers: corsHeaders });

  const { data: feeds, error: feedError } = isScheduled
    ? await admin.from("ical_feeds").select("id,user_id,room_id,provider,import_url,active").eq("active", true).not("import_url", "eq", "")
    : body.feedId
      ? await client.from("ical_feeds").select("id,user_id,room_id,provider,import_url,active").eq("id", body.feedId).limit(1)
      : { data: null, error: new Error("Informe um calendário.") };
  if (feedError || !feeds) return Response.json({ error: "Calendário não encontrado ou sem acesso." }, { status: 404, headers: corsHeaders });

  const results: { feedId: string; ok: boolean; count: number; message?: string }[] = [];
  for (const feed of feeds as Feed[]) {
    try {
      if (!feed.active && !isScheduled) throw new Error("Calendário inativo.");
      const text = body.content ?? await readCalendar(validFeedUrl(feed.import_url));
      const events = parseCalendar(text);
      if (isScheduled) {
        const count = await applyWithServiceRole(admin, feed, events);
        results.push({ feedId: feed.id, ok: true, count });
      } else {
        const { data: count, error } = await client.rpc("apply_ical_events", { _feed: feed.id, _events: events });
        if (error) throw new Error(error.code === "23P01" ? "Conflito de datas: existe outra reserva no período." : "Não foi possível aplicar o calendário.");
        results.push({ feedId: feed.id, ok: true, count: count ?? 0 });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível sincronizar o calendário.";
      await admin.from("ical_feeds").update({ last_error: message }).eq("id", feed.id);
      results.push({ feedId: feed.id, ok: false, count: 0, message });
    }
  }
  if (isScheduled) return Response.json({ results }, { headers: corsHeaders });
  const result = results[0];
  return Response.json(result, { status: result.ok ? 200 : 422, headers: corsHeaders });
});
