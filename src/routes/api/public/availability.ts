import { createFileRoute } from '@tanstack/react-router';
import { respond, preflight, period, snapshot } from '@/lib/public-api/http.server';
export const Route = createFileRoute('/api/public/availability')({ server: { handlers: {
  OPTIONS: ({ request }) => preflight(request),
  GET: ({ request }) => respond(request, async () => { const { from, to } = period(request); return { blocks: (await snapshot(from, to)).blocks, check_in: from, check_out: to }; }),
} } });
