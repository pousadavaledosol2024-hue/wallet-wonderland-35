import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { allowedOrigins, dateSchema, tokenSchema, type Quote, type Snapshot } from './contract';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function headers(request: Request) {
  const h = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins.has(origin)) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    h.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  return h;
}
export function preflight(request: Request) {
  const origin = request.headers.get('origin');
  return new Response(null, { status: origin && allowedOrigins.has(origin) ? 204 : 403, headers: headers(request) });
}
export async function respond(request: Request, action: () => Promise<unknown>, status = 200) {
  try {
    const origin = request.headers.get('origin');
    if (origin && !allowedOrigins.has(origin)) throw new ApiError(403, 'Origem não permitida.');
    return Response.json(await action(), { status, headers: headers(request) });
  } catch (e) {
    const code = e instanceof ApiError ? e.status : e instanceof z.ZodError ? 400 : 503;
    const message = e instanceof ApiError ? e.message : code === 400 ? 'Dados inválidos.' : 'Serviço temporariamente indisponível.';
    return Response.json({ error: message }, { status: code, headers: headers(request) });
  }
}
export async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'Envie JSON.');
  if (Number(request.headers.get('content-length')) > 16000) throw new ApiError(413, 'Pedido muito grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Dados inválidos.');
  let text = '', size = 0; const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 16000) { await reader.cancel(); throw new ApiError(413, 'Pedido muito grande.'); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { return JSON.parse(text); } catch { throw new ApiError(400, 'JSON inválido.'); }
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function period(request: Request) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) if (!['check_in', 'check_out'].includes(key)) throw new ApiError(400, 'Parâmetro inválido.');
  const from = dateSchema.parse(params.get('check_in') ?? today());
  const to = dateSchema.parse(params.get('check_out') ?? new Date(Date.parse(from) + 366 * 86400000).toISOString().slice(0, 10));
  const nights = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (nights < 1 || nights > 366) throw new ApiError(400, 'Período inválido.');
  return { from, to };
}
export async function snapshot(from: string, to: string): Promise<Snapshot> {
  const url = process.env['SUPABASE_URL'], key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new ApiError(503, 'Serviço indisponível.');
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization');
      h.set('apikey', key); return fetch(input, { ...init, headers: h });
    } },
  });
  const { data, error } = await client.rpc('public_site_snapshot', { _from: from, _to: to });
  if (error || !data) throw new ApiError(503, 'Não foi possível consultar a pousada.');
  return data as unknown as Snapshot;
}
function encode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decode(value: string) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
async function signingKey() {
  const secret = process.env['PUBLIC_BOOKING_SIGNING_SECRET'];
  if (!secret) throw new ApiError(503, 'Serviço indisponível.');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign','verify']);
}
export async function signQuote(quote: Quote) {
  const body = encode(new TextEncoder().encode(JSON.stringify(quote)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(body));
  return `${body}.${encode(new Uint8Array(signature))}`;
}
export async function verifyQuote(token: string): Promise<Quote> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw Error();
    const valid = await crypto.subtle.verify('HMAC', await signingKey(), decode(parts[1]), new TextEncoder().encode(parts[0]));
    if (!valid) throw Error();
    const quote = tokenSchema.parse(JSON.parse(new TextDecoder().decode(decode(parts[0]))));
    if (quote.expires < Date.now()) throw Error();
    return quote;
  } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(401, 'Cotação inválida ou expirada. Consulte novamente.'); }
}
