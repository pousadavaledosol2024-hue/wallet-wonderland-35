import type { Tables } from "@/integrations/supabase/types";

export function monthlyOccupancy(rooms: Tables<"rooms">[], reservations: Tables<"reservations">[], month: string) {
  const [year, number] = month.split("-").map(Number);
  const length = new Date(year, number, 0).getDate();
  const days = Array.from({ length }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  const stays = reservations.filter(r => ["pre_reserva", "confirmada", "hospedado", "finalizada"].includes(r.status));
  const rows = rooms.map(room => ({ room, cells: days.map(date => ({ date, reservation: stays.find(r => r.room_id === room.id && r.check_in <= date && r.check_out > date) ?? null })) }));
  const occupied = rows.reduce((total, row) => total + row.cells.filter(cell => cell.reservation).length, 0);
  const capacity = rooms.length * length;
  return { days, rows, occupied, capacity, percent: capacity ? occupied / capacity * 100 : 0 };
}