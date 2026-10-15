import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getAdminConfig = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: roles, error: roleError } = await context.supabase.from("user_roles").select("user_id,account_id,role").eq("user_id", context.userId).maybeSingle();
  if (roleError) throw Error("Não foi possível verificar seu acesso.");
  const account = roles?.account_id ?? context.userId;
  const [settings, templates, rooms] = await Promise.all([context.supabase.from("site_settings").select("settings").eq("user_id", account).maybeSingle(), context.supabase.from("message_templates").select("*").order("created_at"), context.supabase.from("rooms").select("id,name").eq("user_id", account).order("name")]);
  if (settings.error || templates.error || rooms.error) throw Error("Não foi possível carregar as configurações.");
  const { withPricingDefaults } = await import("@/lib/pricing");
  return { userId: context.userId, accountId: account, role: roles?.role ?? "recepcao", settings: withPricingDefaults((settings.data?.settings ?? {}) as Record<string, string>), templates: templates.data ?? [], rooms: rooms.data ?? [] };
});
export const saveSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: Record<string, string>) => data).handler(async ({ data, context }) => {
  const { settingsSchema } = await import("@/lib/admin-config");
  const { withPricingDefaults } = await import("@/lib/pricing");
  const parsed = settingsSchema.safeParse(withPricingDefaults(data));
  if (!parsed.success) throw Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { data: account } = await context.supabase.rpc("account_owner");
  if (!account) throw Error("Sem permissão.");
  const { data: existing, error: readError } = await context.supabase.from("site_settings").select("settings").eq("user_id", account).maybeSingle();
  if (readError) throw Error("Não foi possível ler as configurações.");
  const current = (existing?.settings ?? {}) as Record<string, string>;
  const { error } = await context.supabase.from("site_settings").upsert({ user_id: account, settings: { ...current, ...parsed.data } });
  if (error) throw Error("Não foi possível salvar. Apenas administradores podem alterar o site.");
  return { ok: true };
});
export const updateGalleryUrl = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ url: z.string().max(2000), action: z.enum(["add", "remove"]) }).parse(data)).handler(async ({ data, context }) => {
  const { imageUrlSchema, readGalleryUrls } = await import("@/lib/admin-config");
  const url = imageUrlSchema.parse(data.url);
  const { data: account } = await context.supabase.rpc("account_owner");
  if (!account) throw Error("Sem permissão.");
  const { data: existing, error: readError } = await context.supabase.from("site_settings").select("settings").eq("user_id", account).maybeSingle();
  if (readError) throw Error("Não foi possível carregar a galeria.");
  const settings = (existing?.settings ?? {}) as Record<string, string>;
  const urls = readGalleryUrls(settings);
  const next = data.action === "remove" ? urls.filter((item) => item !== url) : Array.from(new Set([...urls, url]));
  if (next.length > 100) throw Error("A galeria permite até 100 URLs.");
  const { error } = await context.supabase.from("site_settings").upsert({ user_id: account, settings: { ...settings, gallery_urls: JSON.stringify(next) } });
  if (error) throw Error("Não foi possível atualizar a galeria. Apenas administradores podem alterar o site.");
  return { ok: true };
});
export const saveTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid().optional(), title: z.string().trim().min(1).max(120), message: z.string().trim().min(1).max(5000) }).parse(data)).handler(async ({ context, data }) => {
  const { data: account } = await context.supabase.rpc("account_owner");
  if (!account) throw Error("Sem permissão.");
  const result = data.id ? await context.supabase.from("message_templates").update({ title: data.title, message: data.message }).eq("id", data.id) : await context.supabase.from("message_templates").insert({ title: data.title, message: data.message, user_id: account });
  if (result.error) throw Error("Não foi possível salvar o template.");
  return { ok: true };
});
export const deleteTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data)).handler(async ({ data, context }) => { const { error } = await context.supabase.from("message_templates").delete().eq("id", data.id); if (error) throw Error("Não foi possível excluir."); return { ok: true }; });
export const listMembers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!allowed) return [];
  const { data: roles, error } = await context.supabase.from("user_roles").select("user_id,account_id,role");
  if (error) throw Error("Não foi possível carregar os usuários.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return Promise.all((roles ?? []).map(async (r) => { const { data, error } = await supabaseAdmin.auth.admin.getUserById(r.user_id); if (error) throw Error("Não foi possível consultar a conta."); return { id: r.user_id, email: data.user.email ?? "", role: r.role, owner: r.user_id === r.account_id, confirmed: Boolean(data.user.email_confirmed_at) }; }));
});
export const inviteMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ email: z.string().trim().email().max(254), role: z.enum(["admin", "recepcao"]) }).parse(data)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!allowed) throw Error("Apenas administradores podem convidar.");
  const { data: account } = await context.supabase.rpc("account_owner");
  if (!account) throw Error("Sem permissão.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequest } = await import("@tanstack/react-start/server");
  const origin = new URL(getRequest().url).origin;
  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${origin}/seguranca` });
  if (error || !invited.user) throw Error("Não foi possível enviar o convite. Verifique se o e-mail já possui conta.");
  const { error: saveError } = await supabaseAdmin.from("user_roles").upsert({ user_id: invited.user.id, account_id: account, role: data.role }, { onConflict: "user_id" });
  if (saveError) { await supabaseAdmin.auth.admin.deleteUser(invited.user.id); throw Error("Convite não concluído. Tente novamente."); }
  return { ok: true };
});
export const changeRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid(), role: z.enum(["admin", "recepcao"]) }).parse(data)).handler(async ({ context, data }) => { const { error } = await context.supabase.rpc("set_member_role", { _member: data.id, _role: data.role }); if (error) throw Error("Não foi possível alterar o perfil. O titular permanece administrador."); return { ok: true }; });