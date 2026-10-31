// ─── Main contract use cases (docs/erp/04-implementation-plan.md WP-26, docs/erp/02-domain-model.md §3) ───
// Read `contracts.read`; create / edit / sign / terminate / cancel / close `contracts.manage`.
import { Injectable } from '@nestjs/common';
import type {
    AddSignedScanRequest, CloseMainContractRequest, CreateMainContractRequest, MainContractDto, PatchMainContractRequest,
    ProjectCommercialSettings, ProjectMainContractDto, PutContractMilestonesRequest, SignMainContractRequest, SignMainContractResponse,
    TerminateMainContractRequest,
} from '@contrack/contract';
import { bangkokToday, daysBetween } from '@contrack/domain/dates/business-date';
import { MAIN_CONTRACT_TEMPLATE_EN, MAIN_CONTRACT_TEMPLATE_TH } from '@contrack/domain/erp/main-contract-template';
import { sanitizeDocumentHtml } from '@contrack/domain/erp/html-sanitize';
import { defaultProjectTypeFor, resolveSettings } from '@contrack/domain/erp/profiles';
import { round2 } from '@contrack/domain/money';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    type AcceptedQuotation, AuditLog, BaselineControl, Clock, CompanyProfiles, CostCodeLookup, CustomerLookup, DocumentNumbering, FileService,
    IdGenerator, ProjectCatalog, ProjectLifecycle, QuotationLookup, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import {
    type MilestoneDraft, type PlannedMilestone, defaultTerms, draftsFromInput, draftsFromTemplate, draftsOf, planMilestones,
} from '../../domain/main-contract-rules';
import { requireDraft, requireStatus, requireTransition } from '../../domain/main-contract-state';
import { MainContractRepository, type MainContractRecord, type MilestoneRecord } from '../ports/main-contract.repository';
import { MainContractViews } from '../main-contract-views';
import { MODULE, MainContractAccess, transact } from '../main-contract.service';

const contractExists = (): DomainError =>
    DomainError.conflict('The project already has a contract; cancel or terminate it first', { reason: 'contract_exists' });

/** start ≤ finish, else 400 `finish_before_start`. */
function checkDates(start: string | null, finish: string | null): Result<void, DomainError> {
    if (start !== null && finish !== null && finish < start) {
        return err(DomainError.validation('finishDate is before startDate', { reason: 'finish_before_start' }));
    }
    return ok(undefined);
}

const durationOf = (start: string | null, finish: string | null): number | null =>
    start !== null && finish !== null ? daysBetween(start, finish) + 1 : null;

/** Rows of planned milestones; ids of `keep` reused by `no` (a draft's milestones are replaced as a whole). */
function milestoneRows(c: MainContractRecord, planned: readonly PlannedMilestone[], keep: readonly MilestoneRecord[], newId: () => string, now: Date): MilestoneRecord[] {
    const byNo = new Map(keep.map(m => [m.no, m]));
    return planned.map(p => {
        const old = byNo.get(p.no);
        return {
            ...p, id: old?.id ?? newId(), contractId: c.id, workspaceId: c.workspaceId, projectId: c.projectId,
            createdAt: old?.createdAt ?? now, updatedAt: now,
        };
    });
}

/** The project's commercial terms (hub project type + settings over the company defaults), VAT, hub dates and customer. */
@Injectable()
export class ContractSettings {
    constructor(private readonly company: CompanyProfiles, private readonly lifecycle: ProjectLifecycle, private readonly catalog: ProjectCatalog) {}

    async of(workspaceId: WorkspaceId, projectId: ProjectId): Promise<{
        settings: ProjectCommercialSettings; vatRate: number; customerId: string | null; plannedStart: string | null;
        plannedFinish: string | null; projectName: string;
    }> {
        const profile = await this.company.get(workspaceId);
        const hub = await this.lifecycle.hubFields(workspaceId, projectId);
        const type = hub?.projectType ?? profile.defaultProjectType ?? defaultProjectTypeFor(profile.businessProfiles);
        return {
            settings: resolveSettings(type, profile.defaults, hub?.settings ?? {}),
            vatRate: profile.vatRegistered ? profile.vatRate : 0,
            customerId: hub?.customerId ?? null,
            plannedStart: hub?.plannedStart ?? null,
            plannedFinish: hub?.plannedFinish ?? null,
            projectName: (await this.catalog.find(workspaceId, projectId))?.name ?? '',
        };
    }
}

/** A customer of the workspace that may go on a contract: not_found / conflict `customer_archived`. */
async function checkCustomer(customers: CustomerLookup, workspaceId: WorkspaceId, customerId: string): Promise<Result<string, DomainError>> {
    const customer = await customers.find(workspaceId, customerId.toLowerCase());
    if (customer === undefined) return err(DomainError.notFound('Customer'));
    if (customer.archivedAt !== null) return err(DomainError.conflict('The customer is archived', { reason: 'customer_archived' }));
    return ok(customer.id);
}

// ── reads ──

/** GET /projects/:projectId/main-contract — `contracts.read`. */
@Injectable()
export class GetProjectMainContractUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: MainContractRepository, private readonly views: MainContractViews) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<ProjectMainContractDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['contracts.read'], write: false });
        if (!grant.ok) return grant;
        return ok(await this.views.project(grant.value, await this.repo.listByProject(grant.value.workspaceId, projectId)));
    }
}

/** GET /main-contracts/:contractId — `contracts.read`. */
@Injectable()
export class GetMainContractUseCase {
    constructor(private readonly contracts: MainContractAccess, private readonly views: MainContractViews) {}

    async execute(userId: UserId, contractId: string): Promise<Result<MainContractDto, DomainError>> {
        const loaded = await this.contracts.contract(userId, contractId, ['contracts.read'], false);
        if (!loaded.ok) return loaded;
        return ok(await this.views.contract(loaded.value.grant, loaded.value.contract));
    }
}

/** Re-reads a contract after a change. */
async function fresh(repo: MainContractRepository, views: MainContractViews, grant: ProjectGrant, contractId: string): Promise<Result<MainContractDto, DomainError>> {
    const c = await repo.findContract(contractId);
    return c === undefined ? err(DomainError.notFound('MainContract')) : ok(await views.contract(grant, c));
}

// ── writes ──

/**
 * POST /projects/:projectId/main-contract — `contracts.manage`. From an accepted quotation: value = its `vatBase`,
 * margin snapshot, milestones from its payment terms; or empty (`customerId` + `originalValue`). Terms from the
 * project's commercial settings. One effective contract per project (409 `contract_exists`).
 */
@Injectable()
export class CreateMainContractUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: MainContractRepository,
        private readonly quotations: QuotationLookup,
        private readonly customers: CustomerLookup,
        private readonly settings: ContractSettings,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: CreateMainContractRequest }): Promise<Result<MainContractDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['contracts.manage'], write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        if (await this.repo.effectiveForProject(ws, projectId) !== undefined) return err(contractExists());

        let accepted: AcceptedQuotation | undefined;
        if (body.quotationId !== undefined) {
            const r = await this.quotations.accepted(ws, body.quotationId);
            if (!r.ok) return r;
            if (r.value.projectId !== projectId) return err(DomainError.notFound('Quotation'));
            accepted = r.value;
        }
        const s = await this.settings.of(ws, projectId);
        const rawCustomer = body.customerId ?? accepted?.customerId ?? s.customerId;
        if (rawCustomer === null) {
            return err(DomainError.unprocessable('The contract needs a customer', { reason: 'customer_required' }));
        }
        const customerId = await checkCustomer(this.customers, ws, rawCustomer);
        if (!customerId.ok) return customerId;

        const startDate = body.startDate ?? s.plannedStart;
        const finishDate = body.finishDate ?? s.plannedFinish;
        const dates = checkDates(startDate, finishDate);
        if (!dates.ok) return dates;

        const billingMode = body.billingMode ?? s.settings.billingMode;
        const terms = defaultTerms(s.settings);
        const originalValue = round2(body.originalValue ?? accepted?.vatBase ?? 0);
        const template = accepted !== undefined && accepted.paymentTerms.length > 0 ? accepted.paymentTerms : s.settings.milestoneTemplate;
        const drafts: MilestoneDraft[] = billingMode === 'milestone' ? draftsFromTemplate(template) : [];
        const title = body.title !== undefined && body.title !== '' ? body.title : accepted?.title !== undefined && accepted.title !== '' ? accepted.title : s.projectName;

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            if (await this.repo.effectiveForProject(ws, projectId) !== undefined) return err(contractExists());
            const now = this.clock.now();
            const c: MainContractRecord = {
                id: this.ids.newId(), workspaceId: ws, projectId, customerId: customerId.value,
                quotationId: accepted?.quotationId ?? null, quotationVersionId: accepted?.versionId ?? null,
                quotedMarginPct: accepted === undefined ? null : accepted.marginPct, number: null, status: 'draft', title,
                language: body.language ?? accepted?.language ?? s.settings.documentLanguage, signDate: null, startDate, finishDate,
                durationDays: durationOf(startDate, finishDate), billingMode, originalValue, currentValue: originalValue, vatRate: s.vatRate,
                extensionDays: 0, terms, bodyTh: MAIN_CONTRACT_TEMPLATE_TH, bodyEn: MAIN_CONTRACT_TEMPLATE_EN, customerSnapshot: null,
                companySnapshot: null, signedScanFileIds: [], completedAt: null, closedAt: null, terminatedAt: null, terminationReason: '',
                createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insertContract(c);
            const planned = planMilestones(drafts, originalValue, terms.advancePct);
            await this.repo.replaceMilestones(ws, c.id, milestoneRows(c, planned, [], () => this.ids.newId(), now));
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'main_contract', entityId: c.id, action: 'create',
                data: { quotationId: c.quotationId, quotationVersionId: c.quotationVersionId, originalValue, billingMode, milestones: planned.length },
            });
            return ok(c.id);
        });
        if (!created.ok) return created;
        return fresh(this.repo, this.views, grant.value, created.value);
    }
}

/** PATCH /main-contracts/:contractId — `contracts.manage`, draft only (signed → 409 `already_issued`). */
@Injectable()
export class PatchMainContractUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly customers: CustomerLookup,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: PatchMainContractRequest }): Promise<Result<MainContractDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.contracts.contract(userId, input.contractId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        let customerId: string | undefined;
        if (body.customerId !== undefined && body.customerId.toLowerCase() !== loaded.value.contract.customerId) {
            const checked = await checkCustomer(this.customers, ws, body.customerId);
            if (!checked.ok) return checked;
            customerId = checked.value;
        }

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockContract(ws, loaded.value.contract.id);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const draft = requireDraft(c.status);
            if (!draft.ok) return draft;
            const startDate = body.startDate !== undefined ? body.startDate : c.startDate;
            const finishDate = body.finishDate !== undefined ? body.finishDate : c.finishDate;
            const dates = checkDates(startDate, finishDate);
            if (!dates.ok) return dates;
            const datesChanged = body.startDate !== undefined || body.finishDate !== undefined;
            const durationDays = body.durationDays !== undefined
                ? body.durationDays
                : datesChanged ? (durationOf(startDate, finishDate) ?? c.durationDays) : c.durationDays;
            const originalValue = body.originalValue !== undefined ? round2(body.originalValue) : c.originalValue;
            const terms = body.terms ?? c.terms;
            const now = this.clock.now();
            const next: MainContractRecord = {
                ...c,
                title: body.title ?? c.title,
                language: body.language ?? c.language,
                customerId: customerId ?? c.customerId,
                originalValue,
                currentValue: originalValue,
                vatRate: body.vatRate ?? c.vatRate,
                billingMode: body.billingMode ?? c.billingMode,
                signDate: body.signDate !== undefined ? body.signDate : c.signDate,
                startDate, finishDate, durationDays, terms,
                bodyTh: body.bodyTh !== undefined ? sanitizeDocumentHtml(body.bodyTh) : c.bodyTh,
                bodyEn: body.bodyEn !== undefined ? sanitizeDocumentHtml(body.bodyEn) : c.bodyEn,
                updatedAt: now,
            };
            await this.repo.saveContract(next);
            if (originalValue !== c.originalValue || terms.advancePct !== c.terms.advancePct) {
                const existing = await this.repo.milestonesOf(ws, [c.id]);
                const planned = planMilestones(draftsOf(existing), originalValue, terms.advancePct);
                await this.repo.replaceMilestones(ws, c.id, milestoneRows(next, planned, existing, () => this.ids.newId(), now));
            }
            const changed: Record<string, unknown> = {};
            for (const key of ['title', 'language', 'customerId', 'originalValue', 'vatRate', 'billingMode', 'signDate', 'startDate', 'finishDate', 'durationDays'] as const) {
                if (next[key] !== c[key]) changed[key] = [c[key], next[key]];
            }
            if (body.terms !== undefined) changed.terms = true;
            if (next.bodyTh !== c.bodyTh || next.bodyEn !== c.bodyEn) changed.body = true;
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: userId, entityType: 'main_contract', entityId: c.id, action: 'update', data: changed,
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, loaded.value.contract.id);
    }
}

/** PUT /main-contracts/:contractId/milestones — `contracts.manage`, draft only; the advance one follows the terms. */
@Injectable()
export class PutContractMilestonesUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: PutContractMilestonesRequest }): Promise<Result<MainContractDto, DomainError>> {
        const loaded = await this.contracts.contract(input.userId, input.contractId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const drafts = draftsFromInput(input.body.milestones);
        const codeIds = [...new Set(drafts.flatMap(d => d.costCodeIds))];
        if (codeIds.length > 0) {
            const found = await this.costCodes.findMany(ws, loaded.value.contract.projectId, codeIds);
            if (found.length < codeIds.length) return err(DomainError.notFound('CostCode'));
        }

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockContract(ws, loaded.value.contract.id);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const draft = requireDraft(c.status);
            if (!draft.ok) return draft;
            const now = this.clock.now();
            const existing = await this.repo.milestonesOf(ws, [c.id]);
            const planned = planMilestones(drafts, c.originalValue, c.terms.advancePct);
            await this.repo.replaceMilestones(ws, c.id, milestoneRows(c, planned, existing, () => this.ids.newId(), now));
            await this.repo.saveContract({ ...c, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: input.userId, entityType: 'main_contract', entityId: c.id, action: 'milestones',
                data: { count: [existing.filter(m => m.kind !== 'advance').length, drafts.length] },
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, loaded.value.contract.id);
    }
}

/**
 * POST /main-contracts/:contractId/sign — `contracts.manage`. In one transaction: number `CT`; the baseline locked from
 * the accepted quotation's BOQ version when the BOQ is not locked yet (an existing baseline is kept); the contract
 * value spread over the cost codes (Σ contract_amount = original_value); milestone amounts fixed; snapshots of seller
 * and buyer; project → `in_progress`; audit.
 */
@Injectable()
export class SignMainContractUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly quotations: QuotationLookup,
        private readonly customers: CustomerLookup,
        private readonly company: CompanyProfiles,
        private readonly numbering: DocumentNumbering,
        private readonly baseline: BaselineControl,
        private readonly costCodes: CostCodeLookup,
        private readonly lifecycle: ProjectLifecycle,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: SignMainContractRequest }): Promise<Result<SignMainContractResponse, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.contracts.contract(userId, input.contractId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;

        const signed = await transact(this.uow, async (): Promise<Result<{ allocation: SignMainContractResponse['allocation']; baselineLocked: boolean }, DomainError>> => {
            const c = await this.repo.lockContract(ws, loaded.value.contract.id);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const draft = requireDraft(c.status);
            if (!draft.ok) return draft;
            const milestones = await this.repo.milestonesOf(ws, [c.id]);
            if (c.billingMode === 'milestone' && !milestones.some(m => m.kind !== 'advance')) {
                return err(DomainError.unprocessable('A milestone-billed contract needs its milestones', { reason: 'milestones_required' }));
            }
            const customer = await this.customers.find(ws, c.customerId);
            if (customer === undefined) return err(DomainError.notFound('Customer'));
            const signDate = body.signDate ?? c.signDate ?? bangkokToday(this.clock.now());
            const startDate = body.startDate ?? c.startDate;
            const dates = checkDates(startDate, c.finishDate);
            if (!dates.ok) return dates;

            const issued = await this.numbering.issue({
                workspaceId: ws, docType: 'contract', issueDate: signDate, subjectType: 'main_contract', subjectId: c.id,
                projectId: c.projectId, issuedBy: userId,
            });
            if (!issued.ok) return issued;

            // The accepted quotation's BOQ version (only while it is still the version the contract was made from).
            let boqVersionId: string | undefined;
            if (c.quotationId !== null) {
                const accepted = await this.quotations.accepted(ws, c.quotationId);
                if (accepted.ok && accepted.value.versionId === c.quotationVersionId) boqVersionId = accepted.value.boqVersionId ?? undefined;
            }
            let baselineLocked = false;
            if (await this.baseline.status(ws, c.projectId) === undefined) {
                const locked = await this.baseline.lock(ws, c.projectId, { versionId: boqVersionId, reason: 'contract_signed', contractId: c.id, by: userId });
                if (!locked.ok) return locked;
                baselineLocked = true;
            }
            const lines = c.quotationVersionId === null ? [] : await this.quotations.contractLines(ws, c.quotationVersionId);
            const allocation = await this.costCodes.allocateContractAmounts(ws, c.projectId, {
                total: c.originalValue, ...(lines.length > 0 ? { lines } : {}),
            });
            if (!allocation.ok) return allocation;

            const now = this.clock.now();
            const planned = planMilestones(draftsOf(milestones), c.originalValue, c.terms.advancePct)
                .map(p => (p.trigger === 'signing' ? { ...p, status: 'claimable' as const } : p));
            // Still a draft: nothing refers to its milestones yet, so they are replaced (ids kept by `no`).
            await this.repo.replaceMilestones(ws, c.id, milestoneRows(c, planned, milestones, () => this.ids.newId(), now));
            const companySnapshot = await this.company.snapshot(ws, c.language);
            const customerSnapshot = await this.customers.snapshot(ws, c.customerId, c.language);
            if (customerSnapshot === undefined) return err(DomainError.notFound('Customer'));
            await this.repo.saveContract({
                ...c, status: 'signed', number: issued.value.number, signDate, startDate, currentValue: c.originalValue,
                companySnapshot, customerSnapshot, updatedAt: now,
            });
            await this.lifecycle.advance(ws, c.projectId, 'in_progress', userId);
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: userId, entityType: 'main_contract', entityId: c.id, action: 'sign',
                data: {
                    status: [c.status, 'signed'], number: issued.value.number, signDate, originalValue: c.originalValue, baselineLocked,
                    created: allocation.value.created, uncoveredCount: allocation.value.uncoveredCount,
                },
            });
            return ok({ allocation: allocation.value, baselineLocked });
        });
        if (!signed.ok) return signed;
        const contract = await fresh(this.repo, this.views, grant, loaded.value.contract.id);
        if (!contract.ok) return contract;
        return ok({ contract: contract.value, allocation: signed.value.allocation, baselineLocked: signed.value.baselineLocked });
    }
}

/** POST /main-contracts/:contractId/terminate — `contracts.manage`, signed → terminated (reason required). */
@Injectable()
export class TerminateMainContractUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: TerminateMainContractRequest }): Promise<Result<MainContractDto, DomainError>> {
        const loaded = await this.contracts.contract(input.userId, input.contractId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockContract(ws, loaded.value.contract.id);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const allowed = requireTransition(c.status, 'terminated');
            if (!allowed.ok) return allowed;
            const now = this.clock.now();
            const terminatedAt = input.body.date ?? bangkokToday(now);
            await this.repo.saveContract({ ...c, status: 'terminated', terminatedAt, terminationReason: input.body.reason, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: input.userId, entityType: 'main_contract', entityId: c.id, action: 'terminate',
                data: { status: [c.status, 'terminated'], terminatedAt, reason: input.body.reason },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, loaded.value.grant, loaded.value.contract.id);
    }
}

/** POST /main-contracts/:contractId/cancel — `contracts.manage`, draft → cancelled. */
@Injectable()
export class CancelMainContractUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string }): Promise<Result<MainContractDto, DomainError>> {
        const loaded = await this.contracts.contract(input.userId, input.contractId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockContract(ws, loaded.value.contract.id);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const allowed = requireTransition(c.status, 'cancelled');
            if (!allowed.ok) return allowed;
            await this.repo.saveContract({ ...c, status: 'cancelled', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: input.userId, entityType: 'main_contract', entityId: c.id, action: 'cancel',
                data: { status: [c.status, 'cancelled'] },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, loaded.value.grant, loaded.value.contract.id);
    }
}

/**
 * POST /main-contracts/:contractId/close — `contracts.manage`, completed → closed once the warranty is over and every
 * guarantee is back (409 `guarantees_active` while one is still active).
 */
@Injectable()
export class CloseMainContractUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: CloseMainContractRequest }): Promise<Result<MainContractDto, DomainError>> {
        const loaded = await this.contracts.contract(input.userId, input.contractId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockContract(ws, loaded.value.contract.id);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const allowed = requireTransition(c.status, 'closed');
            if (!allowed.ok) return allowed;
            const active = (await this.repo.guaranteesOf(ws, c.id)).filter(g => g.status === 'active').length;
            if (active > 0) return err(DomainError.conflict('Return every guarantee before closing the contract', { reason: 'guarantees_active', count: active }));
            const now = this.clock.now();
            const closedAt = input.body.date ?? bangkokToday(now);
            await this.repo.saveContract({ ...c, status: 'closed', closedAt, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: input.userId, entityType: 'main_contract', entityId: c.id, action: 'close',
                data: { status: [c.status, 'closed'], closedAt },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, loaded.value.grant, loaded.value.contract.id);
    }
}

/** POST /main-contracts/:contractId/signed-scan — `contracts.manage`; appends scans of the signed paper (not on a cancelled contract). */
@Injectable()
export class AddSignedScanUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly files: FileService,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: AddSignedScanRequest }): Promise<Result<MainContractDto, DomainError>> {
        const loaded = await this.contracts.contract(input.userId, input.contractId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const fileIds = [...new Set(input.body.fileIds.map(id => id.toLowerCase()))];
        const uploaded = await this.files.assertUploadedBy(fileIds, input.userId);
        if (!uploaded.ok) return uploaded;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockContract(ws, loaded.value.contract.id);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const allowed = requireStatus(c.status, ['draft', 'signed', 'completed', 'closed', 'terminated']);
            if (!allowed.ok) return allowed;
            const added = fileIds.filter(id => !c.signedScanFileIds.includes(id));
            if (added.length === 0) return ok(undefined);
            if (c.signedScanFileIds.length + added.length > 50) return err(DomainError.validation('At most 50 scans per contract'));
            await this.repo.saveContract({ ...c, signedScanFileIds: [...c.signedScanFileIds, ...added], updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: input.userId, entityType: 'main_contract', entityId: c.id, action: 'attach_scan',
                data: { fileIds: added },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, loaded.value.grant, loaded.value.contract.id);
    }
}
