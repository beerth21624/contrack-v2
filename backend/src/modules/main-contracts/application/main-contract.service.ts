// ─── Shared parts of main contracts: access, the MainContracts port, what the module plugs into core registries ───
import { Injectable, Logger } from '@nestjs/common';
import type { ContractMilestoneStatus, ContractVariationBilling, ProjectRollup } from '@contrack/contract';
import { addDays } from '@contrack/domain/dates/business-date';
import { round2 } from '@contrack/domain/money';
import { type ProjectGrant, ModuleAccess } from '../../../shared/application/module-access';
import {
    AuditLog, Clock, IdGenerator, type MainContractInfo, MainContracts, ModuleFlags, Notifier, ProjectCatalog, type SweepContext,
    SweepMarks, UnitOfWork, WorkspaceDirectory,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { type Permission, can } from '../../../shared/domain/permissions';
import { type Result, err, ok, okVoid } from '../../../shared/domain/result';
import { UNCLAIMED, VARIATION_LABEL, spreadUnclaimed } from '../domain/main-contract-rules';
import { SIGNED_STATUSES, requireStatus, requireTransition } from '../domain/main-contract-state';
import { type GuaranteeRecord, MainContractRepository, type MainContractRecord, type MilestoneRecord } from './ports/main-contract.repository';

export const MODULE = 'contracts';
export const GUARANTEE_SWEEP = 'contracts.guarantee-expiring';
/** Days before `expiry_date` the team hears about a guarantee. */
export const GUARANTEE_NOTICE_DAYS = 30;

/** Thrown inside a transaction so an `err` rolls it back (the UnitOfWork commits on a normal return). */
class Rollback extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
    }
}

/** Runs `work` in one transaction; an `err` result rolls everything back and is returned. Joins an open transaction. */
export async function transact<T>(uow: UnitOfWork, work: () => Promise<Result<T, DomainError>>): Promise<Result<T, DomainError>> {
    try {
        return await uow.run(async () => {
            const r = await work();
            if (!r.ok) throw new Rollback(r.error);
            return r;
        });
    } catch (e) {
        if (e instanceof Rollback) return err(e.error);
        throw e;
    }
}

export interface LoadedContract {
    grant: ProjectGrant;
    contract: MainContractRecord;
}

/** Loads a contract / guarantee by id and authorizes the caller on its project (a stranger or unknown id → not_found). */
@Injectable()
export class MainContractAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: MainContractRepository) {}

    async contract(userId: UserId, contractId: string, permissions: Permission[], write: boolean): Promise<Result<LoadedContract, DomainError>> {
        if (!isUuid(contractId)) return err(DomainError.notFound('MainContract'));
        const contract = await this.repo.findContract(contractId.toLowerCase());
        if (contract === undefined) return err(DomainError.notFound('MainContract'));
        const grant = await this.access.toProject(userId, contract.projectId, MODULE, { permissions, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('MainContract')) : grant;
        if (grant.value.workspaceId !== contract.workspaceId) return err(DomainError.notFound('MainContract'));
        return ok({ grant: grant.value, contract });
    }

    async guarantee(
        userId: UserId, guaranteeId: string, permissions: Permission[], write: boolean,
    ): Promise<Result<LoadedContract & { guarantee: GuaranteeRecord }, DomainError>> {
        if (!isUuid(guaranteeId)) return err(DomainError.notFound('Guarantee'));
        const guarantee = await this.repo.findGuarantee(guaranteeId.toLowerCase());
        if (guarantee === undefined) return err(DomainError.notFound('Guarantee'));
        const loaded = await this.contract(userId, guarantee.contractId, permissions, write);
        if (!loaded.ok) return loaded.error.code === 'not_found' ? err(DomainError.notFound('Guarantee')) : loaded;
        return ok({ ...loaded.value, guarantee });
    }
}

const info = (c: MainContractRecord, milestones: readonly MilestoneRecord[]): MainContractInfo => ({
    id: c.id, workspaceId: c.workspaceId, projectId: c.projectId, customerId: c.customerId, quotationId: c.quotationId,
    quotationVersionId: c.quotationVersionId, quotedMarginPct: c.quotedMarginPct, number: c.number, status: c.status, title: c.title,
    language: c.language, signDate: c.signDate, startDate: c.startDate, finishDate: c.finishDate, billingMode: c.billingMode,
    originalValue: c.originalValue, currentValue: c.currentValue, vatRate: c.vatRate, extensionDays: c.extensionDays,
    terms: structuredClone(c.terms), completedAt: c.completedAt,
    milestones: milestones.map(({ workspaceId: _w, projectId: _p, createdAt: _c, updatedAt: _u, ...m }) => ({ ...m, costCodeIds: [...m.costCodeIds] })),
});

/** MainContracts (port in shared/application/ports.ts) for billing, variations, handover, job-cost. */
@Injectable()
export class MainContractsService extends MainContracts {
    constructor(
        private readonly repo: MainContractRepository,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {
        super();
    }

    async find(workspaceId: WorkspaceId, contractId: string): Promise<MainContractInfo | undefined> {
        if (!isUuid(contractId)) return undefined;
        const c = await this.repo.findContract(contractId.toLowerCase());
        if (c?.workspaceId !== workspaceId) return undefined;
        return info(c, await this.repo.milestonesOf(workspaceId, [c.id]));
    }

    async locate(contractId: string): Promise<{ workspaceId: WorkspaceId; projectId: ProjectId } | undefined> {
        if (!isUuid(contractId)) return undefined;
        const c = await this.repo.findContract(contractId.toLowerCase());
        return c === undefined ? undefined : { workspaceId: c.workspaceId, projectId: c.projectId };
    }

    async forProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<MainContractInfo | undefined> {
        const c = await this.repo.effectiveForProject(workspaceId, projectId);
        return c === undefined ? undefined : info(c, await this.repo.milestonesOf(workspaceId, [c.id]));
    }

    async applyVariation(
        workspaceId: WorkspaceId, contractId: string,
        input: { sellDelta: number; extensionDays: number; billing: ContractVariationBilling; variationId: string; label?: { th: string; en: string }; by: UserId | null },
    ): Promise<Result<void, DomainError>> {
        if (!isUuid(contractId)) return err(DomainError.notFound('MainContract'));
        const c = await this.repo.lockContract(workspaceId, contractId.toLowerCase());
        if (c === undefined) return err(DomainError.notFound('MainContract'));
        const allowed = requireStatus(c.status, ['signed']);
        if (!allowed.ok) return allowed;
        if (input.billing === 'next_claim' && c.billingMode !== 'progress') {
            return err(DomainError.unprocessable('next_claim needs a progress-billed contract', { reason: 'invalid_billing_option' }));
        }
        if (!Number.isInteger(input.extensionDays)) return err(DomainError.validation('extensionDays must be a whole number'));
        const delta = round2(input.sellDelta);
        const now = this.clock.now();
        const currentValue = round2(c.currentValue + delta);
        const milestones = await this.repo.milestonesOf(workspaceId, [c.id]);
        let billing = input.billing;
        if (billing === 'spread' && delta !== 0) {
            const amounts = spreadUnclaimed(milestones, currentValue);
            if (amounts !== undefined) {
                for (const m of milestones) {
                    const amount = amounts.get(m.id);
                    if (amount !== undefined && amount !== m.amount) await this.repo.saveMilestone({ ...m, amount, updatedAt: now });
                }
            } else if (c.billingMode === 'milestone') {
                billing = 'separate_milestone';
            }
        }
        if (billing === 'separate_milestone' && delta !== 0) {
            const no = milestones.reduce((max, m) => Math.max(max, m.no), 0) + 1;
            await this.repo.insertMilestone({
                id: this.ids.newId(), contractId: c.id, workspaceId, projectId: c.projectId, no,
                labelTh: input.label?.th ?? VARIATION_LABEL.th, labelEn: input.label?.en ?? VARIATION_LABEL.en, kind: 'work', pct: 0, amount: delta,
                trigger: 'manual', triggerProgress: null, dueDate: null, costCodeIds: [], status: 'planned', source: 'variation',
                variationId: input.variationId, createdAt: now, updatedAt: now,
            });
        }
        const extensionDays = c.extensionDays + input.extensionDays;
        const finishDate = c.finishDate === null || input.extensionDays === 0 ? c.finishDate : addDays(c.finishDate, input.extensionDays);
        await this.repo.saveContract({ ...c, currentValue, extensionDays, finishDate, updatedAt: now });
        await this.audit.record({
            workspaceId, projectId: c.projectId, actor: input.by, entityType: 'main_contract', entityId: c.id, action: 'apply_variation',
            data: { currentValue: [c.currentValue, currentValue], extensionDays: [c.extensionDays, extensionDays], variationId: input.variationId, billing },
        });
        return okVoid();
    }

    async markMilestone(workspaceId: WorkspaceId, milestoneId: string, status: ContractMilestoneStatus): Promise<Result<void, DomainError>> {
        if (!isUuid(milestoneId)) return err(DomainError.notFound('Milestone'));
        const m = await this.repo.findMilestone(milestoneId.toLowerCase());
        if (m?.workspaceId !== workspaceId) return err(DomainError.notFound('Milestone'));
        const c = await this.repo.lockContract(workspaceId, m.contractId);
        if (c === undefined) return err(DomainError.notFound('MainContract'));
        const allowed = requireStatus(c.status, ['signed', 'completed', 'closed']);
        if (!allowed.ok) return allowed;
        if (m.status === status) return okVoid();
        await this.repo.saveMilestone({ ...m, status, updatedAt: this.clock.now() });
        await this.audit.record({
            workspaceId, projectId: m.projectId, actor: null, entityType: 'main_contract', entityId: c.id, action: 'milestone_status',
            data: { milestoneId: m.id, no: m.no, status: [m.status, status] },
        });
        return okVoid();
    }

    async complete(workspaceId: WorkspaceId, contractId: string, date: string, by: UserId | null = null): Promise<Result<void, DomainError>> {
        if (!isUuid(contractId)) return err(DomainError.notFound('MainContract'));
        const c = await this.repo.lockContract(workspaceId, contractId.toLowerCase());
        if (c === undefined) return err(DomainError.notFound('MainContract'));
        const allowed = requireTransition(c.status, 'completed');
        if (!allowed.ok) return allowed;
        await this.repo.saveContract({ ...c, status: 'completed', completedAt: date, updatedAt: this.clock.now() });
        await this.audit.record({
            workspaceId, projectId: c.projectId, actor: by, entityType: 'main_contract', entityId: c.id, action: 'complete',
            data: { status: [c.status, 'completed'], completedAt: date },
        });
        return okVoid();
    }
}

/** HubRollups, BaselineUnlockGuards and the daily guarantee sweep (wired in MainContractsModule.onModuleInit). */
@Injectable()
export class MainContractHandlers {
    private readonly logger = new Logger(MainContractHandlers.name);

    constructor(
        private readonly repo: MainContractRepository,
        private readonly flags: ModuleFlags,
        private readonly marks: SweepMarks,
        private readonly directory: WorkspaceDirectory,
        private readonly catalog: ProjectCatalog,
        private readonly notifier: Notifier,
    ) {}

    /** contractValue (current value of a signed contract) and the next milestone not claimed yet. */
    async rollup(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, Partial<ProjectRollup>>> {
        const out = new Map<ProjectId, Partial<ProjectRollup>>();
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return out;
        const contracts = (await this.repo.effectiveForProjects(workspaceId, projectIds)).filter(c => SIGNED_STATUSES.includes(c.status));
        const milestones = await this.repo.milestonesOf(workspaceId, contracts.map(c => c.id));
        for (const c of contracts) {
            const next = milestones.find(m => m.contractId === c.id && UNCLAIMED.has(m.status));
            out.set(c.projectId, {
                contractValue: c.currentValue,
                nextMilestone: next === undefined
                    ? null
                    : { label: c.language === 'en' ? next.labelEn : next.labelTh, dueDate: next.dueDate, amount: next.amount },
            });
        }
        return out;
    }

    /** A signed (completed, closed) contract keeps the baseline locked. */
    async unlockBlockers(workspaceId: WorkspaceId, projectId: ProjectId): Promise<{ reason: string; count: number }[]> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return [];
        const c = await this.repo.effectiveForProject(workspaceId, projectId);
        return c !== undefined && SIGNED_STATUSES.includes(c.status) ? [{ reason: 'contract_signed', count: 1 }] : [];
    }

    /** `guarantee.expiring` once per guarantee, 30 days (or less) before its expiry, to the members who manage contracts. */
    async guaranteeExpiring(ctx: SweepContext): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        const active = new Map<WorkspaceId, boolean>();
        for (const g of await this.repo.guaranteesExpiring(ctx.today, addDays(ctx.today, GUARANTEE_NOTICE_DAYS), 2000)) {
            try {
                let on = active.get(g.workspaceId);
                if (on === undefined) {
                    on = await this.flags.isEnabled(g.workspaceId, MODULE);
                    active.set(g.workspaceId, on);
                }
                if (!on || g.expiryDate === null) continue;
                // The expiry date as the mark's date: one notice per guarantee (and again only if the date changes).
                if (!(await this.marks.markOnce(GUARANTEE_SWEEP, g.id, g.expiryDate))) continue;
                const toUserIds = (await this.directory.members(g.workspaceId)).filter(m => can(m.role, 'contracts.manage')).map(m => m.userId);
                if (toUserIds.length === 0) continue;
                const projectName = (await this.catalog.find(g.workspaceId, g.projectId))?.name ?? '';
                await this.notifier.notify({
                    template: 'guarantee.expiring',
                    toUserIds,
                    payload: {
                        title: [g.refNo, g.issuer].filter(s => s !== '').join(' ') || g.kind,
                        projectName,
                        date: g.expiryDate,
                        href: `/p/${g.projectId}/contract`,
                    },
                });
            } catch (e) {
                this.logger.error(`${GUARANTEE_SWEEP} ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
}
