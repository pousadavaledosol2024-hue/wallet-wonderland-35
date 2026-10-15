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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BedDouble, ChevronLeft, ChevronRight, LogIn, LogOut, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hospedagem")({
  head: () => ({
    meta: [
      { title: "Hospedagem — Pousada Vale do Sol" },
      { name: "description", content: "Mapa de quartos, check-in, check-out e governança da Pousada Vale do Sol." },
      { property: "og:title", content: "Hospedagem — Pousada Vale do Sol" },
      { property: "og:description", content: "Mapa de quartos, check-in, check-out e governança da Pousada Vale do Sol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HospedagemPage,
});

type Room = Tables<"rooms">;
type Reservation = Tables<"reservations">;
type RoomStatus = "disponivel" | "ocupado" | "limpeza" | "manutencao";

const STATUS: Record<RoomStatus, { label: string; card: string; dot: string; cell: string }> = {
  disponivel: { label: "Disponível", card: "border-success/50 bg-success/10", dot: "bg-success", cell: "bg-success/20" },
  ocupado: { label: "Ocupado", card: "border-destructive/50 bg-destructive/10", dot: "bg-destructive", cell: "bg-destructive/70" },
  limpeza: { label: "Limpeza", card: "border-warning/60 bg-warning/15", dot: "bg-warning", cell: "bg-warning/40" },
  manutencao: { label: "Manutenção", card: "border-border bg-muted", dot: "bg-muted-foreground", cell: "bg-muted-foreground/30" },
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const nightsBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b + "T00:00").getTime() - new Date(a + "T00:00").getTime()) / 86400000));
const fmt = (s: string) => s.split("-").reverse().join("/");

function HospedagemPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState(() => addDays(new Date(), -1));
  const [roomDialog, setRoomDialog] = useState(false);
  const [checkInRoom, setCheckInRoom] = useState<Room | null>(null);
  const [checkOutRes, setCheckOutRes] = useState<{ room: Room; res: Reservation } | null>(null);

  const load = useCallback(async () => {
    const [r, res] = await Promise.all([
      supabase.from("rooms").select("*").order("name"),
      supabase
        .from("reservations")
        .select("*")
        .neq("status", "cancelada")
        .gte("check_out", iso(addDays(new Date(), -60)))
        .order("check_in"),
    ]);
    if (r.error || res.error) toast.error("Erro ao carregar hospedagem.");
    setRooms(r.data ?? []);
    setReservations(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("hospedagem")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const activeByRoom = useMemo(() => {
    const m = new Map<string, Reservation>();
    for (const r of reservations) if (r.status === "hospedado") m.set(r.room_id, r);
    return m;
  }, [reservations]);

  const counts = useMemo(() => {
    const c: Record<RoomStatus, number> = { disponivel: 0, ocupado: 0, limpeza: 0, manutencao: 0 };
    for (const r of rooms) c[r.status as RoomStatus]++;
    return c;
  }, [rooms]);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(start, i)), [start]);

  async function setRoomStatus(room: Room, status: RoomStatus) {
    if (room.status === "ocupado" && activeByRoom.has(room.id) && status !== "ocupado") {
      toast.error("Faça o check-out antes de alterar este quarto.");
      return;
    }
    const { error } = await supabase.from("rooms").update({ status }).eq("id", room.id);
    if (error) toast.error("Não foi possível atualizar o quarto.");
    else toast.success(`${room.name}: ${STATUS[status].label}`);
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Hospedagem</h2>
            <p className="text-sm text-muted-foreground">Mapa dos quartos atualizado em tempo real</p>
          </div>
          <Button variant="outline" onClick={() => setRoomDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo quarto
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(STATUS) as RoomStatus[]).map((s) => (
            <Card key={s} className={STATUS[s].card}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${STATUS[s].dot}`} />
                  <span className="text-sm font-medium">{STATUS[s].label}</span>
                </div>
                <span className="text-2xl font-bold">{counts[s]}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapa de quartos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Carregando...</p>
            ) : rooms.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhum quarto cadastrado. Clique em "Novo quarto" para começar.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => {
                  const st = room.status as RoomStatus;
                  const active = activeByRoom.get(room.id);
                  return (
                    <div key={room.id} className={`space-y-3 rounded-lg border-2 p-4 ${STATUS[st].card}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{room.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {room.room_type} · <Users className="inline h-3 w-3" /> {room.capacity} ·{" "}
                            {brl.format(Number(room.daily_rate))}/noite
                          </p>
                        </div>
                        <Badge variant="outline" className="gap-1.5 bg-card">
                          <span className={`h-2 w-2 rounded-full ${STATUS[st].dot}`} />
                          {STATUS[st].label}
                        </Badge>
                      </div>
                      {active && (
                        <div className="rounded-md bg-card p-2 text-sm">
                          <p className="font-medium">{active.guest_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(active.check_in)} → {fmt(active.check_out)} · {active.guests_count} hóspede(s)
                          </p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {st === "disponivel" && (
                          <Button size="sm" onClick={() => setCheckInRoom(room)}>
                            <LogIn className="mr-1 h-4 w-4" /> Check-in
                          </Button>
                        )}
                        {active && (
                          <Button size="sm" variant="destructive" onClick={() => setCheckOutRes({ room, res: active })}>
                            <LogOut className="mr-1 h-4 w-4" /> Check-out
                          </Button>
                        )}
                        {st === "limpeza" && (
                          <Button size="sm" variant="outline" className="bg-card" onClick={() => setRoomStatus(room, "disponivel")}>
                            <Sparkles className="mr-1 h-4 w-4" /> Limpeza concluída
                          </Button>
                        )}
                        {!active && (
                          <Select value={st} onValueChange={(v) => setRoomStatus(room, v as RoomStatus)}>
                            <SelectTrigger className="h-8 w-36 bg-card text-xs" aria-label="Governança">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="disponivel">Disponível</SelectItem>
                              <SelectItem value="limpeza">Limpeza</SelectItem>
                              <SelectItem value="manutencao">Manutenção</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {rooms.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Calendário de ocupação</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setStart(addDays(start, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setStart(addDays(new Date(), -1))}>Hoje</Button>
                <Button variant="outline" size="icon" aria-label="Próxima semana" onClick={() => setStart(addDays(start, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-xs">
                <thead>
                  <tr>
                    <th className="min-w-28 text-left font-medium text-muted-foreground">Quarto</th>
                    {days.map((d) => {
                      const today = iso(d) === iso(new Date());
                      return (
                        <th key={iso(d)} className={`min-w-10 rounded font-medium ${today ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                          <div>{d.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}</div>
                          <div>{d.getDate()}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="font-medium">{room.name}</td>
                      {days.map((d) => {
                        const day = iso(d);
                        const r = reservations.find((x) => x.room_id === room.id && x.check_in <= day && x.check_out > day);
                        return (
                          <td
                            key={day}
                            title={r ? `${r.guest_name} (${fmt(r.check_in)} → ${fmt(r.check_out)})` : "Livre"}
                            className={`h-8 rounded ${
                              r ? (r.status === "finalizada" ? "bg-muted-foreground/30" : STATUS.ocupado.cell) : "bg-muted/50"
                            }`}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                Passe o mouse sobre uma célula para ver o hóspede. Vermelho: hospedagem ativa · Cinza: estadia finalizada.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <RoomDialog open={roomDialog} onOpenChange={setRoomDialog} onSaved={load} />
      <CheckInDialog room={checkInRoom} onClose={() => setCheckInRoom(null)} onSaved={load} />
      <CheckOutDialog data={checkOutRes} onClose={() => setCheckOutRes(null)} onSaved={load} />
    </div>
  );
}

async function getUserId() {
  const { data, error } = await supabase.rpc("account_owner");
  if (error || !data) throw Error("Sua sessão expirou. Entre novamente.");
  return data;
}

function parseMoney(v: string) {
  return Number(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function RoomDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Suíte");
  const [capacity, setCapacity] = useState("2");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error("Informe o nome do quarto."); return; }
    setSaving(true);
    const user_id = await getUserId();
    const { error } = await supabase.from("rooms").insert({
      user_id,
      name: name.trim(),
      room_type: type,
      capacity: Number(capacity) || 1,
      daily_rate: parseMoney(rate),
    });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar o quarto."); return; }
    toast.success("Quarto cadastrado.");
    setName("");
    setRate("");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo quarto</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rname">Nome</Label>
            <Input id="rname" placeholder="Suíte 1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Suíte", "Suíte master", "Chalé", "Quarto standard", "Quarto família"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rcap">Capacidade</Label>
              <Input id="rcap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rrate">Diária (R$)</Label>
              <Input id="rrate" inputMode="decimal" placeholder="350,00" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckInDialog({ room, onClose, onSaved }: { room: Room | null; onClose: () => void; onSaved: () => void }) {
  const today = iso(new Date());
  const [f, setF] = useState({ guest_name: "", guest_document: "", guest_phone: "", guest_email: "", guests_count: "1", check_out: iso(addDays(new Date(), 1)), paid: "", source: "Direto", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (room) setF((p) => ({ ...p, guest_name: "", guest_document: "", guest_phone: "", guest_email: "", guests_count: "1", check_out: iso(addDays(new Date(), 1)), paid: "", notes: "" }));
  }, [room]);

  const nights = f.check_out > today ? nightsBetween(today, f.check_out) : 0;
  const total = room ? nights * Number(room.daily_rate) : 0;

  async function save() {
    if (!room) return;
    if (!f.guest_name.trim() || !f.guest_document.trim()) { toast.error("Informe nome e documento do hóspede."); return; }
    if (nights < 1) { toast.error("A data de saída deve ser após hoje."); return; }
    setSaving(true);
    const user_id = await getUserId();
    const { error } = await supabase.from("reservations").insert({
      user_id,
      room_id: room.id,
      guest_name: f.guest_name.trim(),
      guest_document: f.guest_document.trim(),
      guest_phone: f.guest_phone || null,
      guest_email: f.guest_email || null,
      guests_count: Number(f.guests_count) || 1,
      check_in: today,
      check_out: f.check_out,
      total_amount: total,
      paid_amount: parseMoney(f.paid),
      status: "hospedado",
      source: f.source,
      notes: f.notes || null,
    });
    if (!error) await supabase.from("rooms").update({ status: "ocupado" }).eq("id", room.id);
    setSaving(false);
    if (error) { toast.error("Não foi possível registrar o check-in."); return; }
    toast.success(`Check-in de ${f.guest_name} em ${room.name}.`);
    onClose();
    onSaved();
  }

  return (
    <Dialog open={!!room} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check-in — {room?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm font-medium text-muted-foreground">Ficha do hóspede</p>
          <div className="grid gap-1.5">
            <Label htmlFor="gname">Nome completo *</Label>
            <Input id="gname" value={f.guest_name} onChange={set("guest_name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="gdoc">CPF / Documento *</Label>
              <Input id="gdoc" value={f.guest_document} onChange={set("guest_document")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gphone">Telefone</Label>
              <Input id="gphone" inputMode="tel" value={f.guest_phone} onChange={set("guest_phone")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gmail">E-mail</Label>
            <Input id="gmail" type="email" value={f.guest_email} onChange={set("guest_email")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="gcount">Hóspedes</Label>
              <Input id="gcount" type="number" min={1} max={room?.capacity} value={f.guests_count} onChange={set("guests_count")} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="gout">Data de saída</Label>
              <Input id="gout" type="date" min={iso(addDays(new Date(), 1))} value={f.check_out} onChange={set("check_out")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Origem</Label>
              <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Direto", "WhatsApp", "Booking", "Airbnb", "Telefone", "Outro"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gpaid">Sinal pago (R$)</Label>
              <Input id="gpaid" inputMode="decimal" placeholder="0,00" value={f.paid} onChange={set("paid")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gnotes">Observações</Label>
            <Textarea id="gnotes" rows={2} value={f.notes} onChange={set("notes")} />
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            {nights} noite(s) × {brl.format(Number(room?.daily_rate ?? 0))} = <strong>{brl.format(total)}</strong>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            <BedDouble className="mr-2 h-4 w-4" /> {saving ? "Registrando..." : "Confirmar check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckOutDialog({ data, onClose, onSaved }: { data: { room: Room; res: Reservation } | null; onClose: () => void; onSaved: () => void }) {
  const [method, setMethod] = useState("Pix");
  const [saving, setSaving] = useState(false);
  const [tabs, setTabs] = useState<{ id: string; number: number; total: number }[]>([]);
  const res = data?.res;
  useEffect(() => {
    setTabs([]);
    if (!res) return;
    supabase.from("orders").select("id, number, total").eq("reservation_id", res.id).eq("status", "aberta")
      .then(({ data }) => setTabs((data ?? []).map((o) => ({ ...o, total: Number(o.total) }))));
  }, [res]);
  const tabsTotal = tabs.reduce((s, o) => s + o.total, 0);
  const remaining = res ? Math.max(0, Number(res.total_amount) - Number(res.paid_amount)) + tabsTotal : 0;

  async function confirm() {
    if (!data || !res) return;
    setSaving(true);
    const { error } = await supabase.rpc("settle_checkout", { _reservation: res.id, _method: method });
    setSaving(false);
    if (error) { toast.error(error.message.includes("Abra o caixa") ? "Abra o caixa antes de receber." : "Não foi possível concluir o check-out."); return; }
    toast.success(`Check-out concluído. ${data.room.name} enviado para limpeza.`);
    onClose();
    onSaved();
  }

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-out — {data?.room.name}</DialogTitle>
        </DialogHeader>
        {res && (
          <div className="grid gap-3 text-sm">
            <div className="rounded-md bg-muted p-3">
              <p className="font-medium">{res.guest_name}</p>
              <p className="text-muted-foreground">{fmt(res.check_in)} → {fmt(res.check_out)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><p className="text-muted-foreground">Total</p><p className="font-semibold">{brl.format(Number(res.total_amount))}</p></div>
              <div><p className="text-muted-foreground">Já pago</p><p className="font-semibold">{brl.format(Number(res.paid_amount))}</p></div>
              <div><p className="text-muted-foreground">A receber</p><p className="font-semibold text-success">{brl.format(remaining)}</p></div>
            </div>
            {tabs.length > 0 && (
              <div className="rounded-md border p-3">
                <p className="font-medium">Consumo na lanchonete</p>
                {tabs.map((o) => (
                  <p key={o.id} className="flex justify-between text-muted-foreground"><span>Comanda #{o.number}</span><span>{brl.format(o.total)}</span></p>
                ))}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              O valor total entra no Financeiro como receita recebida e o quarto vai para limpeza.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="destructive" onClick={confirm} disabled={saving}>
            {saving ? "Concluindo..." : "Confirmar check-out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
