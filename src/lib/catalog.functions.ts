import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteCatalogItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid(), kind: z.enum(["rooms", "products", "ingredients"]) }).parse(input)).handler(async ({ context, data }) => {
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: account } = await context.supabase.rpc("account_owner");
  if (!admin || !account) throw Error("Apenas administradores podem excluir cadastros.");
  if (data.kind === "ingredients") {
    const { count, error } = await context.supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("ingredient_id", data.id);
    if (error || count) throw Error("Este item possui movimentações de estoque e deve ser mantido para preservar o histórico.");
  }
  if (data.kind === "products") {
    // Archive instead of removing sold product identities and recipes.
    const { data: row, error } = await context.supabase.from("products").update({ active: false, on_menu: false }).eq("id", data.id).eq("user_id", account).select("id").single();
    if (error || !row) throw Error("Não foi possível excluir o produto.");
  } else {
    const { data: row, error } = await context.supabase.from(data.kind).delete().eq("id", data.id).eq("user_id", account).select("id").single();
    if (error || !row) throw Error(error?.code === "23503" ? "Este cadastro está vinculado a reservas, calendários ou receitas de produtos e não pode ser excluído." : "Não foi possível excluir o cadastro.");
  }
  return { ok: true };
});