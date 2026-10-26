import { JwtService } from '@nestjs/jwt';
import { asUserId } from '../../../../shared/domain/ids';
import { FixedClock } from '../../../../shared/infrastructure/system';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER, JwtAccessTokenService } from './jwt-access-token.service';

const SECRET = 'test-secret-test-secret-test-secret-123';
const USER = asUserId('00000000-0000-4000-8000-000000000001');

function setup(secret = SECRET, ttlSeconds = 900) {
    const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));
    return { clock, service: new JwtAccessTokenService({ secret, ttlSeconds }, clock) };
}

describe('JwtAccessTokenService', () => {
    it('signs a token that it verifies back to the user', async () => {
        const { service } = setup();
        const signed = await service.sign(USER);
        expect(signed.expiresIn).toBe(900);
        await expect(service.verify(signed.token)).resolves.toEqual({ userId: USER });
    });

    it('puts sub, issuer, audience and clock-based iat/exp in the token (HS256)', async () => {
        const { service } = setup();
        const { token } = await service.sign(USER);
        const header = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'));
        const claims = new JwtService().decode<Record<string, unknown>>(token);
        expect(header.alg).toBe('HS256');
        expect(claims).toMatchObject({
            sub: USER,
            iss: ACCESS_TOKEN_ISSUER,
            aud: ACCESS_TOKEN_AUDIENCE,
            iat: Date.parse('2026-03-01T10:00:00.000Z') / 1000,
            exp: Date.parse('2026-03-01T10:00:00.000Z') / 1000 + 900,
        });
    });

    it('accepts the token until it expires, then rejects it (FixedClock)', async () => {
        const { service, clock } = setup();
        const { token } = await service.sign(USER);
        clock.advance(899 * 1000);
        await expect(service.verify(token)).resolves.toEqual({ userId: USER });
        clock.advance(1000);
        await expect(service.verify(token)).resolves.toBeUndefined();
    });

    it('rejects a token signed with another secret', async () => {
        const other = setup('another-secret-another-secret-12345678').service;
        const { token } = await other.sign(USER);
        await expect(setup().service.verify(token)).resolves.toBeUndefined();
    });

    it('rejects a token with the wrong issuer or audience', async () => {
        const raw = new JwtService({ secret: SECRET });
        const iat = Math.floor(Date.parse('2026-03-01T10:00:00.000Z') / 1000);
        const wrongIssuer = await raw.signAsync({ sub: USER, iat, exp: iat + 900 },
            { algorithm: 'HS256', issuer: 'someone-else', audience: ACCESS_TOKEN_AUDIENCE });
        const wrongAudience = await raw.signAsync({ sub: USER, iat, exp: iat + 900 },
            { algorithm: 'HS256', issuer: ACCESS_TOKEN_ISSUER, audience: 'someone-else' });
        const { service } = setup();
        await expect(service.verify(wrongIssuer)).resolves.toBeUndefined();
        await expect(service.verify(wrongAudience)).resolves.toBeUndefined();
    });

    it('rejects a token whose sub is not a user id', async () => {
        const raw = new JwtService({ secret: SECRET });
        const iat = Math.floor(Date.parse('2026-03-01T10:00:00.000Z') / 1000);
        const token = await raw.signAsync({ sub: 'admin', iat, exp: iat + 900 },
            { algorithm: 'HS256', issuer: ACCESS_TOKEN_ISSUER, audience: ACCESS_TOKEN_AUDIENCE });
        await expect(setup().service.verify(token)).resolves.toBeUndefined();
    });

    it.each(['', 'garbage', 'a.b.c', 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.'])('returns undefined (never throws) for %j', async bad => {
        await expect(setup().service.verify(bad)).resolves.toBeUndefined();
    });
});
