// HTTP edge of the platform module: real Nest wiring (CoreModule in memory + PlatformModule), fakes for the ports
// other modules provide (WorkspaceAccess, ProjectStatusLookup, AccessTokenVerifier, WorkspaceDirectory). Not an e2e suite: no other module runs.
import type { Server } from 'node:http';
import { Global, type INestApplication, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MAX_FILE_BYTES, MODULE_IDS, adminWorkspacesDtoSchema, startTrialResponseSchema, workspaceModulesDtoSchema } from '@contrack/contract';
import {
    AccessTokenVerifier, type AuthenticatedUser, ModuleFlags, ModuleWorkRegistry, Notifier, ProjectStatusLookup, WorkspaceAccess,
    UserDirectory, type UserProfile, WorkspaceDirectory,
} from '../../../shared/application/ports';
import { type UserId, asUserId } from '../../../shared/domain/ids';
import { testEnv } from '../../../shared/infrastructure/config/env';
import { CoreModule } from '../../../shared/infrastructure/core.module';
import { AuthGuard } from '../../../shared/presentation/auth';
import { ErrorFilter } from '../../../shared/presentation/http';
import { FakeProjectStatuses, FakeRoles, FakeWorkspaceDirectory } from '../../../shared/testing/platform-fakes';
import { NotificationDeliveryRepository } from '../application/ports/notification-delivery.repository';
import { SmsSender } from '../application/ports/sms-sender.port';
import { DeliveryWorker } from '../infrastructure/adapters/delivery-worker';
import { InMemoryNotificationDeliveryRepository } from '../infrastructure/adapters/in-memory-notification-delivery.repository';
import { PlatformModule } from '../platform.module';
import { FakeModuleWork } from '../testing/platform-test-kit';
import { RecordingSmsSender } from '../testing/recording-sms-sender';

class TokenIsUserId extends AccessTokenVerifier {
    verify(token: string): Promise<AuthenticatedUser | undefined> {
        return Promise.resolve(token.startsWith('u-') ? { userId: asUserId(token.slice(2)) } : undefined);
    }
}

class FakeUsers extends UserDirectory {
    findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>> {
        const email = (id: UserId): string => (id === ('00000000-0000-4000-a000-000000000001' as UserId) ? 'Admin@Example.com' : 'viewer@example.com');
        return Promise.resolve(new Map(ids.map(id => [id, { id, email: email(id), displayName: 'x' }])));
    }
}

const fakeWorkspaces = new FakeWorkspaceDirectory();
const roles = new FakeRoles();
const usage = new FakeModuleWork();

@Global()
@Module({
    providers: [
        { provide: WorkspaceAccess, useValue: roles },
        { provide: ProjectStatusLookup, useValue: new FakeProjectStatuses() },
        { provide: AccessTokenVerifier, useClass: TokenIsUserId },
        { provide: WorkspaceDirectory, useValue: fakeWorkspaces },
        { provide: UserDirectory, useClass: FakeUsers },
    ],
    exports: [WorkspaceAccess, ProjectStatusLookup, AccessTokenVerifier, WorkspaceDirectory, UserDirectory],
})
class OtherModulesFakes {}

const OWNER = asUserId('00000000-0000-4000-a000-000000000001');
const VIEWER = asUserId('00000000-0000-4000-a000-000000000002');
const WS = '00000000-0000-4000-b000-000000000001';
const auth = (userId: string): [string, string] => ['Authorization', `Bearer u-${userId}`];

describe('platform HTTP edge', () => {
    let app: INestApplication;
    const http = (): Server => app.getHttpServer() as Server;

    beforeAll(async () => {
        roles.set(OWNER, WS as never, 'owner');
        roles.set(VIEWER, WS as never, 'viewer');
        const moduleRef = await Test.createTestingModule({
            imports: [CoreModule.forRoot({ env: testEnv({ PLATFORM_ADMIN_EMAILS: 'admin@example.com' }) }), OtherModulesFakes, PlatformModule],
            providers: [{ provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_FILTER, useClass: ErrorFilter }],
        }).compile();
        usage.registerInto(moduleRef.get(ModuleWorkRegistry));
        app = moduleRef.createNestApplication({ logger: false });
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('modules', () => {
        it('GET /platform/modules is public', async () => {
            const res = await request(http()).get('/platform/modules').expect(200);
            expect(res.body).toEqual({ modules: [...testEnv().MODULES_ENABLED] });
            expect((res.body as { modules: string[] }).modules).toEqual(expect.arrayContaining(['subcontracting', 'workforce', 'project-hub']));
        });

        it('a member lists, the owner switches on, ModuleFlags agrees at once', async () => {
            const list = await request(http()).get(`/workspaces/${WS}/modules`).set(...auth(VIEWER)).expect(200);
            expect(list.body).toHaveLength(MODULE_IDS.length);
            const put = await request(http()).put(`/workspaces/${WS}/modules/subcontracting`).set(...auth(OWNER))
                .send({ enabled: true }).expect(200);
            expect(put.body).toMatchObject({ module: 'subcontracting', available: true, enabled: true });
            expect(await app.get(ModuleFlags).isEnabled(WS as never, 'subcontracting')).toBe(true);
        });

        it('answers 403 / 404 / 400 / 422 / 409 like the contract says', async () => {
            const server = http();
            await request(server).put(`/workspaces/${WS}/modules/subcontracting`).set(...auth(VIEWER)).send({ enabled: true }).expect(403);
            await request(server).get('/workspaces/00000000-0000-4000-b000-0000000000ff/modules').set(...auth(OWNER)).expect(404);
            await request(server).get('/workspaces/not-a-uuid/modules').set(...auth(OWNER)).expect(404);
            await request(server).put(`/workspaces/${WS}/modules/nope`).set(...auth(OWNER)).send({ enabled: true }).expect(400);
            await request(server).put(`/workspaces/${WS}/modules/materials`).set(...auth(OWNER)).send({ enabled: true }).expect(422);
            await request(server).get(`/workspaces/${WS}/modules`).expect(401);
            usage.set(WS as never, 'subcontracting', 2);
            const conflict = await request(server).put(`/workspaces/${WS}/modules/subcontracting`).set(...auth(OWNER)).send({ enabled: false }).expect(409);
            expect(conflict.body).toMatchObject({ code: 'conflict', details: { activeSubcontracts: 2 } });
            await request(server).put(`/workspaces/${WS}/modules/subcontracting`).set(...auth(OWNER)).send({ enabled: false, confirm: true }).expect(200);
        });

        it('ERP modules: dependencies, trial once, cascade off (ENTITLEMENTS=open in tests)', async () => {
            const server = http();
            const missing = await request(server).put(`/workspaces/${WS}/modules/billing`).set(...auth(OWNER)).send({ enabled: true }).expect(422);
            expect(missing.body).toMatchObject({
                code: 'unprocessable', details: { reason: 'missing_dependencies', missing: ['project-hub', 'boq-control', 'contracts'] },
            });
            await request(server).post(`/workspaces/${WS}/modules/billing/trial`).set(...auth(VIEWER)).expect(403);
            await request(server).post(`/workspaces/${WS}/modules/workforce/trial`).set(...auth(OWNER)).expect(422);
            const trial = await request(server).post(`/workspaces/${WS}/modules/billing/trial`).set(...auth(OWNER)).expect(200);
            const body = startTrialResponseSchema.parse(trial.body);
            expect(body.started).toEqual(['billing']);
            expect(body.module).toMatchObject({ module: 'billing', enabled: true, active: true, trialAvailable: false, entitlement: { status: 'trial' } });
            expect(await app.get(ModuleFlags).isEnabled(WS as never, 'contracts')).toBe(true);
            const again = await request(server).post(`/workspaces/${WS}/modules/billing/trial`).set(...auth(OWNER)).expect(409);
            expect(again.body).toMatchObject({ code: 'conflict', details: { reason: 'trial_used' } });

            const blocked = await request(server).put(`/workspaces/${WS}/modules/contracts`).set(...auth(OWNER)).send({ enabled: false }).expect(409);
            expect(blocked.body).toMatchObject({ code: 'conflict', details: { reason: 'has_dependents', dependents: ['billing'], work: {} } });
            await request(server).put(`/workspaces/${WS}/modules/contracts`).set(...auth(OWNER)).send({ enabled: false, confirm: true }).expect(200);
            const list = workspaceModulesDtoSchema.parse((await request(server).get(`/workspaces/${WS}/modules`).set(...auth(VIEWER)).expect(200)).body);
            expect(list.find(m => m.module === 'billing')).toMatchObject({ enabled: false, active: false });
            expect(list.find(m => m.module === 'boq-control')).toMatchObject({ enabled: true, active: true });
        });
    });

    describe('platform admin', () => {
        it('status is open to everybody; the rest is 404 for non-admins', async () => {
            const server = http();
            expect((await request(server).get('/platform/admin/status').set(...auth(OWNER)).expect(200)).body).toEqual({ admin: true });
            expect((await request(server).get('/platform/admin/status').set(...auth(VIEWER)).expect(200)).body).toEqual({ admin: false });
            await request(server).get('/platform/admin/status').expect(401);
            await request(server).get('/platform/admin/workspaces').set(...auth(VIEWER)).expect(404);
            await request(server).put(`/platform/admin/workspaces/${WS}/entitlements/billing`).set(...auth(VIEWER)).send({ status: 'purchased' }).expect(404);
        });

        it('the admin finds a workspace and sets an entitlement that the workspace sees at once', async () => {
            const server = http();
            fakeWorkspaces.nameOf.set(WS as never, 'Acme Builders');
            const found = adminWorkspacesDtoSchema.parse((await request(server).get('/platform/admin/workspaces?q=acme').set(...auth(OWNER)).expect(200)).body);
            expect(found.map(w => w.name)).toEqual(['Acme Builders']);
            const put = await request(server).put(`/platform/admin/workspaces/${WS}/entitlements/billing`).set(...auth(OWNER))
                .send({ status: 'purchased', note: 'invoice 1' }).expect(200);
            expect(put.body).toMatchObject({ module: 'billing', status: 'purchased', note: 'invoice 1' });
            const list = workspaceModulesDtoSchema.parse((await request(server).get(`/workspaces/${WS}/modules`).set(...auth(VIEWER)).expect(200)).body);
            expect(list.find(m => m.module === 'billing')?.entitlement.status).toBe('purchased');
            await request(server).put(`/platform/admin/workspaces/${WS}/entitlements/billing`).set(...auth(OWNER)).send({ status: 'trial' }).expect(400);
            await request(server).put(`/platform/admin/workspaces/${WS}/entitlements/workforce`).set(...auth(OWNER)).send({ status: 'purchased' }).expect(422);
        });
    });

    describe('files', () => {
        it('uploads (Thai name), then serves the bytes from the signed link without a token', async () => {
            const server = http();
            const res = await request(server).post('/files').set(...auth(OWNER))
                .field('purpose', 'bid_photo')
                .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0x01]), { filename: 'หน้างาน.jpg', contentType: 'image/jpeg' })
                .expect(201);
            const body = res.body as { id: string; name: string; url: string; size: number };
            expect(body).toMatchObject({ name: 'หน้างาน.jpg', size: 4 });
            expect(body.url.startsWith(`/api/files/${body.id}/content?exp=`)).toBe(true);
            const path = body.url.replace(/^\/api/, '');
            const content = await request(server).get(path).buffer(true).expect(200);
            expect(content.headers['content-type']).toBe('image/jpeg');
            expect(content.headers['content-disposition']).toContain('inline');
            expect(content.headers['content-disposition']).toContain(encodeURIComponent('หน้างาน.jpg'));
            expect(Buffer.from(content.body as Buffer)).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0x01]));
            await request(server).get(path.replace(/sig=[^&]+/, 'sig=forged')).expect(404);
            await request(server).get(`/files/${body.id}/content`).expect(404);
        });

        it('refuses a disallowed type and an oversized file with 422; no file / bad purpose with 400', async () => {
            const server = http();
            await request(server).post('/files').set(...auth(OWNER)).field('purpose', 'bid_photo')
                .attach('file', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' }).expect(422);
            const tooBig = await request(server).post('/files').set(...auth(OWNER)).field('purpose', 'bid_photo')
                .attach('file', Buffer.alloc(MAX_FILE_BYTES + 1), { filename: 'big.jpg', contentType: 'image/jpeg' });
            expect(tooBig.status).toBe(422);
            await request(server).post('/files').set(...auth(OWNER)).field('purpose', 'bid_photo').expect(400);
            await request(server).post('/files').set(...auth(OWNER)).field('purpose', 'selfie')
                .attach('file', Buffer.from([1]), { filename: 'a.jpg', contentType: 'image/jpeg' }).expect(400);
            await request(server).post('/files').attach('file', Buffer.from([1]), { filename: 'a.jpg', contentType: 'image/jpeg' }).expect(401);
        });
    });

    describe('notifications', () => {
        it('Notifier writes the bell, the owner reads and marks read; the SMS goes out through the worker', async () => {
            const server = http();
            await app.get(Notifier).notify({
                template: 'sc.contract_to_accept', toUserIds: [OWNER], toPhone: '+66812345678',
                payload: { buyerName: 'บริษัท ก', title: 'งานฉาบปูน', total: '125,000 บาท', href: '/vendor/contracts/c1' },
            });
            const list = await request(server).get('/notifications?limit=5').set(...auth(OWNER)).expect(200);
            expect(list.body).toMatchObject({ unread: 1, items: [{ template: 'sc.contract_to_accept', href: '/vendor/contracts/c1', readAt: null }] });
            const viewer = await request(server).get('/notifications').set(...auth(VIEWER)).expect(200);
            expect(viewer.body).toEqual({ items: [], unread: 0 });
            await request(server).get('/notifications?limit=0').set(...auth(OWNER)).expect(400);
            await request(server).post('/notifications/read').set(...auth(OWNER)).send({ all: true }).expect(204);
            await request(server).post('/notifications/read').set(...auth(OWNER)).send({}).expect(400);
            const after = await request(server).get('/notifications').set(...auth(OWNER)).expect(200);
            expect((after.body as { unread: number }).unread).toBe(0);

            const sms = app.get(SmsSender);
            expect(sms).toBeInstanceOf(RecordingSmsSender);
            await app.get(DeliveryWorker).runOnce();
            expect((sms as RecordingSmsSender).lastTo('+66812345678')?.text).toContain('http://localhost:3000/vendor/contracts/c1');
            // Once sent, the stored copy keeps no link.
            const stored = app.get<NotificationDeliveryRepository, InMemoryNotificationDeliveryRepository>(NotificationDeliveryRepository).all();
            expect(stored.map(d => d.status)).toEqual(['sent']);
            expect(stored[0]?.body).toContain('[link]');
            expect(stored[0]?.body).not.toContain('http');
        });
    });
});

describe('platform HTTP edge, platform without business modules (plain BOQ)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [CoreModule.forRoot({ env: testEnv({ MODULES_ENABLED: '' }) }), OtherModulesFakes, PlatformModule],
            providers: [{ provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_FILTER, useClass: ErrorFilter }],
        }).compile();
        app = moduleRef.createNestApplication({ logger: false });
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST /files answers 404 module_disabled (every purpose belongs to subcontracting)', async () => {
        const res = await request(app.getHttpServer() as Server).post('/files').set(...auth(OWNER)).field('purpose', 'bid_photo')
            .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0x01]), { filename: 'a.jpg', contentType: 'image/jpeg' })
            .expect(404);
        expect(res.body).toMatchObject({ code: 'module_disabled' });
    });
});
