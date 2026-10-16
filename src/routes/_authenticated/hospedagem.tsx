import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AdminHeader } from "@/components/admin-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { BedDouble, ImagePlus, LogIn, LogOut, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { configOptions } from "@/lib/admin-config";
import { calculateStay } from "@/lib/pricing";
import { registerCheckIn } from "@/lib/check-in.functions";
import { managementOptions, useManagementRealtime } from "@/lib/management";
import { CrudActions } from "@/components/crud-actions";
import { deleteCatalogItem } from "@/lib/catalog.functions";
import { ReservationDetails } from "@/components/reservation-details";
import { MonthlyOccupancy } from "@/components/monthly-occupancy";

export const Route = createFileRoute("/_authenticated/hospedagem")({
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(configOptions), context.queryClient.ensureQueryData(managementOptions)]); },
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
const fmt = (s: string) => s.split("-").reverse().join("/");

function HospedagemPage() {
  const { data } = useSuspenseQuery(managementOptions);
  const { data: config } = useSuspenseQuery(configOptions);
  const removeCatalog = useServerFn(deleteCatalogItem);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const { rooms, reservations } = data;
  const qc = useQueryClient();
  const connection = useManagementRealtime();
  const loading = false;
  const load = useCallback(() => { void qc.invalidateQueries({ queryKey: managementOptions.queryKey }); }, [qc]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [roomDialog, setRoomDialog] = useState(false);
  const [checkInRoom, setCheckInRoom] = useState<Room | null>(null);
  const [checkOutRes, setCheckOutRes] = useState<{ room: Room; res: Reservation } | null>(null);

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
      <main className="mx-auto min-w-0 max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Hospedagem</h2>
            <p className="text-sm text-muted-foreground">Ocupação, quartos e estadias</p>
          </div>
          <Button variant="outline" disabled={config.role !== "admin"} onClick={() => { setEditingRoom(null); setRoomDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo quarto
          </Button>
        </div>

        <Badge variant="outline" className="gap-2"><span className={`h-2 w-2 rounded-full ${connection === "Ao vivo" ? "bg-success" : "bg-warning"}`} />{connection}</Badge>
        <MonthlyOccupancy rooms={rooms} reservations={reservations} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(STATUS) as RoomStatus[]).map((s) => (
            <Card key={s} className="bg-card">
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

        <section className="space-y-4">
          <h3 className="text-xl font-semibold">Mapa de quartos</h3>
          <div>
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
                    <div key={room.id} className={`space-y-3 rounded-lg border bg-card p-4 shadow-card`}>
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
                      <CrudActions name={room.name} disabled={config.role !== "admin"} deleteDisabled={reservations.some(r => r.room_id === room.id)} reason="Quartos vinculados a reservas são preservados; alterações de cadastro exigem administrador." onEdit={() => { setEditingRoom(room); setRoomDialog(true); }} onDelete={async () => { try { await removeCatalog({ data: { id: room.id, kind: "rooms" } }); load(); toast.success("Quarto excluído"); } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível excluir"); throw e; } }} />
                      {active && (
                        <div className="rounded-md bg-card p-2 text-sm">
                          <p className="font-medium">{active.guest_name}</p><Button size="sm" variant="outline" onClick={() => setSelectedReservation(active)}>Gerenciar reserva</Button>
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
          </div>
        </section>

      </main>

      <ReservationDetails reservation={selectedReservation} roomName={rooms.find(r => r.id === selectedReservation?.room_id)?.name} onClose={() => setSelectedReservation(null)} />
      <RoomDialog room={editingRoom} open={roomDialog} onOpenChange={setRoomDialog} onSaved={load} />
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

function RoomDialog({ room, open, onOpenChange, onSaved }: { room: Room | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Suíte");
  const [capacity, setCapacity] = useState("2");
  const [rate, setRate] = useState("");
  const [doubleBeds, setDoubleBeds] = useState("1");
  const [singleBeds, setSingleBeds] = useState("0");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [icalUrl, setIcalUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const beds = Array.isArray(room?.bed_configuration) ? room.bed_configuration as { type: string; quantity: number }[] : [];
      setName(room?.name ?? ""); setType(room?.room_type ?? "Suíte"); setCapacity(String(room?.capacity ?? 2));
      setRate(room ? Number(room.daily_rate).toFixed(2).replace(".", ",") : "");
      setDoubleBeds(String(beds.find((bed) => bed.type === "casal")?.quantity ?? 1));
      setSingleBeds(String(beds.find((bed) => bed.type === "solteiro")?.quantity ?? 0));
      setAmenities(room?.amenities ?? []); setPhotoPaths(room?.photo_paths ?? []); setNewPhotos([]);
      setDescription(room?.public_description ?? ""); setPosition(room?.room_position ?? ""); setNotes(room?.notes ?? ""); setIcalUrl(room?.ical_url ?? "");
    }
  }, [open, room]);

  useEffect(() => {
    let active = true;
    void Promise.all(photoPaths.map(async (path) => {
      const { data } = await supabase.storage.from("site-gallery").createSignedUrl(path, 3600);
      return [path, data?.signedUrl ?? ""] as const;
    })).then((entries) => { if (active) setPhotoUrls(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [photoPaths]);

  useEffect(() => {
    const urls = newPhotos.map((file) => URL.createObjectURL(file));
    setNewPhotoUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [newPhotos]);

  function toggleAmenity(amenity: string, checked: boolean) {
    setAmenities((current) => checked ? [...current, amenity] : current.filter((item) => item !== amenity));
  }

  function photoUrl(path: string) {
    return photoUrls[path] ?? "";
  }

  async function save() {
    if (!name.trim()) { toast.error("Informe o nome do quarto."); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), room_type: type, capacity: Number(capacity), daily_rate: parseMoney(rate),
        bed_configuration: [{ type: "casal", quantity: Number(doubleBeds) }, { type: "solteiro", quantity: Number(singleBeds) }].filter((bed) => bed.quantity > 0),
        amenities, photo_paths: photoPaths, public_description: description.trim(), room_position: position.trim(), notes: notes.trim() || null, ical_url: icalUrl.trim(),
      };
      if (!Number.isInteger(payload.capacity) || payload.capacity < 1) throw Error("Informe uma capacidade válida.");
      if (!Number.isInteger(Number(doubleBeds)) || Number(doubleBeds) < 0 || !Number.isInteger(Number(singleBeds)) || Number(singleBeds) < 0) throw Error("Informe quantidades válidas de camas.");
      if (icalUrl.trim()) {
        const parsedUrl = new URL(icalUrl.trim());
        if (parsedUrl.protocol !== "https:") throw Error("A URL iCal deve usar HTTPS.");
      }
      const accountId = await getUserId();
      const result = room
        ? await supabase.from("rooms").update(payload).eq("id", room.id).select("id").single()
        : await supabase.from("rooms").insert({ ...payload, user_id: accountId }).select("id").single();
      if (result.error || !result.data) throw Error("Não foi possível salvar o quarto.");
      const roomId = result.data.id;
      const uploaded: string[] = [];
      for (const file of newPhotos) {
        if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 5 * 1024 * 1024) throw Error("Use imagens JPG, PNG ou WebP com até 5 MB.");
        const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${accountId}/rooms/${roomId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("site-gallery").upload(path, file, { contentType: file.type, cacheControl: "0" });
        if (error) throw Error("Não foi possível enviar uma foto do quarto.");
        uploaded.push(path);
      }
      const finalPhotos = [...photoPaths, ...uploaded];
      const { error: photosError } = await supabase.from("rooms").update({ photo_paths: finalPhotos }).eq("id", roomId);
      if (photosError) throw Error("Quarto salvo, mas não foi possível vincular as fotos.");
      const removedPhotos = (room?.photo_paths ?? []).filter((path) => !photoPaths.includes(path));
      if (removedPhotos.length) await supabase.storage.from("site-gallery").remove(removedPhotos);
      toast.success(room ? "Quarto atualizado." : "Quarto cadastrado.");
      onOpenChange(false); onSaved();
    } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{room ? "Editar quarto" : "Novo quarto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5">
          <section className="grid gap-3">
            <h3 className="font-semibold">Informações básicas</h3>
          <div className="grid gap-1.5">
            <Label htmlFor="rname">Nome</Label>
            <Input id="rname" placeholder="Suíte 1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="rbeds-double">Camas de casal</Label><Input id="rbeds-double" type="number" min={0} step={1} value={doubleBeds} onChange={(event) => setDoubleBeds(event.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="rbeds-single">Camas de solteiro</Label><Input id="rbeds-single" type="number" min={0} step={1} value={singleBeds} onChange={(event) => setSingleBeds(event.target.value)} /></div>
          </div>
          </section>
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Comodidades</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{["Ar-condicionado", "Wi-Fi", "TV", "Frigobar", "Varanda/Sacada", "Térrea", "Andar superior"].map((amenity) => <label key={amenity} className="flex items-center gap-2 text-sm"><Checkbox checked={amenities.includes(amenity)} onCheckedChange={(checked) => toggleAmenity(amenity, checked === true)} />{amenity}</label>)}</div>
          </section>
          <section className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Fotos da acomodação</h3><Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"><ImagePlus className="h-4 w-4" />Adicionar fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { setNewPhotos((current) => [...current, ...Array.from(event.target.files ?? [])]); event.target.value = ""; }} /></Label></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{photoPaths.map((path) => <div key={path} className="relative"><img src={photoUrl(path)} alt="Foto do quarto" className="aspect-[4/3] w-full rounded-md border object-cover" /><Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 h-8 w-8" aria-label="Remover foto" onClick={() => setPhotoPaths((current) => current.filter((item) => item !== path))}><Trash2 className="h-4 w-4" /></Button></div>)}{newPhotos.map((file, index) => <div key={`${file.name}-${index}`} className="relative"><img src={newPhotoUrls[index]} alt={file.name} className="aspect-[4/3] w-full rounded-md border object-cover" /><Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 h-8 w-8" aria-label="Remover foto nova" onClick={() => setNewPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
            <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máximo de 5 MB por imagem.</p>
          </section>
          <section className="grid gap-3 border-t pt-4">
            <h3 className="font-semibold">Site público e integração</h3>
            <div className="grid gap-1.5"><Label htmlFor="rdescription">Descrição pública</Label><Textarea id="rdescription" rows={4} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="rposition">Posição / andar</Label><Input id="rposition" maxLength={120} placeholder="Ex.: térrea, 2º andar, vista para o jardim" value={position} onChange={(event) => setPosition(event.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="rnotes">Anotações internas</Label><Textarea id="rnotes" rows={3} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="rical">URL iCal do Airbnb/OTA</Label><Input id="rical" type="url" placeholder="https://www.airbnb.com/calendar/ical/..." value={icalUrl} onChange={(event) => setIcalUrl(event.target.value)} /><p className="text-xs text-muted-foreground">URL HTTPS salva no cadastro do quarto; o calendário pode ser gerenciado em iCal / OTAs.</p></div>
          </section>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckInDialog({ room, onClose, onSaved }: { room: Room | null; onClose: () => void; onSaved: () => void }) {
  const { data: config } = useSuspenseQuery(configOptions);
  const checkIn = useServerFn(registerCheckIn);
  const today = iso(new Date());
  const [f, setF] = useState({ guest_name: "", guest_document: "", guest_phone: "", guest_email: "", guests_count: "1", children: "0", petSmall: "0", petMedium: "0", petLarge: "0", check_out: iso(addDays(new Date(), 1)), paid: "", source: "Direto", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (room) setF((p) => ({ ...p, guest_name: "", guest_document: "", guest_phone: "", guest_email: "", guests_count: "1", children: "0", petSmall: "0", petMedium: "0", petLarge: "0", check_out: iso(addDays(new Date(), 1)), paid: "", notes: "" }));
  }, [room]);

  const guests = { adults: Number(f.guests_count), children: Number(f.children), petSmall: Number(f.petSmall), petMedium: Number(f.petMedium), petLarge: Number(f.petLarge) };
  let price: ReturnType<typeof calculateStay> | null = null;
  let priceError = "";
  if (room) {
    try {
      price = calculateStay(Number(room.daily_rate), today, f.check_out, guests, config.settings);
      if (guests.adults + guests.children > room.capacity) priceError = "A quantidade de hóspedes excede a capacidade do quarto.";
    } catch (e) { priceError = e instanceof Error ? e.message : "Confira as tarifas."; }
  }

  async function save() {
    if (!room) return;
    if (!f.guest_name.trim() || !f.guest_document.trim()) { toast.error("Informe nome e documento do hóspede."); return; }
    if (!price || priceError) { toast.error(priceError || "Confira o período."); return; }
    setSaving(true);
    try {
      const result = await checkIn({ data: { roomId: room.id, checkIn: today, checkOut: f.check_out, guestName: f.guest_name, guestDocument: f.guest_document, guestPhone: f.guest_phone, guestEmail: f.guest_email, guests, paid: parseMoney(f.paid), source: f.source, notes: f.notes } });
      toast.success(`Check-in de ${f.guest_name} em ${room.name}.`);
      if (!result.roomStatusUpdated) toast.warning("Check-in salvo; não foi possível atualizar a governança do quarto.");
      onClose(); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível registrar o check-in."); }
    finally { setSaving(false); }
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
              <Label htmlFor="gcount">Adultos</Label>
              <Input id="gcount" type="number" min={1} max={room?.capacity} value={f.guests_count} onChange={set("guests_count")} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="gout">Data de saída</Label>
              <Input id="gout" type="date" min={iso(addDays(new Date(), 1))} value={f.check_out} onChange={set("check_out")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="gchildren">Crianças</Label><Input id="gchildren" type="number" min={0} max={room?.capacity} step={1} value={f.children} onChange={set("children")} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([['petSmall', 'Pets pequenos'], ['petMedium', 'Pets médios'], ['petLarge', 'Pets grandes']] as const).map(([key, label]) => <div key={key} className="grid gap-1.5"><Label htmlFor={key}>{label}</Label><Input id={key} type="number" min={0} max={100} step={1} value={f[key]} onChange={set(key)} /></div>)}
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
            {priceError ? <p role="alert" className="text-destructive">{priceError}</p> : price && <div className="space-y-2"><div className="flex justify-between gap-3"><span>{price.nights} noite(s)</span><strong>{brl.format(price.total)}</strong></div>{price.days.map((day) => <div key={day.date} className="flex justify-between gap-3 text-xs"><span>{fmt(day.date)}{day.surcharge > 0 ? ` (+${day.surcharge.toLocaleString('pt-BR')}%)` : ''}</span><span>{brl.format(day.total)}</span></div>)}<div className="space-y-1 border-t pt-2 text-xs">{([['Adultos', 'adults'], ['Crianças', 'children'], ['Pets', 'pets']] as const).map(([label, key]) => <div key={key} className="flex justify-between"><span>{label}</span><span>{brl.format(price.days.reduce((sum, day) => sum + day[key], 0))}</span></div>)}</div></div>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !!priceError || !price}>
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
