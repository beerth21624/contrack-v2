// Manual realtime check against a running API (not part of any test suite):
//   node test/manual/two-users.mjs setup <user1Password>      → company workspace, second member, project
//   node test/manual/two-users.mjs join <projectId> <levelId>  → second member joins, sits on a level, edits meta
// Uses only test accounts on a local API (PERSISTENCE=memory).
import { io } from 'socket.io-client';

const API = process.env.API ?? 'http://localhost:4000';
const USER2 = { email: 'tester2@example.test', password: 'Ct-e2e-second-4w8p', displayName: 'ช่างไฟ ทดสอบ' };

async function call(method, path, body, token) {
    const res = await fetch(API + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text === '' ? null : JSON.parse(text) };
}

async function login(email, password) {
    const r = await call('POST', '/auth/login', { email, password });
    if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.accessToken;
}

const [, , mode, a, b] = process.argv;

if (mode === 'setup') {
    const t1 = await login('tester1@example.test', a);
    const ws = await call('POST', '/workspaces', { name: 'บริษัททดสอบ จำกัด' }, t1);
    console.log('company workspace', ws.status);
    const reg = await call('POST', '/auth/register', USER2);
    console.log('register user2', reg.status);
    const inv = await call('POST', `/workspaces/${ws.body.id}/invitations`, { email: USER2.email, role: 'estimator' }, t1);
    console.log('invite', inv.status);
    const t2 = await login(USER2.email, USER2.password);
    const acc = await call('POST', '/invitations/accept', { token: inv.body.token }, t2);
    console.log('accept', acc.status, acc.body?.role);
    const p = await call('POST', `/workspaces/${ws.body.id}/projects`, { name: 'บ้านทีมทดสอบ', start: 'sample' }, t1);
    console.log('project', p.status, p.body?.project?.id);
} else if (mode === 'join') {
    const t2 = await login(USER2.email, USER2.password);
    const socket = io(`${API}/realtime`, { auth: { token: t2 }, transports: ['websocket'] });
    socket.on('connect_error', e => console.log('connect_error', e.message));
    socket.on('presence.state', e => console.log('presence', e.users.map(u => `${u.displayName}@${u.levelId}`).join(', ')));
    socket.on('doc.updated', e => console.log('doc.updated', e.doc.docKey, 'v' + e.doc.version, 'by', e.doc.updatedBy));
    socket.on('connect', () => {
        socket.emit('project.join', { projectId: a }, ack => {
            console.log('join', JSON.stringify(ack));
            socket.emit('presence.update', { projectId: a, levelId: b }, ack2 => console.log('presence.update', JSON.stringify(ack2)));
        });
    });
    // After 8 s the second member edits the project header; the browser should show it without reloading.
    setTimeout(async () => {
        const d = await call('GET', `/projects/${a}`, undefined, t2);
        const meta = d.body.docs.find(x => x.docKey === 'meta');
        const put = await call('PUT', `/projects/${a}/docs/meta`, {
            data: { ...(meta?.data ?? {}), ownerName: 'คุณสมศรี (แก้จากอีกเครื่อง)' }, baseVersion: meta?.version ?? 0,
        }, t2);
        console.log('user2 PUT meta', put.status, 'v' + put.body?.doc?.version);
    }, 8000);
    const beat = setInterval(() => socket.emit('presence.update', { projectId: a, levelId: b }, () => {}), 15000);
    setTimeout(() => { clearInterval(beat); socket.close(); console.log('done'); process.exit(0); }, 90000);
}
