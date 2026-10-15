import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AdminHeader } from "@/components/admin-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, BedDouble, Minus, Plus, Receipt, Search, ShoppingBag, Trash2, Utensils, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({
    meta: [
      { title: "Lanchonete / PDV — Pousada Vale do Sol" },
      { name: "description", content: "Comandas de quartos e mesas, vendas de balcão e baixa automática de estoque da lanchonete." },
      { property: "og:title", content: "Lanchonete / PDV — Pousada Vale do Sol" },
      { property: "og:description", content: "Comandas de quartos e mesas, vendas de balcão e baixa automática de estoque da lanchonete." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PdvPage,
});

type Product = Tables<"products">;
type Order = Tables<"orders">;
type Item = Tables<"order_items">;
type Ingredient = Tables<"ingredients">;
type ActiveRes = Tables<"reservations"> & { rooms: { name: string } | null };

const CATEGORIES = ["Lanches", "Porções", "Bebidas", "Sobremesas", "Outros"];
const METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito"];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => Number(s.replace(",", "."));
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function uid() {
  const { data, error } = await supabase.rpc("account_owner");
  if (error || !data) throw Error("Sua sessão expirou. Entre novamente.");
  return data;
}

function orderKind(o: Order) {
  if (o.reservation_id) return { label: "Quarto", icon: BedDouble };
  if (o.table_label === "Balcão") return { label: "Balcão", icon: ShoppingBag };
  return { label: "Mesa", icon: Utensils };
}

function PdvPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [lowStock, setLowStock] = useState<Ingredient[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [cat, setCat] = useState("Todos");
  const [q, setQ] = useState("");
  const [newOrder, setNewOrder] = useState(false);
  const [productDlg, setProductDlg] = useState(false);
  const [payOrder, setPayOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    const [p, o, ing] = await Promise.all([
      supabase.from("products").select("*").eq("active", true).eq("on_menu", true).order("name"),
      supabase.from("orders").select("*").eq("status", "aberta").order("opened_at"),
      supabase.from("ingredients").select("*").order("name"),
    ]);
    setProducts(p.data ?? []);
    setOrders(o.data ?? []);
    setLowStock((ing.data ?? []).filter((i) => Number(i.stock_quantity) <= Number(i.min_stock)));
  }, []);

  const loadItems = useCallback(async (id: string | null) => {
    if (!id) return void setItems([]);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", id).order("created_at");
    setItems(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadItems(selected); }, [selected, loadItems]);

  const order = orders.find((o) => o.id === selected) ?? null;
  const total = items.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const shown = useMemo(
    () => products.filter((p) => (cat === "Todos" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())),
    [products, cat, q],
  );

  async function refresh() {
    await Promise.all([load(), loadItems(selected)]);
  }

  async function quickSale() {
    const { data, error } = await supabase
      .from("orders")
      .insert({ user_id: await uid(), table_label: "Balcão", customer_name: "Venda de balcão" })
      .select()
      .single();
    if (error) return void toast.error("Não foi possível iniciar a venda.");
    setOrders((o) => [...o, data]);
    setSelected(data.id);
  }

  async function addProduct(p: Product) {
    if (!order) return void toast.info("Selecione ou abra uma comanda primeiro.");
    const existing = items.find((i) => i.product_id === p.id);
    const { error } = existing
      ? await supabase.from("order_items").update({ quantity: Number(existing.quantity) + 1 }).eq("id", existing.id)
      : await supabase.from("order_items").insert({
          user_id: await uid(), order_id: order.id, product_id: p.id, product_name: p.name, unit_price: Number(p.price), quantity: 1,
        });
    if (error) return void toast.error("Não foi possível adicionar o item.");
    refresh();
  }

  async function changeQty(i: Item, d: number) {
    const q2 = Number(i.quantity) + d;
    const { error } = q2 <= 0
      ? await supabase.from("order_items").delete().eq("id", i.id)
      : await supabase.from("order_items").update({ quantity: q2 }).eq("id", i.id);
    if (error) return void toast.error("Não foi possível alterar o item.");
    refresh();
  }

  async function cancelOrder(o: Order) {
    if (!confirm(`Cancelar a comanda #${o.number}? Os itens voltam para o estoque.`)) return;
    await supabase.from("order_items").delete().eq("order_id", o.id);
    await supabase.from("orders").update({ status: "cancelada", closed_at: new Date().toISOString() }).eq("id", o.id);
    setSelected(null);
    toast.success("Comanda cancelada.");
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Lanchonete / PDV</h2>
            <p className="text-sm text-muted-foreground">Comandas de quartos e mesas, e vendas rápidas de balcão.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setProductDlg(true)}><Plus className="mr-2 h-4 w-4" />Novo produto</Button>
            <Button variant="secondary" onClick={() => setNewOrder(true)}><Receipt className="mr-2 h-4 w-4" />Nova comanda</Button>
            <Button onClick={quickSale}><ShoppingBag className="mr-2 h-4 w-4" />Venda rápida</Button>
          </div>
        </div>

        {lowStock.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-warning/60 bg-warning/15 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p><span className="font-medium">Estoque baixo:</span>{" "}
              {lowStock.map((i) => `${i.name} (${Number(i.stock_quantity)} ${i.unit})`).join(", ")}</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[220px_1fr_340px]">
          {/* Comandas */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Comandas abertas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {orders.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma comanda aberta.</p>}
              {orders.map((o) => {
                const k = orderKind(o);
                return (
                  <button key={o.id} onClick={() => setSelected(o.id)}
                    className={`w-full rounded-md border p-2 text-left text-sm transition-colors hover:bg-muted ${selected === o.id ? "border-primary bg-primary/10" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium"><k.icon className="h-4 w-4" />{o.table_label}</span>
                      <span className="text-xs text-muted-foreground">#{o.number}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="truncate">{o.customer_name ?? k.label}</span>
                      <span>{brl.format(Number(o.total))}</span>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Cardápio */}
          <Card>
            <CardHeader className="space-y-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar produto..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Tabs value={cat} onValueChange={setCat}>
                <TabsList className="flex-wrap">
                  {["Todos", ...CATEGORIES].map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Cadastre seus produtos em “Novo produto”.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {shown.map((p) => (
                    <button key={p.id} onClick={() => addProduct(p)} disabled={!order}
                      className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50">
                      <p className="font-medium leading-tight">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                      <p className="mt-1 font-semibold text-primary">{brl.format(Number(p.price))}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comanda selecionada */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {order ? <>Comanda #{order.number} — {order.table_label}</> : "Nenhuma comanda selecionada"}
                {order && <Button size="icon" variant="ghost" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>}
              </CardTitle>
              {order && <p className="text-sm text-muted-foreground">{order.customer_name}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              {!order && <p className="text-sm text-muted-foreground">Escolha uma comanda ou clique em “Venda rápida”.</p>}
              {order && items.length === 0 && <p className="text-sm text-muted-foreground">Toque nos produtos para adicionar.</p>}
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.product_name}</p>
                    <p className="text-xs text-muted-foreground">{brl.format(Number(i.unit_price))} cada</p>
                  </div>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center">{Number(i.quantity)}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, 1)}><Plus className="h-3 w-3" /></Button>
                  <span className="w-20 text-right font-medium">{brl.format(Number(i.total ?? 0))}</span>
                </div>
              ))}
              {order && (
                <>
                  <div className="flex justify-between border-t pt-3 text-lg font-semibold">
                    <span>Total</span><span>{brl.format(total)}</span>
                  </div>
                  {order.reservation_id ? (
                    <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                      Conta do quarto: o valor será cobrado junto no check-out do hóspede.
                    </p>
                  ) : (
                    <Button className="w-full" disabled={items.length === 0} onClick={() => setPayOrder(order)}>Fechar e receber</Button>
                  )}
                  <Button variant="ghost" className="w-full text-destructive" onClick={() => cancelOrder(order)}>
                    <Trash2 className="mr-2 h-4 w-4" />Cancelar comanda
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <NewOrderDialog open={newOrder} onClose={() => setNewOrder(false)} onCreated={(o) => { setOrders((x) => [...x, o]); setSelected(o.id); }} />
      <ProductDialog open={productDlg} onClose={() => setProductDlg(false)} onSaved={load} />
      <PayDialog order={payOrder} total={total} onClose={() => setPayOrder(null)} onPaid={() => { setSelected(null); load(); }} />
    </div>
  );
}

function NewOrderDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (o: Order) => void }) {
  const [kind, setKind] = useState<"quarto" | "mesa">("quarto");
  const [guests, setGuests] = useState<ActiveRes[]>([]);
  const [resId, setResId] = useState("");
  const [mesa, setMesa] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setResId(""); setMesa(""); setName("");
    supabase.from("reservations").select("*, rooms(name)").eq("status", "hospedado").order("check_in")
      .then(({ data }) => setGuests((data as ActiveRes[]) ?? []));
  }, [open]);

  async function create() {
    const base = { user_id: await uid() };
    let payload;
    if (kind === "quarto") {
      const r = guests.find((g) => g.id === resId);
      if (!r) return void toast.error("Escolha o quarto do hóspede.");
      payload = { ...base, reservation_id: r.id, table_label: r.rooms?.name ?? "Quarto", customer_name: r.guest_name };
    } else {
      if (!mesa.trim()) return void toast.error("Informe o número da mesa.");
      payload = { ...base, table_label: `Mesa ${mesa.trim()}`, customer_name: name.trim() || null };
    }
    const { data, error } = await supabase.from("orders").insert(payload).select().single();
    if (error) return void toast.error("Não foi possível abrir a comanda.");
    toast.success(`Comanda #${data.number} aberta.`);
    onCreated(data);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova comanda</DialogTitle></DialogHeader>
        <Tabs value={kind} onValueChange={(v) => setKind(v as "quarto" | "mesa")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quarto">Quarto do hóspede</TabsTrigger>
            <TabsTrigger value="mesa">Mesa</TabsTrigger>
          </TabsList>
        </Tabs>
        {kind === "quarto" ? (
          <div className="grid gap-1.5">
            <Label>Quarto</Label>
            {guests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum hóspede em estadia no momento.</p>
            ) : (
              <Select value={resId} onValueChange={setResId}>
                <SelectTrigger><SelectValue placeholder="Selecione o quarto" /></SelectTrigger>
                <SelectContent>
                  {guests.map((g) => <SelectItem key={g.id} value={g.id}>{g.rooms?.name} — {g.guest_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">O consumo será cobrado junto com a hospedagem no check-out.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Mesa</Label><Input inputMode="numeric" value={mesa} onChange={(e) => setMesa(e.target.value)} placeholder="Ex.: 4" /></div>
            <div className="grid gap-1.5"><Label>Cliente (opcional)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
        )}
        <DialogFooter><Button onClick={create}>Abrir comanda</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ order, total, onClose, onPaid }: { order: Order | null; total: number; onClose: () => void; onPaid: () => void }) {
  const [method, setMethod] = useState("Pix");
  const [saving, setSaving] = useState(false);
  async function pay() {
    if (!order) return;
    setSaving(true);
    const { error } = await supabase.from("orders").update({ status: "fechada", payment_method: method }).eq("id", order.id);
    if (!error)
      await supabase.from("transactions").insert({
        user_id: await uid(), type: "receita", category: "Alimentação",
        description: `Comanda #${order.number} — ${order.table_label}`, amount: total, due_date: iso(new Date()),
        status: "pago", payment_method: method, business_unit: "lanchonete", order_id: order.id,
      });
    setSaving(false);
    if (error) return void toast.error("Não foi possível fechar a comanda.");
    toast.success(`Comanda #${order.number} paga: ${brl.format(total)}`);
    onClose();
    onPaid();
  }
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Receber comanda #{order?.number}</DialogTitle></DialogHeader>
        <p className="text-3xl font-semibold">{brl.format(total)}</p>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <Button key={m} variant={method === m ? "default" : "outline"} onClick={() => setMethod(m)}>{m}</Button>
          ))}
        </div>
        <DialogFooter><Button onClick={pay} disabled={saving}>{saving ? "Salvando..." : "Confirmar pagamento"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RecipeLine = { ingredient_id: string; quantity: string };

function ProductDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const empty = { name: "", category: "Lanches", price: "", cost: "" };
  const [f, setF] = useState(empty);
  const [ings, setIngs] = useState<Ingredient[]>([]);
  const [recipe, setRecipe] = useState<RecipeLine[]>([]);
  const [newIng, setNewIng] = useState({ name: "", unit: "un", stock: "", min: "" });
  const [saving, setSaving] = useState(false);

  const loadIngs = useCallback(async () => {
    const { data } = await supabase.from("ingredients").select("*").order("name");
    setIngs(data ?? []);
  }, []);
  useEffect(() => { if (open) { setF(empty); setRecipe([]); loadIngs(); } }, [open, loadIngs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addIngredient() {
    if (!newIng.name.trim()) return void toast.error("Informe o nome do insumo.");
    const { data, error } = await supabase.from("ingredients").insert({
      user_id: await uid(), name: newIng.name.trim(), unit: newIng.unit,
      stock_quantity: num(newIng.stock || "0"), min_stock: num(newIng.min || "0"),
    }).select().single();
    if (error) return void toast.error("Não foi possível cadastrar o insumo.");
    setIngs((x) => [...x, data]);
    setRecipe((r) => [...r, { ingredient_id: data.id, quantity: "1" }]);
    setNewIng({ name: "", unit: "un", stock: "", min: "" });
  }

  async function save() {
    if (!f.name.trim() || !f.price) return void toast.error("Informe nome e preço.");
    setSaving(true);
    const user_id = await uid();
    const { data, error } = await supabase.from("products").insert({
      user_id, name: f.name.trim(), category: f.category, price: num(f.price), cost: num(f.cost || "0"),
    }).select().single();
    if (!error) {
      const lines = recipe.filter((r) => r.ingredient_id && num(r.quantity) > 0);
      if (lines.length)
        await supabase.from("product_ingredients").insert(
          lines.map((r) => ({ user_id, product_id: data.id, ingredient_id: r.ingredient_id, quantity: num(r.quantity) })),
        );
    }
    setSaving(false);
    if (error) return void toast.error("Não foi possível salvar o produto.");
    toast.success("Produto cadastrado.");
    onClose();
    onSaved();
  }

  const unitOf = (id: string) => ings.find((i) => i.id === id)?.unit ?? "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo produto</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: X-Burguer" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Preço (R$)</Label><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Custo (R$)</Label><Input inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Insumos usados (baixa no estoque a cada venda)</p>
            {recipe.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={r.ingredient_id} onValueChange={(v) => setRecipe((x) => x.map((y, j) => (j === idx ? { ...y, ingredient_id: v } : y)))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Insumo" /></SelectTrigger>
                  <SelectContent>{ings.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="w-20" inputMode="decimal" value={r.quantity} onChange={(e) => setRecipe((x) => x.map((y, j) => (j === idx ? { ...y, quantity: e.target.value } : y)))} />
                <span className="w-8 text-xs text-muted-foreground">{unitOf(r.ingredient_id)}</span>
                <Button size="icon" variant="ghost" onClick={() => setRecipe((x) => x.filter((_, j) => j !== idx))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            {ings.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setRecipe((x) => [...x, { ingredient_id: "", quantity: "1" }])}>
                <Plus className="mr-1 h-3 w-3" />Adicionar insumo
              </Button>
            )}
            <div className="grid grid-cols-[1fr_70px_70px_70px_auto] items-end gap-2 border-t pt-2">
              <div className="grid gap-1"><Label className="text-xs">Novo insumo</Label><Input value={newIng.name} onChange={(e) => setNewIng({ ...newIng, name: e.target.value })} placeholder="Ex.: Pão" /></div>
              <div className="grid gap-1">
                <Label className="text-xs">Unid.</Label>
                <Select value={newIng.unit} onValueChange={(v) => setNewIng({ ...newIng, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["un", "kg", "g", "L", "ml"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1"><Label className="text-xs">Estoque</Label><Input inputMode="decimal" value={newIng.stock} onChange={(e) => setNewIng({ ...newIng, stock: e.target.value })} /></div>
              <div className="grid gap-1"><Label className="text-xs">Mínimo</Label><Input inputMode="decimal" value={newIng.min} onChange={(e) => setNewIng({ ...newIng, min: e.target.value })} /></div>
              <Button size="icon" variant="secondary" onClick={addIngredient}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar produto"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
