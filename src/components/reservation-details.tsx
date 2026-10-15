import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate, money, origin, type Reservation } from "@/lib/management";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { configOptions } from "@/lib/admin-config";
import { manageReservation } from "@/lib/reservation-management.functions";
import { CrudActions } from "@/components/crud-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReservationDetails({ reservation, roomName, onClose }: { reservation: Reservation | null; roomName?: string | undefined; onClose: () => void }) {
  const { data: config } = useSuspenseQuery(configOptions);
  const manage = useServerFn(manageReservation); const qc = useQueryClient();
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({ name: "", phone: "", email: "", document: "", notes: "" });
  useEffect(() => { setEditing(false); if (reservation) setFields({ name: reservation.guest_name, phone: reservation.guest_phone ?? "", email: reservation.guest_email ?? "", document: reservation.guest_document ?? "", notes: reservation.notes ?? "" }); }, [reservation]);
  const locked = Boolean(reservation?.import_feed_id) || !["pre_reserva", "confirmada", "hospedado"].includes(reservation?.status ?? "");
  return <Dialog open={Boolean(reservation)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85vh] overflow-auto">
      <DialogHeader><DialogTitle className="break-words">{reservation?.guest_name}</DialogTitle><DialogDescription>{roomName} · Detalhes da reserva</DialogDescription></DialogHeader>
      {reservation && <div className="space-y-5">
        <div className="flex flex-wrap gap-2"><Badge variant="secondary">{reservation.status === "hospedado" ? "Hospedado" : reservation.status === "pre_reserva" ? "Pré-reserva" : reservation.status === "finalizada" ? "Finalizada" : "Confirmada"}</Badge><Badge variant="outline">{origin(reservation)}</Badge></div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted-foreground">Entrada</dt><dd className="font-medium">{formatDate(reservation.check_in)}</dd></div>
          <div><dt className="text-muted-foreground">Saída</dt><dd className="font-medium">{formatDate(reservation.check_out)}</dd></div>
          <div><dt className="text-muted-foreground">Hóspedes</dt><dd>{reservation.guests_count}</dd></div>
          <div><dt className="text-muted-foreground">Origem</dt><dd className="break-words">{origin(reservation)}</dd></div>
          <div><dt className="text-muted-foreground">Total</dt><dd>{money.format(Number(reservation.total_amount))}</dd></div>
          <div><dt className="text-muted-foreground">Pago</dt><dd>{money.format(Number(reservation.paid_amount))}</dd></div>
          {reservation.guest_phone && <div className="col-span-2"><dt className="text-muted-foreground">Telefone</dt><dd>{reservation.guest_phone}</dd></div>}
        </dl>
        {reservation.notes && <p className="whitespace-pre-wrap break-words border-t pt-4 text-sm">{reservation.notes}</p>}
        <CrudActions name="reserva" disabled={busy || locked} deleteDisabled={config.role !== "admin" || reservation.status === "hospedado" || Number(reservation.paid_amount) > 0} reason="Reservas importadas, históricas ou com pagamentos/estadia devem ser preservadas." onEdit={() => setEditing(true)} deleteLabel="Cancelar" description="Cancelar esta reserva e liberar suas datas? O histórico será mantido. Reservas com comandas não podem ser canceladas aqui." onDelete={async () => { try { await manage({ data: { action: "cancel", id: reservation.id } }); await qc.invalidateQueries({ queryKey: ["management"] }); onClose(); toast.success("Reserva cancelada"); } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível cancelar"); throw e; } }} />
        {editing && <form className="space-y-3 border-t pt-4" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await manage({ data: { action: "edit", id: reservation.id, ...fields } }); await qc.invalidateQueries({ queryKey: ["management"] }); toast.success("Ficha atualizada"); onClose(); } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível alterar"); } finally { setBusy(false); } }}>{([["name", "Nome"], ["document", "Documento"], ["phone", "Telefone"], ["email", "E-mail"]] as const).map(([key, label]) => <div key={key} className="space-y-1"><Label htmlFor={`reservation-${key}`}>{label}</Label><Input id={`reservation-${key}`} type={key === "email" ? "email" : "text"} maxLength={key === "phone" ? 30 : key === "document" ? 60 : 120} required={key === "name"} value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })} /></div>)}<Label htmlFor="reservation-notes">Observações</Label><Textarea id="reservation-notes" maxLength={5000} value={fields.notes} onChange={e => setFields({ ...fields, notes: e.target.value })} /><div className="flex gap-2"><Button type="submit" disabled={busy}>Salvar alterações</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Cancelar</Button></div></form>}
      </div>}
    </DialogContent>
  </Dialog>;
}