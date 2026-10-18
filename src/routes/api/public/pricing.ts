import { createFileRoute } from '@tanstack/react-router';
import { staySchema, quoteStay } from '@/lib/public-api/contract';
import { ApiError, respond, preflight, readBody, snapshot, today, signQuote } from '@/lib/public-api/http.server';
export const Route = createFileRoute('/api/public/pricing')({ server: { handlers: {
  OPTIONS: ({ request }) => preflight(request),
  POST: ({ request }) => respond(request, async () => {
    const stay = staySchema.parse(await readBody(request)); const data = await snapshot(stay.check_in, stay.check_out);
    let result;
    try { result = quoteStay(stay, data, today()); } catch (e) { throw new ApiError(409, e instanceof Error ? e.message : 'Datas indisponíveis.'); }
    const expires = Date.now() + 15 * 60 * 1000;
    const quote_token = await signQuote({ id: crypto.randomUUID(), stay, total: result.price.total, revision: result.room.revision, expires });
    return { ...result.price, currency: 'BRL', quote_token, expires_at: new Date(expires).toISOString() };
  }),
} } });
