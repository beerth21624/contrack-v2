// ─── Closeout use cases (ปิดโครงการ, docs/erp/04-implementation-plan.md WP-55, docs/erp/02-domain-model.md §11) ───
// Read `handover.read` + `cost.read`; lessons / finalize `handover.manage` + `cost.read`. The draft summary is computed
// live from the cost codes (CostCodeLookup), the ledger's actual rows (CostLedger), the contract (MainContracts) and the
// billing totals (BillingTotals, when billing is active). Finalize (handover accepted, once — again 409
// `invalid_transition`) freezes the summary, moves the project to `closed` (ProjectLifecycle), closes the warranty and
// writes the actual unit rates per line key (UnitRateHistory), in one transaction.
import { Injectable } from '@nestjs/common';
import type { CloseoutDto, CloseoutSummaryDto, FinalizeCloseoutRequest, MainContractStatus, PatchCloseoutRequest } from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import {
    type CloseoutCostCode, type CloseoutLedgerRow, type CloseoutUnitRate, closeoutSummary, closeoutUnitRates,
} from '@contrack/domain/handover/closeout';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    AuditLog, BillingTotals, Clock, CostCodeLookup, CostLedger, IdGenerator, MainContracts, ModuleFlags, ProjectLifecycle, UnitOfWork,
    UnitRateHistory, UserDirectory,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Permission, can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { MODULE, transact } from '../handover.service';
import { type CloseoutRecord, type HandoverRecord, HandoverRepository } from '../ports/handover.repository';

const READ_CLOSEOUT: Permission[] = ['handover.read', 'cost.read'];
const MANAGE_CLOSEOUT: Permission[] = ['handover.manage', 'cost.read'];
/** Contract statuses whose value is the project's revenue. */
const REVENUE_STATUSES: readonly MainContractStatus[] = ['signed', 'completed', 'closed'];

const notAccepted = (): DomainError =>
    DomainError.conflict('The customer has not accepted the handover yet', { reason: 'handover_not_accepted' });

/** The live figures of a project's closeout. */
@Injectable()
export class CloseoutCalculator {
    constructor(
        private readonly costCodes: CostCodeLookup,
        private readonly ledger: CostLedger,
        private readonly contracts: MainContracts,
        private readonly billing: BillingTotals,
        private readonly flags: ModuleFlags,
    ) {}

    async compute(
        workspaceId: WorkspaceId, projectId: ProjectId, handover: HandoverRecord | undefined,
    ): Promise<{ summary: CloseoutSummaryDto; unitRates: CloseoutUnitRate[] }> {
        const [codes, entries, billingOn] = await Promise.all([
            this.costCodes.listByProject(workspaceId, projectId),
            this.ledger.listByProject(workspaceId, projectId),
            this.flags.isEnabled(workspaceId, 'billing'),
        ]);
        const contract = handover === undefined
            ? await this.contracts.forProject(workspaceId, projectId)
            : await this.contracts.find(workspaceId, handover.contractId);
        const costCodes: CloseoutCostCode[] = codes.map(c => ({
            id: c.id, sectionNo: c.sectionNo, lineKey: c.lineKey, descTh: c.descTh, unit: c.unit, baselineTotal: c.baselineTotal,
            budgetTotal: c.budgetTotal, budgetQty: c.baselineQty + c.voQty,
        }));
        const ledger: CloseoutLedgerRow[] = entries.filter(e => e.kind === 'actual')
            .map(e => ({ costCodeId: e.costCodeId, category: e.category, amount: e.amount }));
        const revenueContract = contract !== undefined && REVENUE_STATUSES.includes(contract.status) ? contract : undefined;
        const billing = billingOn ? await this.billing.totalsByProject(workspaceId, projectId) : null;
        const summary = closeoutSummary({
            costCodes, ledger, billing,
            contract: revenueContract === undefined ? null : {
                currentValue: revenueContract.currentValue, originalValue: revenueContract.originalValue,
                quotedMarginPct: revenueContract.quotedMarginPct,
            },
        });
        return { summary, unitRates: closeoutUnitRates(costCodes, ledger) };
    }
}

/** DTO of a closeout: the stored one (final: frozen summary) or the live draft. */
@Injectable()
export class CloseoutViews {
    constructor(
        private readonly repo: HandoverRepository,
        private readonly calculator: CloseoutCalculator,
        private readonly users: UserDirectory,
        private readonly clock: Clock,
    ) {}

    async dto(grant: ProjectGrant): Promise<CloseoutDto> {
        const ws = grant.workspaceId;
        const [handover, stored] = await Promise.all([
            this.repo.handoverForProject(ws, grant.projectId),
            this.repo.closeoutForProject(ws, grant.projectId),
        ]);
        const final = stored?.status === 'final' && stored.summary !== null;
        const summary = final && stored.summary !== null ? stored.summary : (await this.calculator.compute(ws, grant.projectId, handover)).summary;
        const seeMargins = can(grant.role, 'quotations.seeMargins');
        const manages = can(grant.role, 'handover.manage') && !grant.archived;
        const finalizedBy = stored?.finalizedBy ?? null;
        const finalizedByName = finalizedBy === null ? '' : (await this.users.findMany([finalizedBy])).get(finalizedBy)?.displayName ?? '';
        return {
            id: stored?.id ?? null,
            projectId: grant.projectId,
            status: final ? 'final' : 'draft',
            asOf: final && stored.asOf !== null ? stored.asOf : bangkokToday(this.clock.now()),
            summary: seeMargins ? summary : { ...summary, quotedMarginPct: null, quotedProfit: null },
            lessons: stored?.lessons ?? '',
            handoverStatus: handover?.status ?? null,
            finalizedBy,
            finalizedByName,
            finalizedAt: stored?.finalizedAt?.toISOString() ?? null,
            updatedAt: stored?.updatedAt.toISOString() ?? null,
            canEdit: manages && !final,
            canFinalize: manages && !final && handover?.status === 'accepted',
        };
    }
}

/** GET /projects/:projectId/closeout */
@Injectable()
export class GetCloseoutUseCase {
    constructor(private readonly access: ModuleAccess, private readonly views: CloseoutViews) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<CloseoutDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ_CLOSEOUT, write: false });
        if (!grant.ok) return grant;
        return ok(await this.views.dto(grant.value));
    }
}

/** PATCH /projects/:projectId/closeout — lessons learned while still a draft. */
@Injectable()
export class PatchCloseoutUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: HandoverRepository,
        private readonly views: CloseoutViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: PatchCloseoutRequest }): Promise<Result<CloseoutDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: MANAGE_CLOSEOUT, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const h = await this.repo.handoverForProject(ws, projectId);
            if (h !== undefined) await this.repo.lockHandover(ws, h.id);
            const prev = await this.repo.closeoutForProject(ws, projectId);
            if (prev?.status === 'final') return err(DomainError.conflict('The closeout is final', { reason: 'invalid_transition', status: 'final' }));
            const now = this.clock.now();
            await this.repo.saveCloseout({
                id: prev?.id ?? this.ids.newId(), workspaceId: ws, projectId, status: 'draft', asOf: null, summary: null,
                lessons: body.lessons, finalizedBy: null, finalizedAt: null, createdAt: prev?.createdAt ?? now, updatedAt: now,
            });
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'closeout', entityId: projectId, action: 'update', data: { fields: ['lessons'] },
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return ok(await this.views.dto(grant.value));
    }
}

/** POST /projects/:projectId/closeout/finalize */
@Injectable()
export class FinalizeCloseoutUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: HandoverRepository,
        private readonly views: CloseoutViews,
        private readonly calculator: CloseoutCalculator,
        private readonly lifecycle: ProjectLifecycle,
        private readonly unitRates: UnitRateHistory,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: FinalizeCloseoutRequest }): Promise<Result<CloseoutDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: MANAGE_CLOSEOUT, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const found = await this.repo.handoverForProject(ws, projectId);
            const h = found === undefined ? undefined : await this.repo.lockHandover(ws, found.id);
            const prev = await this.repo.closeoutForProject(ws, projectId);
            if (prev?.status === 'final') return err(DomainError.conflict('The closeout is final', { reason: 'invalid_transition', status: 'final' }));
            if (h?.status !== 'accepted') return err(notAccepted());
            const now = this.clock.now();
            const asOf = body.asOf ?? bangkokToday(now);
            const { summary, unitRates } = await this.calculator.compute(ws, projectId, h);
            const record: CloseoutRecord = {
                id: prev?.id ?? this.ids.newId(), workspaceId: ws, projectId, status: 'final', asOf, summary,
                lessons: body.lessons ?? prev?.lessons ?? '', finalizedBy: userId, finalizedAt: now, createdAt: prev?.createdAt ?? now, updatedAt: now,
            };
            await this.repo.saveCloseout(record);
            await this.unitRates.record(ws, projectId, asOf, unitRates);
            const warranty = await this.repo.warrantyForProject(ws, projectId);
            if (warranty !== undefined && warranty.status !== 'closed') await this.repo.saveWarranty({ ...warranty, status: 'closed', updatedAt: now });
            await this.lifecycle.advance(ws, projectId, 'closed', userId);
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'closeout', entityId: projectId, action: 'finalize',
                data: {
                    asOf, actual: summary.totals.actual.total, revenue: summary.revenue, profit: summary.profit, unitRates: unitRates.length,
                },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return ok(await this.views.dto(grant.value));
    }
}
