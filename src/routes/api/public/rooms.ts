import { createFileRoute } from '@tanstack/react-router';
import { respond, preflight, period, snapshot } from '@/lib/public-api/http.server';
export const Route = createFileRoute('/api/public/rooms')({ server: { handlers: {
  OPTIONS: ({ request }) => preflight(request),
  GET: ({ request }) => respond(request, async () => {
    const { from, to } = period(request); const data = await snapshot(from, to);
    return { rooms: data.rooms.map(({ revision, ...room }) => ({ ...room, available: room.bookable && !data.blocks.some(b => b.room_id === room.id && b.check_in < to && b.check_out > from) })), currency: 'BRL' };
  }),
} } });
