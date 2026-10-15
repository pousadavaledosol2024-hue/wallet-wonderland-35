import { z } from "zod";
import { queryOptions } from "@tanstack/react-query";
import { getAdminConfig } from "@/lib/admin-config.functions";
import { decimalNumber, percentageKeys } from "@/lib/pricing";

export const siteFields = [
  { title: "Identidade", fields: [["name", "Nome da pousada"], ["slogan", "Slogan"], ["description", "Descrição completa", "textarea"], ["logo_url", "URL da logomarca", "url"], ["cover_url", "URL da foto de capa", "url"]] },
  { title: "Contato e pagamento", fields: [["email", "E-mail", "email"], ["phone", "Telefone"], ["whatsapp", "WhatsApp com DDI"], ["pix_type", "Tipo da chave PIX"], ["pix_key", "Chave PIX"]] },
  { title: "Localização e horários", fields: [["address", "Endereço"], ["latitude", "Latitude", "number"], ["longitude", "Longitude", "number"], ["checkin_time", "Horário de check-in", "time"], ["checkout_time", "Horário de check-out", "time"]] },
  { title: "Redes sociais e OTAs", fields: [["instagram", "Instagram", "url"], ["facebook", "Facebook", "url"], ["airbnb", "Airbnb", "url"], ["booking", "Booking.com", "url"], ["triplar", "TripLar", "url"]] },
  { title: "Tarifas e políticas", fields: [["holidays", "Feriados (AAAA-MM-DD, um por linha)", "textarea"], ["weekend_percent", "Acréscimo de fim de semana (%)", "number"], ["holiday_percent", "Acréscimo de feriado (%)", "number"], ["extra_adult_discount", "Desconto por adulto extra (%)", "number"], ["child_rate", "Diária criança (%)", "number"], ["pet_small", "Pet pequeno (%)", "number"], ["pet_medium", "Pet médio (%)", "number"], ["pet_large", "Pet grande (%)", "number"], ["cancellation", "Política de cancelamento", "textarea"]] },
] as const;
const allowedKeys = new Set<string>(siteFields.flatMap((s) => s.fields.map((f) => f[0])));
export const settingsSchema = z.record(z.string().max(12000)).superRefine((values, ctx) => {
  for (const [key, value] of Object.entries(values)) {
    if (!allowedKeys.has(key)) ctx.addIssue({ code: "custom", message: "Campo inválido" });
    if (!value) continue;
    if (["logo_url", "cover_url", "instagram", "facebook", "airbnb", "booking", "triplar"].includes(key)) { try { if (new URL(value).protocol !== "https:") throw Error(); } catch { ctx.addIssue({ code: "custom", message: "Use um endereço HTTPS válido." }); } }
    if (percentageKeys.has(key) || ["latitude", "longitude"].includes(key)) { const n = decimalNumber(value); if (!Number.isFinite(n) || (key === "latitude" ? Math.abs(n) > 90 : key === "longitude" ? Math.abs(n) > 180 : n < 0 || n > 100)) ctx.addIssue({ code: "custom", path: [key], message: "Valor numérico fora do limite." }); }
    if (key === "email" && !z.string().email().safeParse(value).success) ctx.addIssue({ code: "custom", message: "E-mail inválido." });
    if (key === "whatsapp" && !/^\+?\d{10,15}$/.test(value)) ctx.addIssue({ code: "custom", message: "WhatsApp deve conter DDI e somente números." });
    if (key === "holidays" && value.split("\n").some((d) => d.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(d.trim()))) ctx.addIssue({ code: "custom", message: "Informe feriados no formato AAAA-MM-DD." });
  }
}).transform((values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, percentageKeys.has(key) && value.trim() ? String(decimalNumber(value)) : value])));
export const configOptions = queryOptions({ queryKey: ["admin-config"], queryFn: () => getAdminConfig(), staleTime: 15000 });
export const tags = ["nome", "quarto", "checkin", "checkout", "valor", "chave_pix", "pix_copia_cola", "checkin_time", "checkout_time", "endereco", "whatsapp"];
export const defaultTemplates = [
  { title: "Confirmação com PIX", message: "Olá, {nome}! Sua reserva no {quarto}, de {checkin} a {checkout}, está confirmada. Valor: {valor}. Chave PIX: {chave_pix}. Até breve!" },
  { title: "Lembrete de check-in", message: "Olá, {nome}! Esperamos você no dia {checkin}, a partir das {checkin_time}. Endereço: {endereco}. Contato: {whatsapp}." },
  { title: "Instruções de chegada", message: "Olá, {nome}! Estamos em {endereco}. Seu quarto é {quarto}. Se precisar de ajuda na chegada, fale conosco: {whatsapp}." },
  { title: "Lembrete de check-out", message: "Olá, {nome}! Seu check-out está previsto para {checkout}, até {checkout_time}. Esperamos que tenha aproveitado a estadia!" },
  { title: "Verificação de satisfação", message: "Olá, {nome}! Como está sua estadia no {quarto}? Podemos ajudar em algo?" },
  { title: "Agradecimento e avaliação", message: "Obrigado pela visita, {nome}! Foi um prazer receber você. Conte-nos como foi sua experiência." },
  { title: "Aniversário", message: "Feliz aniversário, {nome}! A equipe da Pousada Vale do Sol deseja um dia especial!" },
  { title: "Oferta de retorno", message: "Olá, {nome}! Que tal voltar à Pousada Vale do Sol? Consulte nossas datas e condições para reserva direta: {whatsapp}." },
];
export function renderTemplate(message: string, values: Record<string, string>) { return message.replace(/\{([^{}]+)\}/g, (match, key: string) => values[key] || match); }