import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReservationDetails } from "@/components/reservation-details";
import { todayISO, formatDate } from "@/lib/management";
import { monthlyOccupancy } from "@/lib/occupancy";

const colors: Record<string, string> = { pre_reserva: "bg-warning/25 text-warning-foreground", confirmada: "bg-primary/20 text-primary", hospedado: "bg-destructive/20 text-destructive", finalizada: "bg-muted text-muted-foreground" };
export function MonthlyOccupancy({ rooms, reservations }: { rooms: Tables<"rooms">[]; reservations: Tables<"reservations">[] }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const report = monthlyOccupancy(rooms, reservations, month);
  const selected = reservations.find(r => r.id === selectedId) ?? null;
  function shift(offset: number) { const year = Number(month.slice(0, 4)), number = Number(month.slice(5, 7)); const d = new Date(year, number - 1 + offset, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  return <section id="ocupacao" aria-label="Ocupação mensal" className="space-y-5 border-y py-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-semibold">Ocupação mensal</h3><p className="mt-1 text-sm text-muted-foreground">{report.occupied} diárias ocupadas de {report.capacity} diárias disponíveis</p></div><div className="text-right"><p className="text-3xl font-semibold text-primary">{report.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p><p className="text-xs text-muted-foreground">Ocupação geral do mês</p></div></div>
    <div className="flex flex-wrap items-end gap-2"><div className="space-y-1.5"><Label htmlFor="occupancy-month">Mês</Label><Input id="occupancy-month" type="month" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }} className="w-44" /></div><Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setMonth(todayISO().slice(0, 7))}>Mês atual</Button></div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">{[{ label: "Livre", color: "bg-success/20" }, { label: "Pré-reserva", color: "bg-warning/25" }, { label: "Confirmada", color: "bg-primary/20" }, { label: "Hospedado", color: "bg-destructive/20" }, { label: "Finalizada", color: "bg-muted" }].map(item => <span key={item.label} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${item.color}`} />{item.label}</span>)}</div>
    {!rooms.length ? <p className="text-sm text-muted-foreground">Nenhum quarto cadastrado.</p> : <div className="overflow-x-auto"><table className="w-full border-separate border-spacing-1 text-xs"><thead><tr><th className="sticky left-0 z-10 min-w-36 bg-background text-left font-medium">Quarto</th>{report.days.map(date => <th key={date} className="min-w-8 font-medium text-muted-foreground">{Number(date.slice(-2))}</th>)}</tr></thead><tbody>{report.rows.map(({ room, cells }) => <tr key={room.id}><th className="sticky left-0 z-10 max-w-44 bg-background pr-3 text-left font-medium"><span className="block break-words">{room.name}</span></th>{cells.map(({ date, reservation }) => <td key={date}>{reservation ? <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-sm p-0 ${colors[reservation.status] ?? colors["confirmada"]}`} aria-label={`${room.name}, ${formatDate(date)}, ${reservation.guest_name}`} title={`${reservation.guest_name} · ${formatDate(date)}`} onClick={() => setSelectedId(reservation.id)}><span className="text-[10px]">{Number(date.slice(-2))}</span></Button> : <span title={`${room.name} · ${formatDate(date)} · Livre`} className="flex h-8 w-8 items-center justify-center rounded-sm bg-success/10 text-[10px] text-success">{Number(date.slice(-2))}</span>}</td>)}</tr>)}</tbody></table></div>}
    <ReservationDetails reservation={selected} roomName={rooms.find(r => r.id === selected?.room_id)?.name} onClose={() => setSelectedId(null)} />
  </section>;
}