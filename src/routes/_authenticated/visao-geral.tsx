import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BedDouble, CalendarDays, ArrowDownLeft, ArrowUpRight, Utensils, AlertTriangle, ChevronRight } from "lucide-react";
import { AdminHeader } from "@/components/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReservationDetails } from "@/components/reservation-details";
import { managementOptions, useManagementRealtime, todayISO, blocksDates, money, origin, type Reservation } from "@/lib/management";

export const Route = createFileRoute("/_authenticated/visao-geral")({
  loader: ({ context }) => context.queryClient.ensureQueryData(managementOptions),
  head: () => ({ meta: [
    { title: "Visão Geral — Pousada Vale do Sol" },
    { name: "description", content: "Ocupação, entradas, saídas e resultados da pousada e lanchonete em tempo real." },
    { property: "og:title", content: "Visão Geral — Pousada Vale do Sol" },
    { property: "og:description", content: "Operação e resultados da Pousada Vale do Sol." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Overview,
});

function Overview() {
  const { data } = useSuspenseQuery(managementOptions);
  const connection = useManagementRealtime();
  const [selected, setSelected] = useState<Reservation | null>(null);
  const today = todayISO();
  const active = data.reservations.filter(blocksDates);
  const occupied = data.rooms.filter((r) => r.status === "ocupado").length;
  const arrivals = active.filter((r) => r.check_in === today);
  const departures = active.filter((r) => r.check_out === today);
  const lowStock = data.ingredients.filter((i) => Number(i.stock_quantity) <= Number(i.min_stock));
  const receipts = data.transactions.filter((t) => t.type === "receita" && t.status === "pago");
  const expenses = data.transactions.filter((t) => t.type === "despesa" && t.status === "pago");
  const sum = (items: typeof data.transactions) => items.reduce((s, t) => s + Number(t.amount), 0);
  const roomName = (id: string) => data.rooms.find((r) => r.id === id)?.name ?? "Quarto";
  return <div className="min-h-screen bg-background"><AdminHeader />
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-7">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 text-sm capitalize text-muted-foreground">{new Date(`${today}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p><h2 className="text-2xl font-semibold">Visão Geral</h2></div><Badge variant="outline" className="gap-2"><span className={`h-2 w-2 rounded-full ${connection === "Ao vivo" ? "bg-success" : "bg-warning"}`} />{connection}</Badge></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[{ label: "Ocupação atual", value: `${data.rooms.length ? Math.round(occupied / data.rooms.length * 100) : 0}%`, detail: `${occupied} de ${data.rooms.length} quartos`, icon: BedDouble }, { label: "Entradas hoje", value: arrivals.length, detail: `${arrivals.filter((r) => r.status === "hospedado").length} check-ins realizados`, icon: ArrowDownLeft }, { label: "Saídas hoje", value: departures.length, detail: "Estadias em aberto", icon: ArrowUpRight }, { label: "Comandas abertas", value: data.orders.length, detail: money.format(data.orders.reduce((s, o) => s + Number(o.total), 0)), icon: Utensils }].map((item) => <div key={item.label} className="rounded-lg border bg-card p-4"><div className="flex items-start justify-between gap-2"><p className="text-sm text-muted-foreground">{item.label}</p><item.icon className="h-4 w-4 shrink-0 text-primary" /></div><p className="my-3 text-3xl font-semibold">{item.value}</p><p className="text-xs text-muted-foreground">{item.detail}</p></div>)}
      </div>
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Operação do dia</h3><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{active.filter((r) => r.status === "pre_reserva").length} reservas pendentes</Badge><Button variant="ghost" size="sm" asChild><Link to="/calendario"><CalendarDays className="h-4 w-4" /> Calendário</Link></Button></div></div><div className="grid gap-6 md:grid-cols-2">{[{ label: "Entradas", rows: arrivals }, { label: "Saídas", rows: departures }].map((group) => <div key={group.label}><h4 className="mb-2 border-b pb-2 text-sm font-medium text-muted-foreground">{group.label} · {group.rows.length}</h4>{group.rows.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nenhuma {group.label === "Entradas" ? "entrada" : "saída"} prevista hoje.</p> : group.rows.map((r) => <Button key={r.id} variant="ghost" className="h-auto w-full justify-between gap-3 border-b py-3 text-left" onClick={() => setSelected(r)}><span className="min-w-0"><span className="block truncate font-medium">{r.guest_name}</span><span className="block truncate text-xs text-muted-foreground">{roomName(r.room_id)} · {origin(r)}</span></span><ChevronRight className="h-4 w-4 shrink-0" /></Button>)}</div>)}</div></section>
      <section className="space-y-4 border-t pt-6"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Resultado do mês</h3><Button variant="ghost" size="sm" asChild><Link to="/financeiro">Financeiro <ChevronRight className="h-4 w-4" /></Link></Button></div><div className="grid gap-4 sm:grid-cols-3">{[{ label: "Recebido", value: sum(receipts), color: "text-success" }, { label: "Pago", value: sum(expenses), color: "text-destructive" }, { label: "Saldo", value: sum(receipts) - sum(expenses), color: "text-primary" }].map((item) => <div key={item.label}><p className="text-sm text-muted-foreground">{item.label}</p><p className={`mt-1 break-words text-2xl font-semibold ${item.color}`}>{money.format(item.value)}</p></div>)}</div><div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm"><span>Pousada: <strong>{money.format(sum(receipts.filter((t) => t.business_unit === "pousada")))}</strong></span><span>Lanchonete: <strong>{money.format(sum(receipts.filter((t) => t.business_unit === "lanchonete")))}</strong></span><span>Caixa: <strong>{data.registers.length ? "Aberto" : "Fechado"}</strong></span></div></section>
      <section className="grid gap-6 border-t pt-6 md:grid-cols-2"><div><h3 className="mb-4 text-lg font-semibold">Quartos</h3><div className="grid grid-cols-2 gap-3">{[{ status: "disponivel", label: "Disponíveis", color: "bg-success" }, { status: "ocupado", label: "Ocupados", color: "bg-destructive" }, { status: "limpeza", label: "Em limpeza", color: "bg-warning" }, { status: "manutencao", label: "Manutenção", color: "bg-muted-foreground" }].map((s) => <div key={s.status} className="flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${s.color}`} /><span>{s.label}</span><strong className="ml-auto">{data.rooms.filter((r) => r.status === s.status).length}</strong></div>)}</div><Button asChild variant="outline" className="mt-4"><Link to="/hospedagem"><BedDouble className="h-4 w-4" /> Hospedagem</Link></Button></div><div><h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Estoque mínimo</h3>{lowStock.length ? lowStock.map((i) => <div key={i.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span className="min-w-0 break-words">{i.name}</span><span className="shrink-0 text-destructive">{Number(i.stock_quantity)} / {Number(i.min_stock)} {i.unit}</span></div>) : <p className="text-sm text-muted-foreground">Nenhum insumo abaixo do nível mínimo.</p>}</div></section>
    </main><ReservationDetails reservation={selected ? data.reservations.find((r) => r.id === selected.id) ?? null : null} roomName={selected ? roomName(selected.room_id) : undefined} onClose={() => setSelected(null)} />
  </div>;
}