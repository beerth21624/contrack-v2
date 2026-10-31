// ─── Progress claim use cases (docs/erp/04-implementation-plan.md WP-29, docs/erp/02-domain-model.md §4.1) ───
// Read `billing.read`; create / edit / submit / certify / invoice / cancel `billing.manage`.
import { Injectable } from '@nestjs/common';
import type {
    CertifyArClaimRequest, ArClaimDto, ArClaimLineInput, ArClaimSummaryDto, CreateArClaimRequest, InvoiceArClaimRequest, InvoiceDto, InvoiceLine,
    PatchArClaimRequest,
} from '@contrack/contract';
import { AR_CLAIM_OPEN_STATUSES } from '@contrack/contract';
import { invoiceAmountsFromClaim, type ClaimBreakdown } from '@contrack/domain/billing';
import { addDays, bangkokToday } from '@contrack/domain/dates/business-date';
import { round2 } from '@contrack/domain/money';
import type { ProjectGrant } from '../../../../shared/application/module-access';
import {
    Approvals, AuditLog, Clock, CostCodeLookup, IdGenerator, type MainContractInfo, MainContracts, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import {
    BILLABLE_CONTRACT, INVOICE_TEXT, claimText, defaultCumProgress, effectiveMilestoneStatus, weightedProgress,
} from '../../domain/billing-rules';
import { requireClaimStatus, requireClaimTransition } from '../../domain/billing-state';
import { BillingAccess, ClaimCalculator, InvoiceIssuer, previousClaims, transact } from '../billing.service';
import { BillingViews, claimSummaryDto, invoiceDto } from '../billing-views';
import { BillingRepository, type ClaimLineRecord, type ClaimRecord, type InvoiceRecord } from '../ports/billing.repository';

const contractNotBillable = (status: string): DomainError =>
    DomainError.conflict('The contract is not signed', { reason: 'contract_not_signed', status });

/** Lines with the inputs merged in by cost code (400 `unknown_cost_code` for a cost code not on the claim). */
function mergeLines(lines: readonly ClaimLineRecord[], inputs: readonly ArClaimLineInput[] | undefined): Result<ClaimLineRecord[], DomainError> {
    if (inputs === undefined) return ok([...lines]);
    const byCode = new Map(lines.map(l => [l.costCodeId, { ...l }]));
    for (const i of inputs) {
        const line = byCode.get(i.costCodeId.toLowerCase());
        if (line === undefined) return err(DomainError.validation('The cost code is not on this claim', { reason: 'unknown_cost_code', costCodeId: i.costCodeId }));
        line.cumProgress = i.cumProgress;
        if (i.note !== undefined) line.note = i.note;
    }
    return ok([...byCode.values()]);
}

function checkPeriod(from: string | null, to: string | null): Result<void, DomainError> {
    if (from !== null && to !== null && to < from) return err(DomainError.validation('periodTo is before periodFrom', { reason: 'finish_before_start' }));
    return ok(undefined);
}

/** The claim's amounts in the shape of `invoiceAmountsFromClaim` (stored values, computed by the server). */
const breakdownOf = (c: ClaimRecord): ClaimBreakdown => ({
    workValue: c.workValue, previousValue: c.previousValue, cumulativeValue: c.cumulativeValue, isFinal: c.isFinal, lines: [],
    advanceRecovery: c.advanceRecovery, retention: c.retention,
    penalty: { baseValue: 0, computed: c.penalty, max: c.penaltyMax, amount: c.penalty }, k: c.escalationK, escalation: c.escalation,
    otherDeduction: c.otherDeduction, vatBase: c.vatBase, vat: c.vat, wht: c.wht, payable: c.payable,
});

const notPositive = (): DomainError =>
    DomainError.unprocessable('The claim amount must be above zero', { reason: 'claim_amount_not_positive' });

// ── reads ──

/** GET /main-contracts/:contractId/claims — `billing.read`, by claim number. */
@Injectable()
export class ListClaimsUseCase {
    constructor(private readonly access: BillingAccess, private readonly repo: BillingRepository) {}

    async execute(userId: UserId, contractId: string): Promise<Result<ArClaimSummaryDto[], DomainError>> {
        const loaded = await this.access.contract(userId, contractId, ['billing.read'], false);
        if (!loaded.ok) return loaded;
        return ok((await this.repo.claimsOfContract(loaded.value.grant.workspaceId, loaded.value.contract.id)).map(claimSummaryDto));
    }
}

/** GET /claims/:claimId — `billing.read`, with its lines. */
@Injectable()
export class GetClaimUseCase {
    constructor(private readonly access: BillingAccess, private readonly views: BillingViews) {}

    async execute(userId: UserId, claimId: string): Promise<Result<ArClaimDto, DomainError>> {
        const loaded = await this.access.claim(userId, claimId, ['billing.read'], false);
        if (!loaded.ok) return loaded;
        return ok(await this.views.claim(loaded.value.grant, loaded.value.claim));
    }
}

async function fresh(repo: BillingRepository, views: BillingViews, grant: ProjectGrant, claimId: string): Promise<Result<ArClaimDto, DomainError>> {
    const c = await repo.findClaim(claimId);
    return c === undefined ? err(DomainError.notFound('Claim')) : ok(await views.claim(grant, c));
}

// ── writes ──

/**
 * POST /main-contracts/:contractId/claims — `billing.manage`, signed (or completed) contract, no other open claim
 * (409 `claim_open`). Progress mode: a line per active cost code with a selling amount (contract + accepted VO),
 * cumulative progress from the site reports; milestone mode: the claimable work / final milestone → `claimed`.
 */
@Injectable()
export class CreateClaimUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly costCodes: CostCodeLookup,
        private readonly calculator: ClaimCalculator,
        private readonly views: BillingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: CreateArClaimRequest }): Promise<Result<ArClaimDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.contract(userId, input.contractId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const period = checkPeriod(body.periodFrom ?? null, body.periodTo ?? null);
        if (!period.ok) return period;

        const done = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const contract = await this.contracts.find(ws, loaded.value.contract.id);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            if (!BILLABLE_CONTRACT.includes(contract.status)) return err(contractNotBillable(contract.status));
            const all = await this.repo.claimsOfContract(ws, contract.id);
            if (all.some(c => AR_CLAIM_OPEN_STATUSES.includes(c.status))) {
                return err(DomainError.conflict('Finish or cancel the open claim first', { reason: 'claim_open' }));
            }
            const costCodes = await this.costCodes.listByProject(ws, contract.projectId);

            let milestoneId: string | null = null;
            if (contract.billingMode === 'milestone') {
                if (body.milestoneId === undefined) return err(DomainError.validation('A milestone-billed contract claims a milestone', { reason: 'milestone_required' }));
                const m = contract.milestones.find(x => x.id === body.milestoneId?.toLowerCase());
                if (m === undefined) return err(DomainError.notFound('Milestone'));
                if (m.kind === 'advance') {
                    return err(DomainError.unprocessable('The advance payment is billed with the advance invoice', { reason: 'advance_milestone' }));
                }
                const status = effectiveMilestoneStatus(m, {
                    contractStatus: contract.status, today: bangkokToday(this.clock.now()), progress: weightedProgress(costCodes),
                });
                // D-227: a `manual` milestone is "pressed" by making its claim (no other place marks it claimable).
                if (status !== 'claimable' && !(status === 'planned' && m.trigger === 'manual')) {
                    return err(DomainError.conflict('The milestone cannot be claimed yet', { reason: 'milestone_not_claimable', status }));
                }
                milestoneId = m.id;
            } else if (body.milestoneId !== undefined) {
                return err(DomainError.validation('A progress-billed contract does not claim milestones', { reason: 'milestone_not_allowed' }));
            }

            // Progress claimed so far per cost code: the latest earlier claim that has the line.
            const previous = previousClaims(all, '').sort((a, b) => a.claimNo - b.claimNo);
            const prevLines = await this.repo.linesOf(ws, previous.map(c => c.id));
            const prevByCode = new Map<string, ClaimLineRecord>();
            for (const c of previous) for (const l of prevLines) if (l.claimId === c.id) prevByCode.set(l.costCodeId, l);

            const id = this.ids.newId();
            const lines: ClaimLineRecord[] = costCodes
                .filter(cc => cc.status === 'active' && round2(cc.contractAmount + cc.voContractAmount) !== 0)
                .map(cc => {
                    const prev = prevByCode.get(cc.id);
                    const prevProgress = prev?.cumProgress ?? 0;
                    return {
                        claimId: id, costCodeId: cc.id, workspaceId: ws, contractAmount: round2(cc.contractAmount + cc.voContractAmount),
                        prevProgress, cumProgress: defaultCumProgress(cc.reportedProgress, prevProgress), prevAmount: prev?.cumAmount ?? 0,
                        cumAmount: 0, thisAmount: 0, note: '',
                    };
                });
            if (contract.billingMode === 'progress' && lines.length === 0) {
                return err(DomainError.unprocessable('The project has no priced cost codes to claim', { reason: 'no_cost_codes' }));
            }
            const now = this.clock.now();
            const base: ClaimRecord = {
                id, workspaceId: ws, projectId: contract.projectId, contractId: contract.id, milestoneId, mode: contract.billingMode,
                claimNo: all.reduce((max, c) => Math.max(max, c.claimNo), 0) + 1, periodFrom: body.periodFrom ?? null, periodTo: body.periodTo ?? null,
                status: 'draft', workValue: 0, cumulativeValue: 0, previousValue: 0, isFinal: false, advanceRecovery: 0, retention: 0,
                penalty: 0, penaltyDays: 0, penaltyOverride: null, penaltyMax: 0, escalation: 0, escalationK: null, escalationIndices: {},
                otherDeduction: 0, otherDeductionNote: '', vatBase: 0, vat: 0, wht: 0, payable: 0, certifiedByName: '', certifiedAt: null,
                certifiedNote: '', invoiceId: null, createdBy: userId, createdAt: now, updatedAt: now,
            };
            const computed = await this.calculator.compute(contract, base, lines);
            if (!computed.ok) return computed;
            await this.repo.insertClaim(computed.value.claim);
            await this.repo.replaceLines(ws, id, computed.value.lines);
            if (milestoneId !== null) {
                const marked = await this.contracts.markMilestone(ws, milestoneId, 'claimed');
                if (!marked.ok) return marked;
            }
            await this.audit.record({
                workspaceId: ws, projectId: contract.projectId, actor: userId, entityType: 'ar_claim', entityId: id, action: 'create_claim',
                data: { claimNo: base.claimNo, milestoneId, workValue: computed.value.claim.workValue, payable: computed.value.claim.payable },
            });
            return ok(id);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, done.value);
    }
}

/** PATCH /claims/:claimId — `billing.manage`, draft or submitted; lines / period / deductions, amounts recomputed. */
@Injectable()
export class PatchClaimUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly calculator: ClaimCalculator,
        private readonly views: BillingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; claimId: string; body: PatchArClaimRequest }): Promise<Result<ArClaimDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.claim(userId, input.claimId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockClaim(ws, loaded.value.claim.id);
            if (c === undefined) return err(DomainError.notFound('Claim'));
            const allowed = requireClaimStatus(c.status, ['draft', 'submitted']);
            if (!allowed.ok) return allowed;
            const contract = await this.contracts.find(ws, c.contractId);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            const merged = mergeLines(await this.repo.linesOf(ws, [c.id]), body.lines);
            if (!merged.ok) return merged;
            const next: ClaimRecord = {
                ...c,
                periodFrom: body.periodFrom !== undefined ? body.periodFrom : c.periodFrom,
                periodTo: body.periodTo !== undefined ? body.periodTo : c.periodTo,
                penaltyDays: body.penaltyDays ?? c.penaltyDays,
                penaltyOverride: body.penaltyOverride !== undefined ? (body.penaltyOverride === null ? null : round2(body.penaltyOverride)) : c.penaltyOverride,
                escalationIndices: body.escalationIndices ?? c.escalationIndices,
                otherDeduction: body.otherDeduction !== undefined ? round2(body.otherDeduction) : c.otherDeduction,
                otherDeductionNote: body.otherDeductionNote ?? c.otherDeductionNote,
                updatedAt: this.clock.now(),
            };
            const period = checkPeriod(next.periodFrom, next.periodTo);
            if (!period.ok) return period;
            const computed = await this.calculator.compute(contract, next, merged.value);
            if (!computed.ok) return computed;
            await this.repo.saveClaim(computed.value.claim);
            await this.repo.replaceLines(ws, c.id, computed.value.lines);
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: userId, entityType: 'ar_claim', entityId: c.id, action: 'edit',
                data: {
                    workValue: [c.workValue, computed.value.claim.workValue], payable: [c.payable, computed.value.claim.payable],
                    penalty: [c.penalty, computed.value.claim.penalty], lines: body.lines?.length ?? 0,
                },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, loaded.value.claim.id);
    }
}

/**
 * POST /claims/:claimId/submit — `billing.manage`, draft → approval `claim.submit`: approved at once (auto-skip) →
 * submitted; otherwise pending_approval until decided (BillingHandlers.onApprovalDecided).
 */
@Injectable()
export class SubmitClaimUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly calculator: ClaimCalculator,
        private readonly approvals: Approvals,
        private readonly views: BillingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; claimId: string }): Promise<Result<ArClaimDto, DomainError>> {
        const { userId } = input;
        const loaded = await this.access.claim(userId, input.claimId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<string | null, DomainError>> => {
            const c = await this.repo.lockClaim(ws, loaded.value.claim.id);
            if (c === undefined) return err(DomainError.notFound('Claim'));
            const allowed = requireClaimStatus(c.status, ['draft']);
            if (!allowed.ok) return allowed;
            const contract = await this.contracts.find(ws, c.contractId);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            const computed = await this.calculator.compute(contract, c, await this.repo.linesOf(ws, [c.id]));
            if (!computed.ok) return computed;
            const claim = computed.value.claim;
            if (claim.vatBase <= 0) return err(notPositive());
            const ticket = await this.approvals.request({
                workspaceId: ws, subject: 'claim.submit', subjectId: c.id, projectId: c.projectId, amount: round2(Math.max(0, claim.payable)),
                title: `${contract.number ?? contract.title} #${c.claimNo}`, requestedBy: userId, requesterRole: grant.role,
            });
            if (!ticket.ok) return ticket;
            const to = ticket.value.status === 'approved' ? 'submitted' : 'pending_approval';
            await this.repo.saveClaim({ ...claim, status: to, updatedAt: this.clock.now() });
            await this.repo.replaceLines(ws, c.id, computed.value.lines);
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: userId, entityType: 'ar_claim', entityId: c.id, action: 'submit',
                data: { status: [c.status, to], approvalRequestId: ticket.value.requestId, payable: claim.payable },
            });
            return ok(to === 'pending_approval' ? ticket.value.requestId : null);
        });
        if (!done.ok) return done;
        if (done.value !== null) await this.approvals.notifyRequested(done.value);
        return fresh(this.repo, this.views, grant, loaded.value.claim.id);
    }
}

/** POST /claims/:claimId/certify — `billing.manage`, submitted → certified (inspector's name; lines may be adjusted). */
@Injectable()
export class CertifyClaimUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly calculator: ClaimCalculator,
        private readonly views: BillingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; claimId: string; body: CertifyArClaimRequest }): Promise<Result<ArClaimDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.claim(userId, input.claimId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockClaim(ws, loaded.value.claim.id);
            if (c === undefined) return err(DomainError.notFound('Claim'));
            const allowed = requireClaimTransition(c.status, 'certified');
            if (!allowed.ok) return allowed;
            const contract = await this.contracts.find(ws, c.contractId);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            const merged = mergeLines(await this.repo.linesOf(ws, [c.id]), body.lines);
            if (!merged.ok) return merged;
            const computed = await this.calculator.compute(contract, c, merged.value);
            if (!computed.ok) return computed;
            if (computed.value.claim.vatBase <= 0) return err(notPositive());
            const now = this.clock.now();
            await this.repo.saveClaim({
                ...computed.value.claim, status: 'certified', certifiedByName: body.certifiedByName,
                certifiedAt: body.certifiedAt ?? bangkokToday(now), certifiedNote: body.note ?? '', updatedAt: now,
            });
            await this.repo.replaceLines(ws, c.id, computed.value.lines);
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: userId, entityType: 'ar_claim', entityId: c.id, action: 'certify',
                data: { status: [c.status, 'certified'], certifiedByName: body.certifiedByName, payable: computed.value.claim.payable },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, loaded.value.claim.id);
    }
}

/** Lines printed on a claim invoice: the work (Σ = W), the advance recovered (−A), the escalation (E). Σ = net. */
function claimInvoiceLines(c: ClaimRecord, contract: MainContractInfo): InvoiceLine[] {
    const m = c.milestoneId === null ? undefined : contract.milestones.find(x => x.id === c.milestoneId);
    const work = m === undefined ? claimText(c.claimNo) : { th: m.labelTh, en: m.labelEn || m.labelTh };
    const lines: InvoiceLine[] = [{ descTh: work.th, descEn: work.en, amount: c.workValue }];
    if (c.advanceRecovery !== 0) lines.push({ descTh: INVOICE_TEXT.advanceRecovery.th, descEn: INVOICE_TEXT.advanceRecovery.en, amount: -c.advanceRecovery });
    if (c.escalation !== 0) lines.push({ descTh: INVOICE_TEXT.escalation.th, descEn: INVOICE_TEXT.escalation.en, amount: c.escalation });
    return lines;
}

/**
 * POST /claims/:claimId/invoice — `billing.manage`, certified → invoiced. One transaction: invoice issued (`INV`),
 * retention withheld / advance recovered on the ledgers, certified progress on the cost codes, `fin_events`
 * (`ar.invoiced`, `ar.retention_withheld`, `ar.advance_recovered`, `ar.penalty`), milestone → invoiced.
 */
@Injectable()
export class InvoiceClaimUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly costCodes: CostCodeLookup,
        private readonly issuer: InvoiceIssuer,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; claimId: string; body: InvoiceArClaimRequest }): Promise<Result<InvoiceDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.claim(userId, input.claimId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<InvoiceRecord, DomainError>> => {
            const c = await this.repo.lockClaim(ws, loaded.value.claim.id);
            if (c === undefined) return err(DomainError.notFound('Claim'));
            const allowed = requireClaimTransition(c.status, 'invoiced');
            if (!allowed.ok) return allowed;
            const contract = await this.contracts.find(ws, c.contractId);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            if (!BILLABLE_CONTRACT.includes(contract.status)) return err(contractNotBillable(contract.status));
            if (c.vatBase <= 0) return err(notPositive());

            const now = this.clock.now();
            const issueDate = body.issueDate ?? bangkokToday(now);
            const amounts = invoiceAmountsFromClaim(breakdownOf(c));
            const draft: InvoiceRecord = {
                id: this.ids.newId(), workspaceId: ws, projectId: c.projectId, contractId: contract.id, claimId: c.id, milestoneId: c.milestoneId,
                customerId: contract.customerId, kind: 'invoice', source: 'claim', number: null, status: 'draft', issueDate,
                dueDate: body.dueDate ?? addDays(issueDate, contract.terms.paymentTermDays), language: body.language ?? contract.language,
                customerSnapshot: null, companySnapshot: null, lines: claimInvoiceLines(c, contract), ...amounts, paidAmount: 0,
                relatedInvoiceId: null, note: body.note ?? '', voidReason: '', issuedBy: null, issuedAt: null, createdBy: userId,
                createdAt: now, updatedAt: now,
            };
            const issued = await this.issuer.issue(draft, userId);
            if (!issued.ok) return issued;
            const inv = issued.value;
            await this.repo.insertInvoice(inv);

            if (c.retention > 0) {
                await this.repo.insertRetentionEntry({
                    id: this.ids.newId(), workspaceId: ws, contractId: contract.id, projectId: c.projectId, kind: 'withheld', amount: c.retention,
                    claimId: c.id, invoiceId: inv.id, entryDate: issueDate, note: '', createdBy: userId, createdAt: now,
                });
            }
            if (c.advanceRecovery > 0) {
                await this.repo.insertAdvanceEntry({
                    id: this.ids.newId(), workspaceId: ws, contractId: contract.id, projectId: c.projectId, kind: 'recovered',
                    amount: c.advanceRecovery, invoiceId: inv.id, claimId: c.id, receiptId: null, entryDate: issueDate, createdBy: userId, createdAt: now,
                });
            }
            const lines = await this.repo.linesOf(ws, [c.id]);
            if (lines.length > 0) {
                await this.costCodes.setCertifiedProgress(ws, c.projectId, lines.map(l => ({ costCodeId: l.costCodeId, progress: l.cumProgress })));
            }

            const posted = [
                await this.issuer.post(inv, 'ar.invoiced', { net: inv.net, vat: inv.vat, wht: inv.whtExpected, retention: inv.retention }, userId, {
                    payable: inv.payable, advanceRecovery: inv.advanceRecovery, penalty: inv.penalty, claimNo: c.claimNo,
                }),
                c.retention > 0 ? await this.issuer.post(inv, 'ar.retention_withheld', { net: c.retention, retention: c.retention }, userId) : ok(undefined),
                c.advanceRecovery > 0 ? await this.issuer.post(inv, 'ar.advance_recovered', { net: c.advanceRecovery }, userId) : ok(undefined),
                c.penalty > 0 ? await this.issuer.post(inv, 'ar.penalty', { net: c.penalty }, userId, { penaltyDays: c.penaltyDays }) : ok(undefined),
            ];
            for (const r of posted) if (!r.ok) return r;

            if (c.milestoneId !== null) {
                const marked = await this.contracts.markMilestone(ws, c.milestoneId, 'invoiced');
                if (!marked.ok) return marked;
            }
            await this.repo.saveClaim({ ...c, status: 'invoiced', invoiceId: inv.id, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: userId, entityType: 'ar_claim', entityId: c.id, action: 'invoice',
                data: { status: [c.status, 'invoiced'], invoiceId: inv.id, number: inv.number, net: inv.net, payable: inv.payable },
            });
            return ok(inv);
        });
        if (!done.ok) return done;
        return ok(invoiceDto(done.value));
    }
}

/** POST /claims/:claimId/cancel — `billing.manage`; draft / pending_approval (withdrawn) / submitted; milestone back to claimable. */
@Injectable()
export class CancelClaimUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly approvals: Approvals,
        private readonly views: BillingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; claimId: string }): Promise<Result<ArClaimDto, DomainError>> {
        const loaded = await this.access.claim(input.userId, input.claimId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockClaim(ws, loaded.value.claim.id);
            if (c === undefined) return err(DomainError.notFound('Claim'));
            const allowed = requireClaimTransition(c.status, 'cancelled');
            if (!allowed.ok) return allowed;
            if (c.status === 'pending_approval') await this.approvals.cancel(ws, 'claim.submit', c.id, input.userId);
            // Back to claimable; refused (nothing written) when the contract has ended meanwhile, which is fine.
            if (c.milestoneId !== null) await this.contracts.markMilestone(ws, c.milestoneId, 'claimable');
            await this.repo.saveClaim({ ...c, status: 'cancelled', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: input.userId, entityType: 'ar_claim', entityId: c.id, action: 'cancel',
                data: { status: [c.status, 'cancelled'] },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, loaded.value.claim.id);
    }
}
