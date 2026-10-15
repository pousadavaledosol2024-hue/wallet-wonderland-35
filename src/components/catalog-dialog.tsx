import { useEffect, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type CatalogRow = Tables<"products"> | Tables<"ingredients">;
export function CatalogDialog({ item, kind, onClose, onSaved }: { item: CatalogRow | null; kind: "products" | "ingredients"; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!item) return;
    setFields(Object.fromEntries(Object.entries(item).map(([key, value]) => [key, String(value ?? "")])));
  }, [item]);
  const controls = kind === "products" ? [["name", "Nome", "text"], ["category", "Categoria", "text"], ["price", "Preço (R$)", "number"], ["cost", "Custo (R$)", "number"]] : [["name", "Nome", "text"], ["unit", "Unidade", "text"], ["min_stock", "Quantidade mínima", "number"], ["unit_cost", "Custo unitário (R$)", "number"], ["supplier", "Fornecedor", "text"]];
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!item || busy) return;
    if (!fields['name']?.trim()) return void toast.error("Informe o nome.");
    setBusy(true);
    try {
      const payload = kind === "products" ? { name: fields['name'].trim(), category: fields['category']?.trim() || "Outros", price: Number(fields['price']), cost: Number(fields['cost'] || 0) } : { name: fields['name'].trim(), unit: fields['unit']?.trim() || "un", min_stock: Number(fields['min_stock']), unit_cost: Number(fields['unit_cost'] || 0), supplier: fields['supplier'] || null, business_unit: fields['business_unit'] || "lanchonete" };
      const { data, error } = await supabase.from(kind).update(payload).eq("id", item.id).select("id").single();
      if (error || !data) throw Error("Não foi possível alterar. Verifique sua permissão.");
      await onSaved(); onClose(); toast.success("Cadastro atualizado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível alterar"); } finally { setBusy(false); }
  }
  return <Dialog open={Boolean(item)} onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{kind === "products" ? "Editar produto" : "Editar insumo / material"}</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4">{controls.map(([key, label, type]) => <div key={key} className="space-y-1"><Label htmlFor={`catalog-${key}`}>{label}</Label><Input id={`catalog-${key}`} type={type} min={type === "number" ? 0 : undefined} step="0.001" maxLength={120} required={key !== "supplier"} value={fields[key ?? ''] ?? ""} onChange={e => { if (key) setFields({ ...fields, [key]: e.target.value }); }} /></div>)}{kind === "ingredients" && <div className="space-y-1"><Label htmlFor="catalog-business">Setor</Label><select id="catalog-business" className="h-10 w-full rounded-md border bg-background px-3" value={fields['business_unit'] ?? "lanchonete"} onChange={e => setFields({ ...fields, business_unit: e.target.value })}><option value="lanchonete">Lanchonete</option><option value="pousada">Pousada</option></select></div>}<Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</Button></form></DialogContent></Dialog>;
}