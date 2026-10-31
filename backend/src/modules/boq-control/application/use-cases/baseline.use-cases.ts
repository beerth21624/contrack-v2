// ─── Baseline + cost codes (WP-18, docs/erp/02-domain-model.md §1.10) ───
// Locking freezes one BOQ version as the baseline and builds the project's cost codes from its lines (upsert by `code`,
// so ids never change across re-baselines; lines that disappeared become `omitted`). While a baseline is active (and
// the module is on) PutDoc refuses `calc:*`, `boq:*` and `journey` through BoqEditLocks.
import { Injectable } from '@nestjs/common';
import type { BaselineDto, BaselineStatusDto, CostCodeDto, LockBaselineRequest, UnlockBaselineRequest } from '@contrack/contract';
import { allocateContractAmounts } from '@contrack/domain/boq-control/contract-allocation';
import type { BoqVersionLine } from '@contrack/domain/boq-control/version-lines';
import { round2, roundQty } from '@contrack/domain/money';
import type { Project as BoqProject } from '@contrack/domain/project';
import { ModuleAccess } from '../../../../shared/application/module-access';
import {
    AuditLog, BaselineControl, type BaselineInfo, BaselineUnlockGuards, Clock, type ContractAllocationResult, type CostCode,
    type CostCodeContractLine, CostCodeLookup, type CostCodeVariationLine, IdGenerator, RevisionLookup, RevisionWriter, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { BaselineRepository, type BaselineRecord, CostCodeRepository } from '../ports/baseline.repository';
import { BoqVersionRepository, type BoqVersionRecord } from '../ports/boq-version.repository';
import { BoqVersionRecorder } from './boq-versions.use-cases';

const MODULE = 'boq-control';

/** Documents that change BOQ quantities (D-37): frozen while the baseline is locked. */
export const isBaselineDoc = (docKey: string): boolean => docKey.startsWith('calc:') || docKey.startsWith('boq:') || docKey === 'journey';

const SOURCE_RANK: Record<CostCode['source'], number> = { baseline: 0, variation: 1, manual: 2 };

/** Baseline codes first, then VO, then manual; each in BOQ order. */
const ordered = (codes: CostCode[]): CostCode[] => [...codes].sort((a, b) =>
    SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || a.sort - b.sort || a.code.localeCompare(b.code));

const clampProgress = (v: number): number => (Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 1e6) / 1e6 : 0);

const maxSort = (codes: readonly CostCode[]): number => codes.reduce((m, c) => Math.max(m, c.sort), 0);

/** Implements CostCodeLookup (other modules) and the cost-code upsert of a baseline lock. */
@Injectable()
export class CostCodeService extends CostCodeLookup {
    constructor(private readonly repo: CostCodeRepository, private readonly ids: IdGenerator, private readonly clock: Clock) {
        super();
    }

    async findMany(workspaceId: WorkspaceId, projectId: ProjectId, ids: readonly string[]): Promise<CostCode[]> {
        return ordered(await this.repo.findMany(workspaceId, projectId, ids));
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<CostCode[]> {
        return ordered(await this.repo.listByProject(workspaceId, projectId));
    }

    /**
     * Upserts one baseline cost code per version line (code = line_key) and marks baseline codes whose line is gone
     * as omitted. VO / contract / progress figures of an existing code are kept. Returns {active, omitted} counts.
     */
    async syncFromLines(
        workspaceId: WorkspaceId, projectId: ProjectId, lines: readonly BoqVersionLine[],
    ): Promise<{ active: number; omitted: number }> {
        const now = this.clock.now();
        const existing = await this.repo.listByProject(workspaceId, projectId);
        const byCode = new Map(existing.map(c => [c.code, c]));
        const inserts: CostCode[] = [];
        const updates: CostCode[] = [];
        const seen = new Set<string>();
        for (const line of lines) {
            seen.add(line.lineKey);
            const baseline = {
                sectionNo: line.sectionNo,
                lineKey: line.lineKey,
                descTh: line.descTh,
                unit: line.unit,
                sort: line.sort,
                baselineQty: roundQty(line.qty),
                baselineMatUnit: line.matUnit,
                baselineLabUnit: line.labUnit,
                baselineMat: round2(line.matTotal),
                baselineLab: round2(line.labTotal),
                baselineTotal: round2(line.total),
            };
            const found = byCode.get(line.lineKey);
            if (found === undefined) {
                inserts.push({
                    id: this.ids.newId(), workspaceId, projectId, code: line.lineKey, source: 'baseline', sourceRef: null, descEn: '',
                    ...baseline,
                    voQty: 0, voCost: 0, budgetTotal: baseline.baselineTotal, contractAmount: 0, voContractAmount: 0,
                    reportedProgress: 0, certifiedProgress: 0, status: 'active', createdAt: now, updatedAt: now,
                });
            } else {
                updates.push({
                    ...found, ...baseline, budgetTotal: round2(baseline.baselineTotal + found.voCost), status: 'active', updatedAt: now,
                });
            }
        }
        let omitted = 0;
        for (const c of existing) {
            if (c.source !== 'baseline' || seen.has(c.code)) continue;
            omitted += 1;
            if (c.status !== 'omitted') updates.push({ ...c, status: 'omitted', updatedAt: now });
        }
        await this.repo.insertMany(inserts);
        await this.repo.updateMany(updates);
        return { active: lines.length, omitted };
    }

    async applyVariation(
        workspaceId: WorkspaceId, projectId: ProjectId, input: { variationId: string; voSeq: number; lines: readonly CostCodeVariationLine[] },
    ): Promise<Result<string[], DomainError>> {
        const all = await this.repo.listByProject(workspaceId, projectId);
        const byId = new Map(all.map(c => [c.id, c]));
        if (input.lines.some(l => l.costCodeId !== null && !byId.has(l.costCodeId))) return err(DomainError.notFound('CostCode'));

        const now = this.clock.now();
        const codes = new Set(all.map(c => c.code));
        const changed = new Map<string, CostCode>();
        const inserts: CostCode[] = [];
        const out: string[] = [];
        let n = 0;
        let sort = maxSort(all);
        for (const line of input.lines) {
            if (line.costCodeId !== null) {
                const base = changed.get(line.costCodeId) ?? byId.get(line.costCodeId);
                if (base === undefined) continue; // checked above
                const voQty = roundQty(base.voQty + line.qtyDelta);
                const voCost = round2(base.voCost + line.costAmount);
                const cutToZero = line.qtyDelta < 0 && roundQty(base.baselineQty + voQty) <= 0;
                changed.set(base.id, {
                    ...base, voQty, voCost, budgetTotal: round2(base.baselineTotal + voCost),
                    voContractAmount: round2(base.voContractAmount + line.sellAmount), status: cutToZero ? 'omitted' : base.status, updatedAt: now,
                });
                out.push(base.id);
                continue;
            }
            let code: string;
            do {
                n += 1;
                code = `VO${input.voSeq}-${n}`;
            } while (codes.has(code));
            codes.add(code);
            sort += 1;
            const cost = round2(line.costAmount);
            const created: CostCode = {
                id: this.ids.newId(), workspaceId, projectId, code, source: 'variation', sourceRef: input.variationId,
                sectionNo: line.sectionNo, lineKey: line.lineKey, descTh: line.descTh, descEn: line.descEn, unit: line.unit, sort,
                baselineQty: 0, baselineMatUnit: 0, baselineLabUnit: 0, baselineMat: 0, baselineLab: 0, baselineTotal: 0,
                voQty: roundQty(line.qtyDelta), voCost: cost, budgetTotal: cost, contractAmount: 0, voContractAmount: round2(line.sellAmount),
                reportedProgress: 0, certifiedProgress: 0, status: 'active', createdAt: now, updatedAt: now,
            };
            inserts.push(created);
            out.push(created.id);
        }
        await this.repo.updateMany([...changed.values()]);
        await this.repo.insertMany(inserts);
        return ok(out);
    }

    async setReportedProgress(
        workspaceId: WorkspaceId, projectId: ProjectId, entries: readonly { costCodeId: string; progress: number }[],
    ): Promise<void> {
        await this.setProgress(workspaceId, projectId, entries, 'reportedProgress');
    }

    async setCertifiedProgress(
        workspaceId: WorkspaceId, projectId: ProjectId, entries: readonly { costCodeId: string; progress: number }[],
    ): Promise<void> {
        await this.setProgress(workspaceId, projectId, entries, 'certifiedProgress');
    }

    private async setProgress(
        workspaceId: WorkspaceId, projectId: ProjectId, entries: readonly { costCodeId: string; progress: number }[],
        field: 'reportedProgress' | 'certifiedProgress',
    ): Promise<void> {
        const found = new Map((await this.repo.findMany(workspaceId, projectId, entries.map(e => e.costCodeId))).map(c => [c.id, c]));
        const now = this.clock.now();
        const updates = new Map<string, CostCode>();
        for (const e of entries) {
            const c = found.get(e.costCodeId);
            if (c !== undefined) updates.set(c.id, { ...c, [field]: clampProgress(e.progress), updatedAt: now });
        }
        await this.repo.updateMany([...updates.values()]);
    }

    async allocateContractAmounts(
        workspaceId: WorkspaceId, projectId: ProjectId, input: { total: number; lines?: readonly CostCodeContractLine[] },
    ): Promise<Result<ContractAllocationResult, DomainError>> {
        const all = await this.repo.listByProject(workspaceId, projectId);
        const lines = input.lines?.map(l => ({ lineKey: l.lineKey, weight: l.sellAmount }));
        const result = allocateContractAmounts(input.total, all, lines);
        if (!result.allocated) {
            return err(DomainError.unprocessable('the project has no cost codes to allocate the contract value to', { reason: 'no_cost_codes' }));
        }
        const now = this.clock.now();
        const updates = all
            .filter(c => (result.amounts.get(c.id) ?? 0) !== c.contractAmount)
            .map(c => ({ ...c, contractAmount: result.amounts.get(c.id) ?? 0, updatedAt: now }));

        const codes = new Set(all.map(c => c.code));
        let n = all.reduce((m, c) => {
            const match = /^X-(\d+)$/.exec(c.code);
            return match === null ? m : Math.max(m, Number(match[1]));
        }, 0);
        let sort = maxSort(all);
        const inserts: CostCode[] = [];
        for (const { index, amount } of result.unmatched) {
            const line = input.lines?.[index];
            if (line === undefined) continue;
            let code: string;
            do {
                n += 1;
                code = `X-${n}`;
            } while (codes.has(code));
            codes.add(code);
            sort += 1;
            inserts.push({
                id: this.ids.newId(), workspaceId, projectId, code, source: 'manual', sourceRef: null,
                sectionNo: line.sectionNo, lineKey: line.lineKey, descTh: line.descTh, descEn: line.descEn, unit: line.unit, sort,
                baselineQty: 0, baselineMatUnit: 0, baselineLabUnit: 0, baselineMat: 0, baselineLab: 0, baselineTotal: 0,
                voQty: 0, voCost: 0, budgetTotal: 0, contractAmount: amount, voContractAmount: 0,
                reportedProgress: 0, certifiedProgress: 0, status: 'active', createdAt: now, updatedAt: now,
            });
        }
        await this.repo.updateMany(updates);
        await this.repo.insertMany(inserts);
        return ok({ created: inserts.length, uncoveredCount: result.uncoveredCount });
    }
}

/** Implements BaselineControl (lock inside the caller's transaction, status, baseline snapshot). */
@Injectable()
export class BaselineService extends BaselineControl {
    constructor(
        private readonly baselines: BaselineRepository,
        private readonly versions: BoqVersionRepository,
        private readonly recorder: BoqVersionRecorder,
        private readonly costCodes: CostCodeService,
        private readonly writer: RevisionWriter,
        private readonly revisions: RevisionLookup,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {
        super();
    }

    async lock(
        workspaceId: WorkspaceId, projectId: ProjectId,
        input: { versionId?: string; reason: BaselineInfo['reason']; contractId: string | null; by: UserId },
    ): Promise<Result<BaselineInfo, DomainError>> {
        return this.uow.run(async (): Promise<Result<BaselineInfo, DomainError>> => {
            await this.versions.lockProject(workspaceId, projectId);
            if (await this.baselines.active(workspaceId, projectId) !== undefined) {
                return err(DomainError.conflict('The BOQ baseline is already locked', { reason: 'baseline_already_locked' }));
            }

            let version: BoqVersionRecord | undefined;
            if (input.versionId !== undefined) {
                version = await this.versions.findById(input.versionId);
                if (version?.workspaceId !== workspaceId || version.projectId !== projectId) return err(DomainError.notFound('BoqVersion'));
            } else {
                const created = await this.writer.create(workspaceId, projectId, { label: await this.nextLabel(workspaceId, projectId), by: input.by });
                if (!created.ok) return created;
                // The revision hook made the version when the module is active; make sure of it either way.
                const all = await this.recorder.syncInTransaction(workspaceId, projectId);
                version = all.find(v => v.revisionId === created.value.id);
                if (version === undefined) {
                    return err(DomainError.unprocessable('the project no longer computes', { reason: 'project_does_not_compute' }));
                }
            }

            await this.versions.setKind(workspaceId, version.id, 'baseline');
            const rows = await this.versions.rows(workspaceId, version.id);
            const counts = await this.costCodes.syncFromLines(workspaceId, projectId, rows.lines);
            const now = this.clock.now();
            const record: BaselineRecord = {
                id: this.ids.newId(), workspaceId, projectId, versionId: version.id, status: 'active', reason: input.reason,
                contractId: input.contractId, lockedBy: input.by, lockedAt: now, unlockedBy: null, unlockedAt: null, unlockReason: '',
            };
            await this.baselines.insert(record);
            await this.audit.record({
                workspaceId, projectId, actor: input.by, entityType: 'project_baseline', entityId: record.id, action: 'lock',
                data: {
                    versionId: version.id, versionNo: version.versionNo, reason: input.reason, contractId: input.contractId,
                    costCodes: counts.active, omitted: counts.omitted, constructionTotal: version.constructionTotal,
                },
            });
            return ok(this.info(record, version));
        });
    }

    async status(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineInfo | undefined> {
        const active = await this.baselines.active(workspaceId, projectId);
        if (active === undefined) return undefined;
        const version = await this.versions.findById(active.versionId);
        return version === undefined ? undefined : this.info(active, version);
    }

    async baselineProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BoqProject | undefined> {
        const active = await this.status(workspaceId, projectId);
        return active === undefined ? undefined : this.revisions.snapshot(workspaceId, projectId, active.revisionId);
    }

    /** `BASELINE-<n>`: n = baselines so far + 1, skipping labels already taken by a revision. */
    private async nextLabel(workspaceId: WorkspaceId, projectId: ProjectId): Promise<string> {
        const taken = new Set((await this.revisions.list(workspaceId, projectId)).map(r => r.label));
        let n = (await this.baselines.listByProject(workspaceId, projectId)).length + 1;
        while (taken.has(`BASELINE-${n}`)) n += 1;
        return `BASELINE-${n}`;
    }

    private info(b: BaselineRecord, version: BoqVersionRecord): BaselineInfo {
        return {
            id: b.id, workspaceId: b.workspaceId, projectId: b.projectId, versionId: b.versionId, revisionId: version.revisionId,
            status: b.status, reason: b.reason, contractId: b.contractId, lockedBy: b.lockedBy, lockedAt: b.lockedAt,
        };
    }
}

/** Builds BaselineStatusDto (shared by get / lock / unlock). */
@Injectable()
export class BaselineViews {
    constructor(
        private readonly baselines: BaselineRepository,
        private readonly versions: BoqVersionRepository,
        private readonly costCodes: CostCodeRepository,
        private readonly revisions: RevisionLookup,
        private readonly guards: BaselineUnlockGuards,
    ) {}

    async status(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineStatusDto> {
        const history = await this.baselines.listByProject(workspaceId, projectId);
        const labels = new Map<string, string>((await this.revisions.list(workspaceId, projectId)).map(r => [r.id, r.label]));
        const dtos: BaselineDto[] = [];
        for (const b of history) {
            const version = await this.versions.findById(b.versionId);
            dtos.push({
                id: b.id,
                projectId: b.projectId,
                versionId: b.versionId,
                versionNo: version?.versionNo ?? 0,
                label: version === undefined ? '' : labels.get(version.revisionId) ?? '',
                status: b.status,
                reason: b.reason,
                contractId: b.contractId,
                lockedBy: b.lockedBy,
                lockedAt: b.lockedAt.toISOString(),
                unlockedBy: b.unlockedBy,
                unlockedAt: b.unlockedAt?.toISOString() ?? null,
                unlockReason: b.unlockReason,
            });
        }
        const active = dtos.find(b => b.status === 'active') ?? null;
        const codes = await this.costCodes.listByProject(workspaceId, projectId);
        return {
            locked: active !== null,
            baseline: active,
            history: dtos,
            costCodeCount: codes.filter(c => c.status === 'active').length,
            unlockBlockers: active === null ? [] : await this.guards.blockers(workspaceId, projectId),
        };
    }
}

/** GET /projects/:projectId/baseline — `projects.read`. */
@Injectable()
export class GetBaselineUseCase {
    constructor(private readonly access: ModuleAccess, private readonly views: BaselineViews) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<BaselineStatusDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['projects.read'], write: false });
        if (!grant.ok) return grant;
        return ok(await this.views.status(grant.value.workspaceId, projectId));
    }
}

/** POST /projects/:projectId/baseline — `boq.baseline.lock`. */
@Injectable()
export class LockBaselineUseCase {
    constructor(private readonly access: ModuleAccess, private readonly control: BaselineService, private readonly views: BaselineViews) {}

    async execute(userId: UserId, projectId: ProjectId, body: LockBaselineRequest): Promise<Result<BaselineStatusDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['boq.baseline.lock'], write: true });
        if (!grant.ok) return grant;
        const locked = await this.control.lock(grant.value.workspaceId, projectId, {
            versionId: body.versionId?.toLowerCase(), reason: body.reason, contractId: null, by: userId,
        });
        if (!locked.ok) return locked;
        return ok(await this.views.status(grant.value.workspaceId, projectId));
    }
}

/** POST /projects/:projectId/baseline/unlock — `boq.baseline.unlock`; refused while a BaselineUnlockGuards blocker exists. */
@Injectable()
export class UnlockBaselineUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly baselines: BaselineRepository,
        private readonly versions: BoqVersionRepository,
        private readonly guards: BaselineUnlockGuards,
        private readonly audit: AuditLog,
        private readonly views: BaselineViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, projectId: ProjectId, body: UnlockBaselineRequest): Promise<Result<BaselineStatusDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['boq.baseline.unlock'], write: true });
        if (!grant.ok) return grant;
        const { workspaceId } = grant.value;
        const done = await this.uow.run(async (): Promise<Result<void, DomainError>> => {
            await this.versions.lockProject(workspaceId, projectId);
            const active = await this.baselines.active(workspaceId, projectId);
            if (active === undefined) return err(DomainError.conflict('The BOQ baseline is not locked', { reason: 'baseline_not_locked' }));
            const blockers = await this.guards.blockers(workspaceId, projectId);
            if (blockers.length > 0) {
                return err(DomainError.conflict('The baseline cannot be unlocked', { reason: 'baseline_unlock_blocked', blockers }));
            }
            await this.baselines.markUnlocked(workspaceId, active.id, { by: userId, at: this.clock.now(), reason: body.reason });
            await this.audit.record({
                workspaceId, projectId, actor: userId, entityType: 'project_baseline', entityId: active.id, action: 'unlock',
                data: { versionId: active.versionId, reason: body.reason },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return ok(await this.views.status(workspaceId, projectId));
    }
}

const toCostCodeDto = (c: CostCode, seeCost: boolean): CostCodeDto => ({
    id: c.id,
    projectId: c.projectId,
    code: c.code,
    source: c.source,
    sourceRef: c.sourceRef,
    sectionNo: c.sectionNo,
    lineKey: c.lineKey,
    descTh: c.descTh,
    descEn: c.descEn,
    unit: c.unit,
    sort: c.sort,
    baselineQty: c.baselineQty,
    voQty: c.voQty,
    baselineMatUnit: seeCost ? c.baselineMatUnit : null,
    baselineLabUnit: seeCost ? c.baselineLabUnit : null,
    baselineMat: seeCost ? c.baselineMat : null,
    baselineLab: seeCost ? c.baselineLab : null,
    baselineTotal: seeCost ? c.baselineTotal : null,
    voCost: seeCost ? c.voCost : null,
    budgetTotal: seeCost ? c.budgetTotal : null,
    contractAmount: c.contractAmount,
    voContractAmount: c.voContractAmount,
    reportedProgress: c.reportedProgress,
    certifiedProgress: c.certifiedProgress,
    status: c.status,
    updatedAt: c.updatedAt.toISOString(),
});

/** GET /projects/:projectId/cost-codes — `projects.read`; costs only with `cost.read`. */
@Injectable()
export class ListCostCodesUseCase {
    constructor(private readonly access: ModuleAccess, private readonly costCodes: CostCodeService) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<CostCodeDto[], DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['projects.read'], write: false });
        if (!grant.ok) return grant;
        const seeCost = can(grant.value.role, 'cost.read');
        return ok((await this.costCodes.listByProject(grant.value.workspaceId, projectId)).map(c => toCostCodeDto(c, seeCost)));
    }
}
