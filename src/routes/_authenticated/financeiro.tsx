import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin-header";
import { TransactionDialog, type Transaction } from "@/components/financeiro/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Pousada Vale do Sol" },
      { name: "description", content: "Receitas, despesas e fluxo de caixa da Pousada Vale do Sol." },
      { property: "og:title", content: "Financeiro — Pousada Vale do Sol" },
      { property: "og:description", content: "Receitas, despesas e fluxo de caixa da Pousada Vale do Sol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceiroPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function FinanceiroPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "receita" | "despesa">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [unit, setUnit] = useState("todos");
  const [day, setDay] = useState("");
  const scoped = transactions.filter((t) => (unit === "todos" || t.business_unit === unit) && (!day || t.due_date === day));

  const monthLabel = useMemo(
    () =>
      new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [year, month],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar lançamentos.");
    } else {
      setTransactions(data ?? []);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    load();
    const channel = supabase.channel(`finance-${year}-${month}`).on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const totals = useMemo(() => {
    const receitas = scoped.filter((t) => t.type === "receita");
    const despesas = scoped.filter((t) => t.type === "despesa");
    const sum = (list: Transaction[]) => list.reduce((acc, t) => acc + Number(t.amount), 0);
    const recebido = sum(receitas.filter((t) => t.status === "pago"));
    const pago = sum(despesas.filter((t) => t.status === "pago"));
    const aReceber = sum(receitas.filter((t) => t.status === "pendente"));
    const aPagar = sum(despesas.filter((t) => t.status === "pendente"));
    return { recebido, pago, aReceber, aPagar, saldo: recebido - pago };
  }, [transactions, unit, day]);

  const chartData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const map = new Map<number, { dia: number; pousada: number; lanchonete: number; geral: number; despesas: number }>();
    for (let d = 1; d <= daysInMonth; d++) map.set(d, { dia: d, pousada: 0, lanchonete: 0, geral: 0, despesas: 0 });
    for (const t of scoped) {
      if (t.status !== "pago") continue;
      const day = Number(t.due_date.slice(8, 10));
      const entry = map.get(day);
      if (entry) {
        if (t.type === "receita") { const key = t.business_unit === "lanchonete" ? "lanchonete" : t.business_unit === "geral" ? "geral" : "pousada"; entry[key] += Number(t.amount); }
        else entry.despesas += Number(t.amount);
      }
    }
    return Array.from(map.values());
  }, [transactions, year, month, unit, day]);

  const filtered = useMemo(
    () => (filter === "todos" ? scoped : scoped.filter((t) => t.type === filter)),
    [transactions, filter, unit, day],
  );

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("transactions").delete().eq("id", deleting.id);
    if (error) toast.error("Não foi possível excluir.");
    else toast.success("Lançamento excluído.");
    setDeleting(null);
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-40 text-center text-xl font-semibold capitalize">{monthLabel}</h2>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo lançamento
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-4"><div><label htmlFor="finance-unit" className="text-sm font-medium">Setor</label><select id="finance-unit" className="mt-2 block h-10 rounded-md border bg-background px-3" value={unit} onChange={(e) => setUnit(e.target.value)}><option value="todos">Todos</option><option value="pousada">Hospedagem</option><option value="lanchonete">Lanchonete</option><option value="geral">Geral</option></select></div><div><label htmlFor="finance-day" className="text-sm font-medium">Dia</label><input id="finance-day" type="date" className="mt-2 block h-10 rounded-md border bg-background px-3" value={day} onChange={(e) => setDay(e.target.value)} /></div>{day && <Button variant="outline" onClick={() => setDay("")}>Ver mês</Button>}</div>
        <section className="grid grid-cols-2 gap-4 border-y py-4">{["pousada", "lanchonete"].map((sector) => <div key={sector}><p className="text-sm text-muted-foreground">Receitas · {sector === "pousada" ? "Hospedagem" : "Lanchonete"}</p><p className="mt-1 text-xl font-semibold">{brl.format(scoped.filter((t) => t.type === "receita" && t.status === "pago" && t.business_unit === sector).reduce((s, t) => s + Number(t.amount), 0))}</p></div>)}</section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-success">{brl.format(totals.recebido)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pago</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-destructive">{brl.format(totals.pago)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo do mês</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${totals.saldo >= 0 ? "text-primary" : "text-destructive"}`}>
                {brl.format(totals.saldo)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">A receber: </span>
                <span className="font-semibold text-success">{brl.format(totals.aReceber)}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">A pagar: </span>
                <span className="font-semibold text-destructive">{brl.format(totals.aPagar)}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimentação diária (valores quitados)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                  />
                  <Tooltip
                    formatter={(value) => brl.format(Number(value))}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <Bar dataKey="pousada" name="Hospedagem" stackId="receitas" fill="var(--color-primary)" />
                  <Bar dataKey="lanchonete" name="Lanchonete" stackId="receitas" fill="var(--color-success)" />
                  <Bar dataKey="geral" name="Geral" stackId="receitas" fill="var(--color-muted-foreground)" />
                  <Bar dataKey="despesas" name="Despesas" fill="var(--color-destructive)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Lançamentos</CardTitle>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="receita">Receitas</TabsTrigger>
                <TabsTrigger value="despesa">Despesas</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhum lançamento neste mês. Clique em "Novo lançamento" para começar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(t.due_date)}</TableCell>
                        <TableCell className="max-w-48 truncate">{t.description}</TableCell>
                        <TableCell>{t.category}</TableCell>
                        <TableCell>{t.business_unit === "lanchonete" ? "Lanchonete" : t.business_unit === "pousada" ? "Hospedagem" : "Geral"}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "pago" ? "default" : "secondary"}>
                            {t.status === "pago"
                              ? t.type === "receita"
                                ? "Recebido"
                                : "Pago"
                              : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            t.type === "receita" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {t.type === "receita" ? "+" : "−"} {brl.format(Number(t.amount))}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Editar"
                              onClick={() => {
                                setEditing(t);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Excluir"
                              onClick={() => setDeleting(t)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.description}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
