// ─── /api/* → the backend (NestJS), read at request time ───
// The browser only ever talks to this origin, so the httpOnly refresh cookie stays same-origin. The backend address is
// the server-side env API_URL, read on every request: one built image works against any backend (a next.config
// rewrite would bake the address in at build time). Socket.IO does not come through here (NEXT_PUBLIC_REALTIME_URL /
// REALTIME_URL, see ../../app-config/route.ts).
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Hop-by-hop and length headers: set again by each side, never copied. */
const HOP = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding',
    'upgrade', 'host', 'content-length',
]);

function backend(): string {
    return (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
    const { path } = await ctx.params;
    const target = `${backend()}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

    const headers = new Headers();
    req.headers.forEach((value, key) => {
        if (!HOP.has(key)) headers.set(key, value);
    });
    // The backend's per-IP limits read X-Forwarded-For (its TRUST_PROXY must list this server's address).
    if (!headers.has('x-forwarded-host')) headers.set('x-forwarded-host', req.headers.get('host') ?? '');
    if (!headers.has('x-forwarded-proto')) headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    let res: Response;
    try {
        res = await fetch(target, {
            method: req.method,
            headers,
            body: hasBody ? await req.arrayBuffer() : undefined,
            redirect: 'manual',
            cache: 'no-store',
        });
    } catch {
        return Response.json({ code: 'internal', message: 'The API cannot be reached' }, { status: 502 });
    }

    const out = new Headers();
    res.headers.forEach((value, key) => {
        // fetch already decoded the body: its encoding and length no longer apply.
        if (!HOP.has(key) && key !== 'content-encoding' && key !== 'set-cookie') out.set(key, value);
    });
    for (const cookie of res.headers.getSetCookie()) out.append('set-cookie', cookie);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD, proxy as OPTIONS };
