// ─── Test kit of the rate-cards module: in-memory repository, fixed clock/ids, a fake WorkspaceAccess ───
// Not a spec itself; imported by the *.spec.ts files next to the code they test.
import type { Role } from '@contrack/contract';
import { WorkspaceAccess } from '../../../shared/application/ports';
import { asUserId, asWorkspaceId, type UserId, type WorkspaceId } from '../../../shared/domain';
import { InMemoryUnitOfWork } from '../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../shared/infrastructure/system';
import { RateCardAccess } from '../application/rate-card-access';
import { ArchiveRateCardUseCase } from '../application/use-cases/archive-rate-card.use-case';
import { CreateRateCardUseCase, type CreateRateCardInput } from '../application/use-cases/create-rate-card.use-case';
import { ListRateCardsUseCase } from '../application/use-cases/list-rate-cards.use-case';
import { UpdateRateCardUseCase } from '../application/use-cases/update-rate-card.use-case';
import type { RateCard } from '../domain/entities/rate-card.entity';
import { InMemoryRateCardRepository } from '../infrastructure/adapters/in-memory-rate-card.repository';

export class FakeWorkspaceAccess extends WorkspaceAccess {
    private readonly roles = new Map<string, Role>();

    set(userId: UserId, workspaceId: WorkspaceId, role: Role | undefined): void {
        const key = `${userId}|${workspaceId}`;
        if (role === undefined) this.roles.delete(key);
        else this.roles.set(key, role);
    }

    roleOf(userId: UserId, workspaceId: WorkspaceId): Promise<Role | undefined> {
        return Promise.resolve(this.roles.get(`${userId}|${workspaceId}`));
    }
}

/** Two tenants: workspace A with one member per role, workspace B with its own owner. */
export const WS_A = asWorkspaceId('aaaaaaaa-0000-4000-8000-00000000000a');
export const WS_B = asWorkspaceId('bbbbbbbb-0000-4000-8000-00000000000b');
export const OWNER = asUserId('10000000-0000-4000-8000-000000000001');
export const ADMIN = asUserId('10000000-0000-4000-8000-000000000002');
export const ESTIMATOR = asUserId('10000000-0000-4000-8000-000000000003');
export const VIEWER = asUserId('10000000-0000-4000-8000-000000000004');
export const OUTSIDER = asUserId('10000000-0000-4000-8000-000000000005');
export const OWNER_B = asUserId('20000000-0000-4000-8000-000000000001');

/** The ERP working roles (docs/erp/01 §5.1), also members of workspace A. */
export const PM = asUserId('10000000-0000-4000-8000-000000000006');
export const PURCHASING = asUserId('10000000-0000-4000-8000-000000000007');
export const ACCOUNTING = asUserId('10000000-0000-4000-8000-000000000008');
export const FOREMAN = asUserId('10000000-0000-4000-8000-000000000009');
export const ROLE_USERS: Record<Role, UserId> = {
    owner: OWNER, admin: ADMIN, estimator: ESTIMATOR, viewer: VIEWER,
    pm: PM, purchasing: PURCHASING, accounting: ACCOUNTING, foreman: FOREMAN,
};

export function rateCardsKit() {
    const clock = new FixedClock(new Date('2026-03-01T08:00:00.000Z'));
    const ids = new SequentialIdGenerator();
    const workspaces = new FakeWorkspaceAccess();
    const uow = new InMemoryUnitOfWork();
    const cards = new InMemoryRateCardRepository();
    const access = new RateCardAccess(workspaces);

    workspaces.set(OWNER, WS_A, 'owner');
    workspaces.set(ADMIN, WS_A, 'admin');
    workspaces.set(ESTIMATOR, WS_A, 'estimator');
    workspaces.set(VIEWER, WS_A, 'viewer');
    workspaces.set(PM, WS_A, 'pm');
    workspaces.set(PURCHASING, WS_A, 'purchasing');
    workspaces.set(ACCOUNTING, WS_A, 'accounting');
    workspaces.set(FOREMAN, WS_A, 'foreman');
    workspaces.set(OWNER_B, WS_B, 'owner');

    const useCases = {
        listCards: new ListRateCardsUseCase(access, cards),
        createCard: new CreateRateCardUseCase(access, cards, uow, clock, ids),
        updateCard: new UpdateRateCardUseCase(access, cards, uow, clock),
        archiveCard: new ArchiveRateCardUseCase(access, cards, uow, clock),
    };

    /** A card created through the use case (fails the test when creation fails). */
    async function seedCard(options: Partial<Omit<CreateRateCardInput, 'userId'>> & { by?: UserId } = {}): Promise<RateCard> {
        const r = await useCases.createCard.execute({
            userId: options.by ?? OWNER,
            workspaceId: options.workspaceId ?? WS_A,
            name: options.name ?? 'ชุด A งานทั่วไป',
            skilledRate: options.skilledRate ?? 800,
            labourerRate: options.labourerRate ?? 500,
            note: options.note,
        });
        if (!r.ok) throw new Error(`seedCard failed: ${r.error.code} ${r.error.message}`);
        return r.value;
    }

    return { clock, ids, workspaces, uow, cards, access, ...useCases, seedCard };
}

export type RateCardsKit = ReturnType<typeof rateCardsKit>;
