// ─── Integration: DrizzleRateCardRepository (tenant scope, unique active name, archive) and the use cases on PostgreSQL ───
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { MAX_ACTIVE_RATE_CARDS } from '@contrack/contract';
import { RateCardAccess } from '../../src/modules/rate-cards/application/rate-card-access';
import { ArchiveRateCardUseCase } from '../../src/modules/rate-cards/application/use-cases/archive-rate-card.use-case';
import { CreateRateCardUseCase } from '../../src/modules/rate-cards/application/use-cases/create-rate-card.use-case';
import { UpdateRateCardUseCase } from '../../src/modules/rate-cards/application/use-cases/update-rate-card.use-case';
import { RateCard } from '../../src/modules/rate-cards/domain/entities/rate-card.entity';
import { DailyRate } from '../../src/modules/rate-cards/domain/value-objects/daily-rate.value-object';
import { RateCardName } from '../../src/modules/rate-cards/domain/value-objects/rate-card-name.value-object';
import { DrizzleRateCardRepository } from '../../src/modules/rate-cards/infrastructure/adapters/drizzle-rate-card.repository';
import { DrizzleMembershipRepository } from '../../src/modules/workspaces/infrastructure/adapters/drizzle-membership.repository';
import { RepositoryWorkspaceAccess } from '../../src/modules/workspaces/infrastructure/adapters/workspace-access.adapter';
import { type UserId, type WorkspaceId, asRateCardId } from '../../src/shared/domain/ids';
import { type DatabaseContext, DrizzleUnitOfWork } from '../../src/shared/infrastructure/database/database';
import { rateCards, workspaces } from '../../src/shared/infrastructure/database/schema';
import { FixedClock, RandomIdGenerator } from '../../src/shared/infrastructure/system';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, expectPgError, must, seedMember, seedUser, seedWorkspace } from '../support/seed';

const later = (ms: number): Date => new Date(T0.getTime() + ms);

function card(workspaceId: WorkspaceId, createdBy: UserId, name: string, options: { now?: Date; skilled?: number; note?: string } = {}): RateCard {
    return RateCard.create({
        id: asRateCardId(randomUUID()),
        workspaceId,
        name: must(RateCardName.create(name)),
        skilledRate: must(DailyRate.create(options.skilled ?? 800, 'skilled')),
        labourerRate: must(DailyRate.create(500, 'labourer')),
        note: options.note ?? null,
        createdBy,
        now: options.now ?? T0,
    });
}

function useCases(ctx: DatabaseContext) {
    const repo = new DrizzleRateCardRepository(ctx);
    const access = new RateCardAccess(new RepositoryWorkspaceAccess(new DrizzleMembershipRepository(ctx)));
    const uow = new DrizzleUnitOfWork(ctx);
    const clock = new FixedClock(T0);
    return {
        repo,
        create: new CreateRateCardUseCase(access, repo, uow, clock, new RandomIdGenerator()),
        update: new UpdateRateCardUseCase(access, repo, uow, clock),
        archive: new ArchiveRateCardUseCase(access, repo, uow, clock),
    };
}

describeIfDatabase('DrizzleRateCardRepository (integration)', db => {
    it('stores and reads a card back exactly (Thai text, whole-baht rates, note)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRateCardRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const c = card(ws, owner, 'ทีมไฟฟ้า ช่างพงษ์', { skilled: 1200, note: 'งานไฟฟ้า' });
        await repo.insert(c);
        expect((await repo.find(ws, c.id))?.toProps()).toEqual(c.toProps());
    });

    it('every read is scoped by the workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRateCardRepository(ctx);
        const owner = await seedUser(ctx);
        const wsA = await seedWorkspace(ctx, owner);
        const wsB = await seedWorkspace(ctx, owner);
        const a = card(wsA, owner, 'Team A');
        await repo.insert(a);

        expect(await repo.find(wsB, a.id)).toBeUndefined();
        expect(await repo.listActive(wsB)).toEqual([]);
        expect(await repo.countActive(wsB)).toBe(0);
        expect(await repo.findActiveByName(wsB, must(RateCardName.create('Team A')))).toBeUndefined();

        // An update through the wrong workspace changes nothing.
        const forged = RateCard.rehydrate({ ...a.toProps(), workspaceId: wsB });
        forged.update({ skilledRate: must(DailyRate.create(1, 'skilled')) }, later(1000));
        await repo.update(forged);
        expect((await repo.find(wsA, a.id))?.skilledRate.baht).toBe(800);
    });

    it('lists and counts active cards oldest first; finds by name ignoring case', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRateCardRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const second = card(ws, owner, 'ชุด B', { now: later(2000) });
        const first = card(ws, owner, 'ชุด A', { now: later(1000) });
        const archived = card(ws, owner, 'Old', { now: T0 });
        await repo.insert(second);
        await repo.insert(first);
        await repo.insert(archived);
        archived.archive(later(3000));
        await repo.update(archived);

        expect((await repo.listActive(ws)).map(c => c.name.value)).toEqual(['ชุด A', 'ชุด B']);
        expect(await repo.countActive(ws)).toBe(2);
        expect((await repo.findActiveByName(ws, must(RateCardName.create('ชุด a'))))?.id).toBe(first.id);
        expect(await repo.findActiveByName(ws, must(RateCardName.create('OLD')))).toBeUndefined();
        expect((await repo.find(ws, archived.id))?.archivedAt).toEqual(later(3000));
    });

    it('update writes every changeable field', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRateCardRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const c = card(ws, owner, 'A', { note: 'x' });
        await repo.insert(c);
        c.update({
            name: must(RateCardName.create('B')),
            skilledRate: must(DailyRate.create(1000, 'skilled')),
            labourerRate: must(DailyRate.create(600, 'labourer')),
            note: null,
        }, later(5000));
        await repo.update(c);
        expect((await repo.find(ws, c.id))?.toProps()).toEqual(c.toProps());
    });

    it('the unique index refuses a second active card with the same name (any case) in one workspace only', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRateCardRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const other = await seedWorkspace(ctx, owner);
        const original = card(ws, owner, 'Team A');
        await repo.insert(original);

        await expectPgError(repo.insert(card(ws, owner, 'team a')), '23505', 'rate_cards_name_key');
        await repo.insert(card(other, owner, 'Team A')); // another workspace: fine

        // Archived names do not count: the name can be used again, even twice archived.
        original.archive(later(1000));
        await repo.update(original);
        const again = card(ws, owner, 'TEAM A');
        await repo.insert(again);
        again.archive(later(2000));
        await repo.update(again);
        await repo.insert(card(ws, owner, 'Team A'));
        expect(await repo.countActive(ws)).toBe(1);
    });

    it('check constraints back the domain rules; deleting the workspace deletes its cards', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const row = {
            workspaceId: ws, name: 'A', skilledRate: 800, labourerRate: 500, createdBy: owner,
        };
        await expectPgError(ctx.db.insert(rateCards).values({ ...row, id: randomUUID(), skilledRate: -1 }), '23514', 'rate_cards_skilled_rate_check');
        await expectPgError(ctx.db.insert(rateCards).values({ ...row, id: randomUUID(), labourerRate: 100_001 }), '23514', 'rate_cards_labourer_rate_check');
        await expectPgError(ctx.db.insert(rateCards).values({ ...row, id: randomUUID(), name: '' }), '23514', 'rate_cards_name_check');
        await expectPgError(ctx.db.insert(rateCards).values({ ...row, id: randomUUID(), workspaceId: randomUUID() }), '23503');

        const repo = new DrizzleRateCardRepository(ctx);
        await repo.insert(card(ws, owner, 'A'));
        await ctx.db.delete(workspaces).where(eq(workspaces.id, ws));
        expect(await ctx.db.select().from(rateCards)).toEqual([]);
    });
});

describeIfDatabase('rate-card use cases on PostgreSQL (integration)', db => {
    it('create → update → archive round trip; archive frees the name', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { repo, create, update, archive } = useCases(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);

        const created = must(await create.execute({ userId: owner, workspaceId: ws, name: 'ชุด B', skilledRate: 1000, labourerRate: 600 }));
        const dup = await create.execute({ userId: owner, workspaceId: ws, name: 'ชุด B', skilledRate: 1, labourerRate: 1 });
        expect(!dup.ok && dup.error.code).toBe('conflict');

        const updated = must(await update.execute({ userId: owner, workspaceId: ws, rateCardId: created.id, labourerRate: 650 }));
        expect(updated.labourerRate.baht).toBe(650);
        expect((await repo.find(ws, created.id))?.labourerRate.baht).toBe(650);

        must(await archive.execute({ userId: owner, workspaceId: ws, rateCardId: created.id }));
        expect((await repo.find(ws, created.id))?.isArchived).toBe(true);
        expect(await repo.listActive(ws)).toEqual([]);
        expect((await create.execute({ userId: owner, workspaceId: ws, name: 'ชุด B', skilledRate: 1000, labourerRate: 600 })).ok).toBe(true);
    });

    it('estimators create but may not edit; a viewer may not create', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { create, update } = useCases(ctx);
        const owner = await seedUser(ctx, 'Owner');
        const estimator = await seedUser(ctx, 'Estimator');
        const viewer = await seedUser(ctx, 'Viewer');
        const ws = await seedWorkspace(ctx, owner);
        await seedMember(ctx, ws, estimator, 'estimator');
        await seedMember(ctx, ws, viewer, 'viewer');

        const byEstimator = must(await create.execute({ userId: estimator, workspaceId: ws, name: 'E', skilledRate: 1, labourerRate: 1 }));
        const edit = await update.execute({ userId: estimator, workspaceId: ws, rateCardId: byEstimator.id, skilledRate: 2 });
        expect(!edit.ok && edit.error.code).toBe('forbidden');
        const byViewer = await create.execute({ userId: viewer, workspaceId: ws, name: 'V', skilledRate: 1, labourerRate: 1 });
        expect(!byViewer.ok && byViewer.error.code).toBe('forbidden');
    });

    it('concurrent creates are serialised by the library lock: the limit and the name hold', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { repo, create } = useCases(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        for (let i = 0; i < MAX_ACTIVE_RATE_CARDS - 1; i += 1) await repo.insert(card(ws, owner, `card ${i}`));

        const lastPlace = await Promise.all(['x', 'y', 'z'].map(name =>
            create.execute({ userId: owner, workspaceId: ws, name, skilledRate: 1, labourerRate: 1 })));
        expect(lastPlace.filter(r => r.ok)).toHaveLength(1);
        expect(await repo.countActive(ws)).toBe(MAX_ACTIVE_RATE_CARDS);

        const ws2 = await seedWorkspace(ctx, owner);
        const sameName = await Promise.all([1, 2, 3].map(() =>
            create.execute({ userId: owner, workspaceId: ws2, name: 'Same', skilledRate: 1, labourerRate: 1 })));
        expect(sameName.map(r => (r.ok ? 'ok' : r.error.code)).sort()).toEqual(['conflict', 'conflict', 'ok']);
    });
});
