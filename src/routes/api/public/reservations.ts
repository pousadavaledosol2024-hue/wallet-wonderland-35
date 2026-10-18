import { createFileRoute } from '@tanstack/react-router';
import { bookingSchema } from '@/lib/public-api/contract';
import { ApiError, respond, preflight, readBody, verifyQuote } from '@/lib/public-api/http.server';
export const Route = createFileRoute('/api/public/reservations')({ server: { handlers: {
  OPTIONS: ({ request }) => preflight(request),
  POST: ({ request }) => respond(request, async () => {
    const body = bookingSchema.parse(await readBody(request));
    const quote = await verifyQuote(body.quote_token);
    // A valid HMAC quote authorizes only this exact stay, price and account.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const g = quote.stay.guests;
    const { error } = await supabaseAdmin.rpc('create_public_pre_reservation', {
      _id: quote.id, _room: quote.stay.room_id, _from: quote.stay.check_in, _to: quote.stay.check_out,
      _guests: g.adults + g.children, _name: body.guest_name, _phone: body.guest_phone, _email: body.guest_email,
      _notes: [body.notes, `${g.adults} adulto(s), ${g.children} criança(s); pets: ${g.petSmall} pequeno(s), ${g.petMedium} médio(s), ${g.petLarge} grande(s).`].filter(Boolean).join('\n'),
      _total: quote.total, _revision: quote.revision,
    });
    if (error) {
      if (error.code === '23P01') throw new ApiError(409, 'Datas indisponíveis. Consulte novamente.');
      if (error.code === '40001') throw new ApiError(409, 'As tarifas mudaram. Consulte novamente.');
      if (error.code === '22023') throw new ApiError(400, 'Pré-reserva inválida.');
      throw new ApiError(503, 'Não foi possível salvar. Tente novamente com a mesma cotação.');
    }
    // Never echo contact information, internal reservation ids or payment data.
    return { accepted: true, status: 'pre_reserva' };
  }, 201),
} } });
