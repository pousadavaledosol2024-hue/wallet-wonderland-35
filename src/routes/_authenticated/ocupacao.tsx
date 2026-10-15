import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BedDouble, Users } from "lucide-react";
import { AdminHeader } from "@/components/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReservationDetails } from "@/components/reservation-details";
import { managementOptions, useManagementRealtime, todayISO, blocksDates, type Reservation } from "@/lib/management";

export const Route = createFileRoute("/_authenticated/ocupacao")({
  loader: ({ context }) => context.queryClient.ensureQueryData(managementOptions),
  head: () => ({ meta: [
    { title: "Ocupação — Pousada Vale do Sol" },
    { name: "description", content: "Ocupação atual e situação dos quartos da Pousada Vale do Sol." },
    { property: "og:title", content: "Ocupação — Pousada Vale do Sol" },
    { property: "og:description", content: "Disponibilidade, hóspedes e governança dos quartos em tempo real." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Occupancy,
});

const statuses = [
  { value: "disponivel", label: "Disponível", color: "bg-success" },
  { value: "ocupado", label: "Ocupado", color: "bg-destructive" },
  { value: "limpeza", label: "Limpeza", color: "bg-warning" },
  { value: "manutencao", label: "Manutenção", color: "bg-muted-foreground" },
];

function Occupancy() {
  const { data } = useSuspenseQuery(managementOptions);
  const connection = useManagementRealtime();
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [filter, setFilter] = useState("todos");
  const today = todayISO();
  const current = selected ? data.reservations.find((r) => r.id === selected.id) ?? null : null;
  return <div className="min-h-screen bg-background">
    <AdminHeader />
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Ocupação</h2>
        <Badge variant="outline" className="gap-2"><span className={`h-2 w-2 rounded-full ${connection === "Ao vivo" ? "bg-success" : "bg-warning"}`} />{connection}</Badge>
      </div>
      <div aria-label="Filtrar situação dos quartos" className="flex flex-wrap gap-2">
        <Button variant={filter === "todos" ? "secondary" : "ghost"} aria-pressed={filter === "todos"} onClick={() => setFilter("todos")}>Todos · {data.rooms.length}</Button>
        {statuses.map((s) => <Button key={s.value} variant={filter === s.value ? "secondary" : "ghost"} aria-pressed={filter === s.value} onClick={() => setFilter(s.value)}><span className={`h-2 w-2 rounded-full ${s.color}`} />{s.label} · {data.rooms.filter((r) => r.status === s.value).length}</Button>)}
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Situação dos quartos">
        {data.rooms.filter((room) => filter === "todos" || room.status === filter).map((room) => {
          const status = statuses.find((s) => s.value === room.status);
          const stay = data.reservations.find((r) => r.room_id === room.id && blocksDates(r) && r.check_in <= today && r.check_out > today);
          return <article key={room.id} className="space-y-4 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><BedDouble className="h-4 w-4 text-primary" />{room.name}</h3><Badge variant="outline" className="gap-2"><span className={`h-2 w-2 rounded-full ${status?.color ?? "bg-muted-foreground"}`} />{status?.label ?? room.status}</Badge></div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />{room.capacity} hóspedes · {room.room_type}</p>
            {stay ? <Button variant="outline" className="w-full justify-start overflow-hidden" onClick={() => setSelected(stay)}><span className="truncate">{stay.guest_name}</span></Button> : <p className="text-sm text-muted-foreground">Sem estadia nesta data</p>}
            <Button asChild variant="ghost" size="sm"><Link to="/hospedagem">Hospedagem</Link></Button>
          </article>;
        })}
      </section>
      {data.rooms.filter((room) => filter === "todos" || room.status === filter).length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum quarto nesta situação.</p>}
    </main>
    <ReservationDetails reservation={current} roomName={current ? data.rooms.find((r) => r.id === current.room_id)?.name : undefined} onClose={() => setSelected(null)} />
  </div>;
}