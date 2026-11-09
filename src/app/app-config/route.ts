// ─── GET /app-config: settings the browser needs, read from the server's env at request time ───
// NEXT_PUBLIC_* values are inlined at build time; these are not, so one built image serves any environment.
//   REALTIME_URL — public Socket.IO origin of the backend (falls back to NEXT_PUBLIC_REALTIME_URL, then localhost).
//   DEV_MODE     — 'true' allows the "calculation check mode" toggle (docs/dev-mode/README.md); anything else hides it.
export const dynamic = 'force-dynamic';

/** Shape read by src/features/cloud/realtime/connection.ts (loadRealtimeUrl) and src/features/dev-mode/config.ts. */
export function GET(): Response {
    const realtimeUrl = (process.env.REALTIME_URL ?? process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
    const devMode = process.env.DEV_MODE?.trim().toLowerCase() === 'true';
    return Response.json({ realtimeUrl, devMode }, { headers: { 'cache-control': 'no-store' } });
}
