import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Save, Upload, ImageIcon, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { configOptions, siteFields, settingsSchema, fieldHelp, imageUrlSchema, readGalleryUrls } from "@/lib/admin-config";
import { saveSettings, updateGalleryUrl } from "@/lib/admin-config.functions";
import { percentageKeys, withPricingDefaults } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";
import { ConfigShell, configHead } from "@/components/config-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
export const Route = createFileRoute("/_authenticated/site-galeria")({ loader: ({ context }) => context.queryClient.ensureQueryData(configOptions), head: () => configHead("Site & Galeria", "Identidade, contatos, tarifas, políticas e fotos da Pousada Vale do Sol."), component: SitePage });
function SitePage() {
  const { data: config } = useSuspenseQuery(configOptions);
  const qc = useQueryClient(); const save = useServerFn(saveSettings); const updateUrl = useServerFn(updateGalleryUrl);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(siteFields.flatMap(s => s.fields.map(f => { const value = withPricingDefaults(config.settings)[f[0]] ?? ""; return [f[0], percentageKeys.has(f[0]) ? value.replace(".", ",") : value]; }))));
  const [busy, setBusy] = useState(false); const [tab, setTab] = useState("config");
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [mediaError, setMediaError] = useState(""); const [url, setUrl] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null); const [kind, setKind] = useState("galeria");
  const admin = config.role === "admin";
  const urls = readGalleryUrls(config.settings);
  async function loadMedia() {
    const { data, error } = await supabase.storage.from("site-gallery").list(config.accountId, { limit: 100 });
    if (error) { setMediaError("Não foi possível carregar as imagens."); return; }
    const loaded = await Promise.all((data ?? []).filter(f => f.id).map(async f => { const { data: link } = await supabase.storage.from("site-gallery").createSignedUrl(`${config.accountId}/${f.name}`, 3600); return { name: f.name, url: link?.signedUrl ?? "" }; }));
    setImages(loaded); setMediaError("");
  }
  useEffect(() => { void loadMedia(); }, [config.accountId]);
  async function upload(files: File[]) {
    if (files.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) return void toast.error("Use JPG, PNG ou WebP com até 5 MB por foto.");
    setBusy(true);
    try {
      for (const file of files) { const name = `${kind}-${crypto.randomUUID()}.${file.type.split('/')[1]}`; const { error } = await supabase.storage.from("site-gallery").upload(`${config.accountId}/${name}`, file); if (error) throw Error("Não foi possível enviar a foto."); }
      await loadMedia(); toast.success("Imagens enviadas");
    } catch (e) { await loadMedia(); toast.error(e instanceof Error ? e.message : "Erro ao enviar"); } finally { setBusy(false); }
  }
  async function changeUrl(value: string, action: "add" | "remove") {
    const parsed = imageUrlSchema.safeParse(value); if (!parsed.success) return void toast.error("Use uma URL HTTPS de imagem válida.");
    setBusy(true); try { await updateUrl({ data: { url: parsed.data, action } }); await qc.invalidateQueries({ queryKey: configOptions.queryKey }); if (action === "add") setUrl(""); toast.success(action === "add" ? "Foto adicionada" : "Foto excluída"); } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível atualizar"); } finally { setBusy(false); }
  }
  async function submit() {
    const parsed = settingsSchema.safeParse(draft); if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Confira os campos");
    setBusy(true); try { await save({ data: parsed.data }); await qc.invalidateQueries({ queryKey: configOptions.queryKey }); toast.success("Configurações salvas"); } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar"); } finally { setBusy(false); }
  }
  return <ConfigShell title="Site & Galeria" action={admin && tab === "config" && <Button disabled={busy} onClick={() => void submit()}><Save className="h-4 w-4" />{busy ? "Salvando…" : "Salvar alterações"}</Button>}>
    <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="config">Configurações</TabsTrigger><TabsTrigger value="gallery">Galeria</TabsTrigger></TabsList>
      <TabsContent value="config" className="mt-6"><form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-8"><fieldset disabled={!admin || busy} className="space-y-8">{siteFields.map(section => <section key={section.title} className="space-y-4 border-b pb-6"><h3 className="text-xl font-semibold">{section.title}</h3><div className="grid gap-5 md:grid-cols-2">{section.fields.map(field => { const key = field[0], label = field[1], type: string = field[2] ?? "text"; const help = fieldHelp[key]; return <div key={key} className={`min-w-0 space-y-2 ${type === "textarea" ? "md:col-span-2" : ""}`}><Label htmlFor={key} className="leading-5">{label}</Label>{type === "textarea" ? <Textarea id={key} aria-describedby={help ? `${key}-help` : undefined} rows={4} maxLength={12000} value={draft[key] ?? ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /> : <Input id={key} aria-describedby={help ? `${key}-help` : undefined} type={percentageKeys.has(key) ? "text" : type} inputMode={percentageKeys.has(key) ? "decimal" : undefined} placeholder={key === "whatsapp_webhook" ? "https://api.callmebot.com/whatsapp.php..." : undefined} step="any" maxLength={1000} value={draft[key] ?? ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}{help && <p id={`${key}-help`} className="text-xs leading-5 text-muted-foreground">{help}</p>}</div>; })}</div></section>)}</fieldset>{admin && <Button type="submit" disabled={busy}><Save className="h-4 w-4" />Salvar alterações</Button>}</form></TabsContent>
      <TabsContent value="gallery" className="mt-6 space-y-6">
        <section className="space-y-4 border-b pb-6"><h3 className="text-xl font-semibold">Fotos do carrossel</h3><p className="text-sm leading-6 text-muted-foreground">O hero do site rotaciona automaticamente entre estas fotos (6s, ordem aleatória) com indicadores clicáveis.</p>
          <div className="flex flex-wrap gap-3">{["logo", "capa", "galeria"].map(k => <Button key={k} variant="outline" disabled={busy || !admin} onClick={() => { setKind(k); if (uploadRef.current) { uploadRef.current.multiple = k === "galeria"; uploadRef.current.click(); } }}><Upload className="h-4 w-4" />{k === "logo" ? "Enviar logomarca" : k === "capa" ? "Enviar capa" : "Adicionar fotos"}</Button>)}</div>
          <input ref={uploadRef} aria-label="Enviar imagens" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy || !admin} onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) void upload(files); e.target.value = ""; }} />
          <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · até 5 MB por foto</p>
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); void changeUrl(url, "add"); }}><Label htmlFor="gallery-url">URL da imagem</Label><div className="flex flex-wrap gap-2"><Input id="gallery-url" type="url" placeholder="https://exemplo.com/foto.jpg" value={url} onChange={e => setUrl(e.target.value)} disabled={busy || !admin} className="min-w-0 flex-1 basis-56" /><Button type="submit" disabled={busy || !admin || !url.trim()}><Link2 className="h-4 w-4" />Adicionar URL</Button></div></form>
        </section>
        {mediaError && <p role="alert" className="text-destructive">{mediaError}</p>}
        {images.length + urls.length > 0 ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[...images.map(image => ({ ...image, external: false })), ...urls.map(url => ({ name: url, url, external: true }))].map(image => <article key={image.name} className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-card"><img src={image.url} alt={image.name.startsWith('logo') ? 'Logomarca enviada' : 'Foto da pousada'} className="aspect-[4/3] w-full object-cover" onError={e => { e.currentTarget.alt = "Imagem indisponível"; }} /><div className="flex items-center justify-between gap-2 p-2"><span className="truncate text-xs">{image.external ? "Foto por URL" : image.name.split('-')[0]}</span>{admin && <Button variant="ghost" size="icon" title="Excluir imagem" aria-label="Excluir imagem" disabled={busy} onClick={async () => { if (!window.confirm("Excluir esta imagem?")) return; if (image.external) return void changeUrl(image.url, "remove"); setBusy(true); try { const { error } = await supabase.storage.from("site-gallery").remove([`${config.accountId}/${image.name}`]); if (error) throw Error("Não foi possível excluir"); await loadMedia(); toast.success("Foto excluída"); } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível excluir"); } finally { setBusy(false); } }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></article>)}</div> : <div className="border-y py-16 text-center"><ImageIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p>Nenhuma imagem enviada.</p></div>}
      </TabsContent>
    </Tabs>
  </ConfigShell>;
}
