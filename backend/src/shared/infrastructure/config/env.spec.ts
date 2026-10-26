import express from 'express';
import request from 'supertest';
import { type TrustProxy, loadEnv, testEnv } from './env';

const BASE = { NODE_ENV: 'test', PERSISTENCE: 'memory', JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123' };

/** What Express makes of X-Forwarded-For from a supertest client (which connects from loopback). */
async function ipSeen(trust: TrustProxy, forwardedFor: string): Promise<string> {
    const app = express();
    app.set('trust proxy', trust);
    app.get('/', (req, res) => {
        res.json({ ip: req.ip });
    });
    const res = await request(app).get('/').set('X-Forwarded-For', forwardedFor);
    return (res.body as { ip: string }).ip;
}

describe('env TRUST_PROXY', () => {
    it('defaults to loopback (only the local Next server)', () => {
        expect(testEnv().TRUST_PROXY).toEqual(['loopback']);
    });

    it.each<[string, TrustProxy]>([
        ['false', false],
        ['1', 1],
        ['loopback, 10.0.0.0/8 ,192.168.1.10', ['loopback', '10.0.0.0/8', '192.168.1.10']],
        ['uniquelocal,fd00::/8,::1', ['uniquelocal', 'fd00::/8', '::1']],
    ])('accepts %s', (raw, parsed) => {
        expect(loadEnv({ ...BASE, TRUST_PROXY: raw }).TRUST_PROXY).toEqual(parsed);
    });

    it.each(['true', 'everyone', '10.0.0.0/33', '10.0.0.1/8/1', ' , ', 'loopback,300.1.1.1'])('refuses %s', raw => {
        expect(() => loadEnv({ ...BASE, TRUST_PROXY: raw })).toThrow(/TRUST_PROXY/);
    });

    it('believes X-Forwarded-For from loopback by default, and not when the proxy is not listed', async () => {
        expect(await ipSeen(testEnv().TRUST_PROXY, '203.0.113.7')).toBe('203.0.113.7');
        const elsewhere = loadEnv({ ...BASE, TRUST_PROXY: '10.0.0.0/8' }).TRUST_PROXY;
        expect(await ipSeen(elsewhere, '203.0.113.7')).not.toBe('203.0.113.7');
        expect(await ipSeen(false, '203.0.113.7')).not.toBe('203.0.113.7');
    });
});
