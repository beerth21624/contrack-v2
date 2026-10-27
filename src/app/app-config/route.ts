// ─── GET /app-config: settings the browser needs, read from the server's env at request time ───
// NEXT_PUBLIC_* values are inlined at build time; these are not, so one built image serves any environment.
//   REALTIME_URL — public Socket.IO origin of the backend (falls back to NEXT_PUBLIC_REALTIME_URL, then localhost).
export const dynamic = 'force-dynamic';

/** Shape read by src/features/cloud/realtime/connection.ts (loadRealtimeUrl). */
export function GET(): Response {
    const realtimeUrl = (process.env.REALTIME_URL ?? process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
    return Response.json({ realtimeUrl }, { headers: { 'cache-control': 'no-store' } });
}
