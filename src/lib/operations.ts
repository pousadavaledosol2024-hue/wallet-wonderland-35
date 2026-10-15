import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export const cashMethods = ["Dinheiro", "Pix", "Crédito", "Débito", "Outros"];
export const operationsOptions = queryOptions({ queryKey: ["operations"], queryFn: async () => {
  const [registers, movements, ingredients, products] = await Promise.all([
    supabase.from("cash_registers").select("*").order("opened_at", { ascending: false }).limit(100),
    supabase.from("cash_movements").select("*").order("created_at", { ascending: false }),
    supabase.from("ingredients").select("*").order("name"),
    supabase.from("products").select("*").eq("active", true).order("name"),
  ]);
  if (registers.error || movements.error || ingredients.error || products.error) throw Error("Não foi possível carregar as operações.");
  return { registers: registers.data ?? [], movements: movements.data ?? [], ingredients: ingredients.data ?? [], products: products.data ?? [] };
} });