import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, CalendarDays } from "lucide-react";
import { AdminHeader } from "@/components/admin-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReservationDetails } from "@/components/reservation-details";
import { managementOptions, useManagementRealtime, dateISO, todayISO, blocksDates, origin, formatDate } from "@/lib/management";

export const Route = createFileRoute("/_authenticated/calendario")({
  loader: ({ context }) => context.queryClient.ensureQueryData(managementOptions),
  head: () => ({ meta: [
    { title: "Calendário de Reservas — Pousada Vale do Sol" }, { name: "description", content: "Datas livres e reservadas por suíte, hóspedes e origem das reservas da Pousada Vale do Sol." },
    { property: "og:title", content: "Calendário de Reservas — Pousada Vale do Sol" }, { property: "og:description", content: "Disponibilidade das suítes e detalhes de reservas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data } = useSuspenseQuery(managementOptions);
  const connection = useManagementRealtime();
  const today = todayISO();
  const [start, setStart] = useState(today);
  const [view, setView] = useState("14");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const length = Number(view);
  const days = useMemo(() => Array.from({ length }, (_, i) => { const d = new Date(`${start}T12:00:00`); d.setDate(d.getDate() + i); return d; }), [start, length]);
  const reservations = data.reservations.filter(blocksDates);
  const rooms = data.rooms.filter((r) => r.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const selected = data.reservations.find((r) => r.id === selectedId) ?? null;
  const shift = (n: number) => { const date = new Date(`${start}T12:00:00`); date.setDate(date.getDate() + n); setStart(dateISO(date)); };
  const styles = { hospedado: "bg-destructive/15 text-destructive border-destructive/30", confirmada: "bg-primary/15 text-primary border-primary/30", pre_reserva: "bg-warning/20 text-warning-foreground border-warning/40" };
  return <div className="min-h-screen bg-background"><AdminHeader /><main className="mx-auto max-w-6xl space-y-6 px-4 py-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Calendário</h2><Badge variant="outline" className="gap-2"><span className={`h-2 w-2 rounded-full ${connection === "Ao vivo" ? "bg-success" : "bg-warning"}`} />{connection}</Badge></div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div className="flex flex-wrap items-end gap-2"><div className="space-y-1.5"><Label htmlFor="calendar-start">A partir de</Label><Input id="calendar-start" type="date" value={start} onChange={(e) => { if (e.target.value) setStart(e.target.value); }} className="w-40" /></div><Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => shift(-length)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setStart(today)}>Hoje</Button><Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => shift(length)}><ChevronRight className="h-4 w-4" /></Button></div><Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="7">Semana</TabsTrigger><TabsTrigger value="14">Quinzena</TabsTrigger><TabsTrigger value="30">30 dias</TabsTrigger></TabsList></Tabs></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">{formatDate(start)} — {days[length - 1] ? formatDate(dateISO(days[length - 1] as Date)) : ""}</p><div className="relative w-full sm:w-56"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar quarto" placeholder="Buscar quarto" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div></div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">{[{ label: "Livre", dot: "bg-success" }, { label: "Reservado", dot: "bg-primary" }, { label: "Hospedado", dot: "bg-destructive" }, { label: "Pré-reserva", dot: "bg-warning" }, { label: "Limpeza / Manutenção", dot: "bg-muted-foreground" }].map((s) => <span key={s.label} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span>)}</div>
    {rooms.length === 0 ? <div className="border-y py-16 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{data.rooms.length ? "Nenhum quarto encontrado." : "Nenhum quarto cadastrado."}</p></div> : <div className="overflow-x-auto rounded-md border bg-card"><table className="w-full border-collapse text-sm"><thead><tr><th className="sticky left-0 z-20 min-w-32 border-b border-r bg-card p-3 text-left">Quarto</th>{days.map((d) => <th key={dateISO(d)} className={`min-w-24 border-b border-r p-2 text-center ${dateISO(d) === today ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}><span className="block text-xs font-normal capitalize">{d.toLocaleDateString("pt-BR", { weekday: "short" })}</span><span className="block">{d.getDate()} / {d.getMonth() + 1}</span></th>)}</tr></thead><tbody>{rooms.map((room) => <tr key={room.id}><th className="sticky left-0 z-10 max-w-44 border-b border-r bg-card p-3 text-left"><span className="block break-words">{room.name}</span><span className="text-xs font-normal text-muted-foreground">{room.capacity} hóspedes</span></th>{days.map((d) => {
      const date = dateISO(d);
      const reservation = reservations.find((r) => r.room_id === room.id && r.check_in <= date && r.check_out > date);
      const unavailable = date === today && ["limpeza", "manutencao", "ocupado"].includes(room.status);
      const state = room.status === "limpeza" ? "Limpeza" : room.status === "manutencao" ? "Manutenção" : "Ocupado";
      return <td key={date} className="border-b border-r p-1">{reservation ? <Button variant="ghost" className={`h-16 w-full max-w-32 flex-col items-start gap-1 rounded border px-2 ${styles[reservation.status as keyof typeof styles] ?? styles.confirmada}`} aria-label={`${room.name}, ${formatDate(date)}, ${reservation.guest_name}, ${origin(reservation)}`} onClick={() => setSelectedId(reservation.id)}><span className="block w-full truncate text-xs font-semibold">{reservation.guest_name}</span><span className="block w-full truncate text-[10px]">{origin(reservation)}</span></Button> : <Popover><PopoverTrigger asChild><Button variant="ghost" className={`h-16 w-full rounded text-xs ${unavailable ? "bg-muted text-muted-foreground" : "bg-success/5 text-success"}`} aria-label={`${room.name}, ${formatDate(date)}, ${unavailable ? state : "Livre"}`}>{unavailable ? state : "Livre"}</Button></PopoverTrigger><PopoverContent className="w-64 space-y-2"><p className="font-semibold">{room.name}</p><p className="text-sm">{formatDate(date)} · {unavailable ? state : "Data livre"}</p><p className="text-xs text-muted-foreground">{room.capacity} hóspedes</p></PopoverContent></Popover>}</td>;
    })}</tr>)}</tbody></table></div>}
  </main><ReservationDetails reservation={selected} roomName={data.rooms.find((r) => r.id === selected?.room_id)?.name} onClose={() => setSelectedId(null)} /></div>;
}