import { createFileRoute } from '@tanstack/react-router';
import { publicSettings } from '@/lib/public-api/contract';
import { respond, preflight, period, snapshot } from '@/lib/public-api/http.server';
export const Route = createFileRoute('/api/public/settings')({ server: { handlers: {
  OPTIONS: ({ request }) => preflight(request),
  GET: ({ request }) => respond(request, async () => { const { from, to } = period(request); return { settings: publicSettings((await snapshot(from, to)).settings), currency: 'BRL' }; }),
} } });
