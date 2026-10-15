import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate, money, origin, type Reservation } from "@/lib/management";

export function ReservationDetails({ reservation, roomName, onClose }: { reservation: Reservation | null; roomName?: string; onClose: () => void }) {
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
      </div>}
    </DialogContent>
  </Dialog>;
}