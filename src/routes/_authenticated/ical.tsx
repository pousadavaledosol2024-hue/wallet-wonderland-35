import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Plus, RefreshCw, Upload, Link2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { configOptions } from "@/lib/admin-config";
import { getFeeds, saveFeed, updateFeed } from "@/lib/ical.functions";
import { supabase } from "@/integrations/supabase/client";
import { ConfigShell, configHead } from "@/components/config-shell";
import { CrudActions } from "@/components/crud-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
const feedsOptions = queryOptions({ queryKey: ["ical-feeds"], queryFn: () => getFeeds(), refetchInterval: 60_000 });
export const Route = createFileRoute("/_authenticated/ical")({ loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(configOptions), context.queryClient.ensureQueryData(feedsOptions)]); }, head: () => configHead("iCal / OTAs", "Gestão de calendários externos e bloqueios de disponibilidade por quarto."), component: IcalPage });
function IcalPage() {
  const { data: config } = useSuspenseQuery(configOptions); const { data: feeds } = useSuspenseQuery(feedsOptions); const qc = useQueryClient();
  const save = useServerFn(saveFeed), update = useServerFn(updateFeed);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [room, setRoom] = useState(""), [provider, setProvider] = useState("Airbnb"), [url, setUrl] = useState("");
  async function syncCalendar(id: string, content?: string) {
    const { data, error } = await supabase.functions.invoke("sync-ical", {
      body: { feedId: id, ...(content === undefined ? {} : { content }) },
    });
    if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
        const result = await response.clone().json().catch(() => null) as { message?: string } | null;
        if (result?.message) return { ok: false, count: 0, message: result.message };
      }
      throw Error("Não foi possível sincronizar o calendário pelo servidor.");
    }
    return data as { ok: boolean; count: number; message?: string };
  }
  async function run(id: string, action: () => Promise<unknown>) { setBusy(id); try { await action(); await qc.invalidateQueries({ queryKey: ["ical-feeds"] }); await qc.invalidateQueries({ queryKey: ["management"] }); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir."); } finally { setBusy(null); } }
  return <ConfigShell title="iCal / OTAs" action={config.role === "admin" && <Button onClick={() => { setEditingId(undefined); setRoom(""); setProvider("Airbnb"); setUrl(""); setOpen(true); }}><Plus className="h-4 w-4" /> Novo calendário</Button>}>
    <div className="flex flex-wrap gap-3"><Badge variant="outline">Importação iCal</Badge><Badge variant="outline">Exportação atualizada a cada reserva</Badge></div>
    {config.role !== "admin" ? <p className="text-muted-foreground">Acesso restrito a administradores.</p> : !feeds.length ? <div className="border-y py-16 text-center"><Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p>Nenhum calendário conectado.</p></div> : <div className="space-y-4">{feeds.map((feed) => <article key={feed.id} className="rounded-lg border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 w-full sm:w-auto sm:flex-1"><h3 className="font-semibold">{feed.provider} · {config.rooms.find((r) => r.id === feed.room_id)?.name}</h3><p className="mt-1 text-xs text-muted-foreground">{feed.last_synced_at ? `Última importação: ${new Date(feed.last_synced_at).toLocaleString("pt-BR")}` : "Ainda não importado"}</p></div><div className="flex flex-wrap items-center gap-2"><CrudActions name={`${feed.provider} · ${config.rooms.find(r => r.id === feed.room_id)?.name ?? "Quarto"}`} disabled={busy !== null} onEdit={() => { setEditingId(feed.id); setRoom(feed.room_id); setProvider(feed.provider); setUrl(feed.import_url); setOpen(true); }} deleteLabel="Excluir" description="O calendário será excluído e seus bloqueios ativos serão liberados. As reservas importadas permanecem no histórico, desvinculadas deste calendário." onDelete={async () => { setBusy(feed.id); try { await update({ data: { id: feed.id, remove: true } }); qc.setQueryData(feedsOptions.queryKey, (current) => current?.filter((item) => item.id !== feed.id)); await qc.invalidateQueries({ queryKey: ["ical-feeds"] }); await qc.invalidateQueries({ queryKey: ["management"] }); toast.success("Calendário excluído"); } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível excluir"); throw e; } finally { setBusy(null); } }} /><Switch aria-label={`Ativar ${feed.provider}`} checked={feed.active} disabled={busy !== null} onCheckedChange={(active) => void run(feed.id, () => update({ data: { id: feed.id, active } }))} /></div></div>
      {feed.last_error && <p role="alert" className="mt-3 text-sm text-destructive">{feed.last_error}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2"><div><Label>Link de importação</Label><Input readOnly value={feed.import_url} placeholder="Importação por arquivo .ics" className="mt-1" /></div><div><Label>Link de exportação</Label><div className="mt-1 flex gap-2"><Input readOnly aria-label={`Exportação ${feed.provider}`} value={typeof window === "undefined" ? "" : `${window.location.origin}/api/public/ical/${feed.export_token}`} /><Button variant="outline" size="icon" title="Copiar link" aria-label="Copiar link" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/api/public/ical/${feed.export_token}`).then(() => toast.success("Link copiado"), () => toast.error("Não foi possível copiar"))}><Copy className="h-4 w-4" /></Button></div></div></div>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" disabled={!feed.active || !feed.import_url || busy !== null} onClick={() => void run(feed.id, async () => { const result = await syncCalendar(feed.id); result.ok ? toast.success(`${result.count} bloqueios importados`) : toast.error(result.message); })}><RefreshCw className={`h-4 w-4 ${busy === feed.id ? "animate-spin" : ""}`} /> Sincronizar agora</Button><Label className="cursor-pointer"><span className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm"><Upload className="h-4 w-4" /> Importar .ics</span><input type="file" accept=".ics,text/calendar" className="sr-only" aria-label={`Importar arquivo ${feed.provider}`} disabled={busy !== null || !feed.active} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2000000) return void toast.error("Máximo de 2 MB."); void run(feed.id, async () => { const result = await syncCalendar(feed.id, await file.text()); result.ok ? toast.success(`${result.count} bloqueios importados`) : toast.error(result.message); }); e.target.value = ""; }} /></Label><Button variant="ghost" disabled={busy !== null} onClick={() => { if (window.confirm("Invalidar o link anterior de exportação?")) void run(feed.id, () => update({ data: { id: feed.id, rotate: true } })); }}><KeyRound className="h-4 w-4" /> Renovar link</Button></div>
    </article>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editingId ? "Editar calendário" : "Novo calendário"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run("new", async () => { await save({ data: { ...(editingId ? { id: editingId } : {}), room_id: room, provider, import_url: url } }); setOpen(false); setUrl(""); toast.success("Calendário salvo"); }); }}><div className="space-y-1"><Label htmlFor="feed-room">Quarto</Label><select id="feed-room" disabled={Boolean(editingId)} className="h-10 w-full rounded-md border bg-background px-3" required value={room} onChange={(e) => setRoom(e.target.value)}><option value="">Selecione</option>{config.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div><div className="space-y-1"><Label htmlFor="feed-provider">Provedor</Label><Input id="feed-provider" required maxLength={100} value={provider} onChange={(e) => setProvider(e.target.value)} list="providers" /><datalist id="providers"><option>Airbnb</option><option>Booking.com</option><option>TripLar</option><option>Outro</option></datalist></div><div className="space-y-1"><Label htmlFor="feed-url">URL de importação (opcional)</Label><Input id="feed-url" type="url" maxLength={2000} value={url} onChange={(e) => setUrl(e.target.value)} /></div><Button type="submit" disabled={busy !== null}>Salvar calendário</Button></form></DialogContent></Dialog>
  </ConfigShell>;
}
