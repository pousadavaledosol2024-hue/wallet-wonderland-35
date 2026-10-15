import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Save, Upload, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { configOptions, siteFields, settingsSchema } from "@/lib/admin-config";
import { saveSettings } from "@/lib/admin-config.functions";
import { percentageKeys, withPricingDefaults } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";
import { ConfigShell, configHead } from "@/components/config-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
export const Route = createFileRoute("/_authenticated/site-galeria")({ loader: ({ context }) => context.queryClient.ensureQueryData(configOptions), head: () => configHead("Site & Galeria", "Identidade, contatos, localização, tarifas, políticas e imagens da pousada."), component: SitePage });
function SitePage() {
  const { data: config } = useSuspenseQuery(configOptions); const qc = useQueryClient(); const save = useServerFn(saveSettings);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(withPricingDefaults(config.settings)).map(([key, value]) => [key, percentageKeys.has(key) ? value.replace(".", ",") : value]))); const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [mediaError, setMediaError] = useState("");
  async function loadMedia() {
    const { data, error } = await supabase.storage.from("site-gallery").list(config.accountId, { limit: 100 });
    if (error) { setMediaError("Não foi possível carregar as imagens."); return; }
    const loaded = await Promise.all((data ?? []).filter((f) => f.id).map(async (f) => { const { data: link } = await supabase.storage.from("site-gallery").createSignedUrl(`${config.accountId}/${f.name}`, 3600); return { name: f.name, url: link?.signedUrl ?? "" }; })); setImages(loaded); setMediaError("");
  }
  useEffect(() => { void loadMedia(); }, [config.accountId]);
  async function upload(file: File, kind: string) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return void toast.error("Use JPG, PNG ou WebP com até 5 MB.");
    setBusy(true); try { const name = `${kind}-${crypto.randomUUID()}.${file.type.split('/')[1]}`; const { error } = await supabase.storage.from("site-gallery").upload(`${config.accountId}/${name}`, file); if (error) throw Error("Não foi possível enviar a foto."); await loadMedia(); toast.success("Imagem enviada"); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao enviar"); } finally { setBusy(false); }
  }
  async function submit() { const parsed = settingsSchema.safeParse(draft); if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Confira os campos"); setBusy(true); try { await save({ data: parsed.data }); await qc.invalidateQueries({ queryKey: ["admin-config"] }); toast.success("Configurações salvas"); } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar"); } finally { setBusy(false); } }
  const admin = config.role === "admin";
  return <ConfigShell title="Site & Galeria" action={admin && <Button disabled={busy} onClick={() => void submit()}><Save className="h-4 w-4" /> {busy ? "Salvando…" : "Salvar alterações"}</Button>}>
    <Tabs defaultValue="config"><TabsList><TabsTrigger value="config">Configurações</TabsTrigger><TabsTrigger value="gallery">Galeria</TabsTrigger></TabsList><TabsContent value="config" className="mt-6 space-y-8"><form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-8"><fieldset disabled={!admin || busy} className="space-y-8">{siteFields.map((section) => <section key={section.title} className="space-y-4 border-b pb-6"><h3 className="text-lg font-semibold">{section.title}</h3><div className="grid gap-4 md:grid-cols-2">{section.fields.map((field) => { const key = field[0], label = field[1], type: string = field[2] ?? "text"; return <div key={key} className={`space-y-1.5 ${type === "textarea" ? "md:col-span-2" : ""}`}><Label htmlFor={key}>{label}</Label>{type === "textarea" ? <Textarea id={key} rows={key === "description" || key === "cancellation" ? 4 : 3} maxLength={12000} value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /> : <Input id={key} type={type} step="any" maxLength={1000} value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />}</div>; })}</div></section>)}</fieldset>{admin && <Button type="submit" disabled={busy}><Save className="h-4 w-4" /> Salvar alterações</Button>}</form></TabsContent>
    <TabsContent value="gallery" className="mt-6 space-y-6"><div className="flex flex-wrap gap-3">{["logo", "capa", "galeria"].map((kind) => <Label key={kind} className="cursor-pointer"><span className="inline-flex h-10 items-center gap-2 rounded-md border bg-card px-4 text-sm"><Upload className="h-4 w-4" /> {kind === "logo" ? "Enviar logomarca" : kind === "capa" ? "Enviar capa" : "Adicionar fotos"}</span><input aria-label={`Enviar ${kind}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy || !admin} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file, kind); e.target.value = ""; }} /></Label>)}</div>{mediaError && <p role="alert" className="text-destructive">{mediaError}</p>}{images.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{images.map((image) => <article key={image.name} className="overflow-hidden rounded-lg border bg-card"><img src={image.url} alt={image.name.startsWith('logo') ? 'Logomarca enviada' : 'Imagem da pousada'} className="aspect-[4/3] w-full object-cover" /><div className="flex items-center justify-between gap-2 p-2"><span className="truncate text-xs">{image.name.split('-')[0]}</span>{admin && <Button variant="ghost" size="icon" aria-label="Excluir imagem" disabled={busy} onClick={async () => { if (!window.confirm("Excluir esta imagem?")) return; const { error } = await supabase.storage.from("site-gallery").remove([`${config.accountId}/${image.name}`]); error ? toast.error("Não foi possível excluir") : await loadMedia(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></article>)}</div> : <div className="border-y py-16 text-center"><ImageIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p>Nenhuma imagem enviada.</p></div>}</TabsContent></Tabs>
  </ConfigShell>;
}