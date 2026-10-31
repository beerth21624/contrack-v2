// ─── Shared parts of billing: access, claim computation, issuing invoices, what the module plugs into core registries ───
import { Injectable } from '@nestjs/common';
import type { FinEventType, ProjectRollup } from '@contrack/contract';
import { advanceTotals, computeClaim, claimLineIssues, type ClaimLineInput } from '@contrack/domain/billing';
import { round2, sumMoney } from '@contrack/domain/money';
import { type ProjectGrant, ModuleAccess } from '../../../shared/application/module-access';
import {
    type ApprovalDecidedEvent, AuditLog, Clock, CompanyProfiles, CustomerLookup, DocumentNumbering, FinancialEvents,
    type MainContractInfo, MainContracts, ModuleFlags, UnitOfWork,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import type { Permission } from '../../../shared/domain/permissions';
import { type Result, err, ok, okVoid } from '../../../shared/domain/result';
import { BillingRepository, type ClaimLineRecord, type ClaimRecord, type InvoiceRecord } from './ports/billing.repository';

export const MODULE = 'billing';
/** Kinds / sources that count as billed (a retention release only pays back money billed before). */
const BILLED_SOURCES = new Set(['claim', 'advance']);
const LIVE_INVOICE = (i: InvoiceRecord): boolean => i.status !== 'draft' && i.status !== 'voided';

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

/** Loads a contract / claim / invoice by id and authorizes the caller on its project (stranger or unknown id → not_found). */
@Injectable()
export class BillingAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: BillingRepository, private readonly contracts: MainContracts) {}

    async contract(
        userId: UserId, contractId: string, permissions: Permission[], write: boolean,
    ): Promise<Result<{ grant: ProjectGrant; contract: MainContractInfo }, DomainError>> {
        const where = await this.contracts.locate(contractId);
        if (where === undefined) return err(DomainError.notFound('MainContract'));
        const grant = await this.access.toProject(userId, where.projectId, MODULE, { permissions, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('MainContract')) : grant;
        const contract = await this.contracts.find(grant.value.workspaceId, contractId);
        if (contract === undefined) return err(DomainError.notFound('MainContract'));
        return ok({ grant: grant.value, contract });
    }

    async claim(userId: UserId, claimId: string, permissions: Permission[], write: boolean): Promise<Result<{ grant: ProjectGrant; claim: ClaimRecord }, DomainError>> {
        if (!isUuid(claimId)) return err(DomainError.notFound('Claim'));
        const claim = await this.repo.findClaim(claimId.toLowerCase());
        if (claim === undefined) return err(DomainError.notFound('Claim'));
        const grant = await this.access.toProject(userId, claim.projectId, MODULE, { permissions, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Claim')) : grant;
        if (grant.value.workspaceId !== claim.workspaceId) return err(DomainError.notFound('Claim'));
        return ok({ grant: grant.value, claim });
    }

    async invoice(
        userId: UserId, invoiceId: string, permissions: Permission[], write: boolean,
    ): Promise<Result<{ grant: { workspaceId: WorkspaceId; role: ProjectGrant['role']; archived: boolean }; invoice: InvoiceRecord }, DomainError>> {
        if (!isUuid(invoiceId)) return err(DomainError.notFound('Invoice'));
        const invoice = await this.repo.findInvoice(invoiceId.toLowerCase());
        if (invoice === undefined) return err(DomainError.notFound('Invoice'));
        const grant = invoice.projectId === null
            ? await this.access.inWorkspace(userId, invoice.workspaceId, MODULE, ...permissions)
            : await this.access.toProject(userId, invoice.projectId, MODULE, { permissions, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Invoice')) : grant;
        if (grant.value.workspaceId !== invoice.workspaceId) return err(DomainError.notFound('Invoice'));
        const archived = 'archived' in grant.value && grant.value.archived === true;
        return ok({ grant: { workspaceId: grant.value.workspaceId, role: grant.value.role, archived }, invoice });
    }

    async project(userId: UserId, projectId: ProjectId, permissions: Permission[]): Promise<Result<ProjectGrant, DomainError>> {
        return this.access.toProject(userId, projectId, MODULE, { permissions, write: false });
    }
}

/** Claims counted as "before" a claim: certified or invoiced, other than itself (one claim is open at a time). */
export const previousClaims = (all: readonly ClaimRecord[], claimId: string): ClaimRecord[] =>
    all.filter(c => c.id !== claimId && (c.status === 'certified' || c.status === 'invoiced'));

const roundRate = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Recomputes every amount of a claim from its lines, deductions and the contract (the client's figures are never used). */
@Injectable()
export class ClaimCalculator {
    constructor(private readonly repo: BillingRepository) {}

    async compute(
        contract: MainContractInfo, claim: ClaimRecord, lines: readonly ClaimLineRecord[],
    ): Promise<Result<{ claim: ClaimRecord; lines: ClaimLineRecord[] }, DomainError>> {
        const ws = claim.workspaceId;
        const previous = previousClaims(await this.repo.claimsOfContract(ws, contract.id), claim.id);
        const received = advanceTotals(await this.repo.advanceEntries(ws, contract.id)).received;
        const inputs: ClaimLineInput[] = lines.map(l => ({
            costCodeId: l.costCodeId, contractAmount: l.contractAmount, prevProgress: l.prevProgress,
            cumProgress: roundRate(l.cumProgress), prevAmount: l.prevAmount, note: l.note,
        }));
        const issue = claimLineIssues(inputs)[0];
        if (issue !== undefined) {
            return err(DomainError.validation('A claim line is not valid', { reason: issue.reason, costCodeId: issue.costCodeId }));
        }
        const milestone = claim.milestoneId === null ? undefined : contract.milestones.find(m => m.id === claim.milestoneId);
        if (claim.mode === 'milestone' && milestone === undefined) return err(DomainError.notFound('Milestone'));
        const b = computeClaim({
            mode: claim.mode,
            lines: inputs,
            milestoneAmount: milestone?.amount,
            milestoneKind: milestone?.kind === 'final' ? 'final' : 'work',
            currentValue: contract.currentValue,
            previousValue: sumMoney(previous.map(c => c.workValue)),
            vatRate: contract.vatRate,
            terms: contract.terms,
            advance: { received, recovered: sumMoney(previous.map(c => c.advanceRecovery)) },
            retentionWithheldSoFar: sumMoney(previous.map(c => c.retention)),
            penalty: { days: claim.penaltyDays, previousTotal: sumMoney(previous.map(c => c.penalty)), override: claim.penaltyOverride },
            escalationIndices: claim.escalationIndices,
            otherDeduction: claim.otherDeduction,
        });
        const wanted = round2(claim.penaltyOverride ?? b.penalty.computed);
        if (wanted > b.penalty.max) {
            return err(DomainError.unprocessable('The penalty is above the cap left on the contract', {
                reason: 'penalty_cap_exceeded', max: b.penalty.max, requested: wanted,
            }));
        }
        const byCode = new Map(lines.map(l => [l.costCodeId, l]));
        return ok({
            claim: {
                ...claim,
                workValue: b.workValue, previousValue: b.previousValue, cumulativeValue: b.cumulativeValue, isFinal: b.isFinal,
                advanceRecovery: b.advanceRecovery, retention: b.retention, penalty: b.penalty.amount, penaltyMax: b.penalty.max,
                escalation: b.escalation, escalationK: b.k, otherDeduction: b.otherDeduction, vatBase: b.vatBase, vat: b.vat, wht: b.wht,
                payable: b.payable,
            },
            lines: b.lines.map(l => ({
                claimId: claim.id, costCodeId: l.costCodeId, workspaceId: ws, contractAmount: round2(l.contractAmount),
                prevProgress: l.prevProgress, cumProgress: l.cumProgress, prevAmount: round2(l.prevAmount), cumAmount: l.cumAmount,
                thisAmount: l.thisAmount, note: byCode.get(l.costCodeId)?.note ?? '',
            })),
        });
    }
}

/** Numbers an invoice and copies the seller / buyer blocks onto it; posts its money events (source `ar_invoice`). */
@Injectable()
export class InvoiceIssuer {
    constructor(
        private readonly numbering: DocumentNumbering,
        private readonly company: CompanyProfiles,
        private readonly customers: CustomerLookup,
        private readonly events: FinancialEvents,
        private readonly clock: Clock,
    ) {}

    /** The invoice as issued (not saved): number `INV`, snapshots, status `issued`. Call inside the transaction. */
    async issue(inv: InvoiceRecord, by: UserId): Promise<Result<InvoiceRecord, DomainError>> {
        if (inv.dueDate < inv.issueDate) return err(DomainError.validation('dueDate is before issueDate', { reason: 'due_before_issue' }));
        const customerSnapshot = await this.customers.snapshot(inv.workspaceId, inv.customerId, inv.language);
        if (customerSnapshot === undefined) return err(DomainError.notFound('Customer'));
        const issued = await this.numbering.issue({
            workspaceId: inv.workspaceId, docType: 'invoice', issueDate: inv.issueDate, subjectType: 'ar_invoice', subjectId: inv.id,
            projectId: inv.projectId, issuedBy: by,
        });
        if (!issued.ok) return issued;
        const companySnapshot = await this.company.snapshot(inv.workspaceId, inv.language);
        const now = this.clock.now();
        return ok({
            ...inv, number: issued.value.number, status: 'issued', customerSnapshot, companySnapshot, issuedBy: by, issuedAt: now, updatedAt: now,
        });
    }

    /** One money event of an issued invoice (counterparty = the invoice's customer snapshot). */
    async post(
        inv: InvoiceRecord, type: FinEventType, amounts: { net: number; vat?: number; wht?: number; retention?: number },
        by: UserId, data: Record<string, unknown> = {},
    ): Promise<Result<void, DomainError>> {
        const r = await this.events.post(inv.workspaceId, {
            projectId: inv.projectId, eventDate: inv.issueDate, eventType: type, direction: 'none', counterpartyType: 'customer',
            counterpartyId: inv.customerId, counterpartyName: inv.customerSnapshot?.name ?? '', counterpartyTaxId: inv.customerSnapshot?.taxId ?? '',
            counterpartyBranch: inv.customerSnapshot?.branchCode ?? '', docType: 'invoice', docNumber: inv.number, docDate: inv.issueDate,
            sourceType: 'ar_invoice', sourceId: inv.id, net: amounts.net, vat: amounts.vat ?? 0, wht: amounts.wht ?? 0,
            retention: amounts.retention ?? 0, cash: 0, data: { contractId: inv.contractId, claimId: inv.claimId, ...data }, by,
        });
        return r.ok ? okVoid() : r;
    }

    /** Reverses every event of an invoice that is not reversed yet (void). */
    async reverseAll(inv: InvoiceRecord, by: UserId, date: string): Promise<Result<void, DomainError>> {
        const events = await this.events.bySource(inv.workspaceId, 'ar_invoice', inv.id);
        const reversed = new Set(events.flatMap(e => (e.reversesId === null ? [] : [e.reversesId])));
        for (const e of events) {
            if (e.reversesId !== null || reversed.has(e.id)) continue;
            const r = await this.events.reverse(inv.workspaceId, e.id, { by, date, note: 'void' });
            if (!r.ok) return r;
        }
        return okVoid();
    }
}

/** HubRollups, BaselineUnlockGuards, ProjectDeletionGuards and ApprovalHandlers('claim.submit') (BillingModule.onModuleInit). */
@Injectable()
export class BillingHandlers {
    constructor(
        private readonly repo: BillingRepository,
        private readonly flags: ModuleFlags,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /** billedToDate = Σ net of the issued (not voided) claim and advance invoices. */
    async rollup(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, Partial<ProjectRollup>>> {
        const out = new Map<ProjectId, Partial<ProjectRollup>>();
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return out;
        const totals = new Map<ProjectId, number[]>();
        for (const i of await this.repo.invoicesOfProjects(workspaceId, projectIds)) {
            if (i.projectId === null || !LIVE_INVOICE(i) || !BILLED_SOURCES.has(i.source)) continue;
            totals.set(i.projectId, [...(totals.get(i.projectId) ?? []), i.net]);
        }
        for (const [projectId, nets] of totals) out.set(projectId, { billedToDate: sumMoney(nets) });
        return out;
    }

    /** Any claim that is not cancelled keeps the baseline locked. */
    async unlockBlockers(workspaceId: WorkspaceId, projectId: ProjectId): Promise<{ reason: string; count: number }[]> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return [];
        const count = (await this.repo.claimsOfProjects(workspaceId, [projectId])).filter(c => c.status !== 'cancelled').length;
        return count > 0 ? [{ reason: 'claims_exist', count }] : [];
    }

    /** Certified / invoiced claims keep the project (numbered invoices are refused by numbering's own guard). */
    async deletionBlockers(workspaceId: WorkspaceId, projectId: ProjectId): Promise<{ reason: string; count: number }[]> {
        const count = (await this.repo.claimsOfProjects(workspaceId, [projectId]))
            .filter(c => c.status === 'certified' || c.status === 'invoiced').length;
        return count > 0 ? [{ reason: 'claims_exist', count }] : [];
    }

    /** `claim.submit` decided: approved → submitted, rejected → back to draft. */
    async onApprovalDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const c = await this.repo.lockClaim(e.workspaceId, e.subjectId);
            // Withdrawn meanwhile: nothing to apply.
            if (c?.status !== 'pending_approval') return okVoid();
            const to = e.decision === 'approved' ? 'submitted' : 'draft';
            await this.repo.saveClaim({ ...c, status: to, updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: c.projectId, actor: e.decidedBy, entityType: 'ar_claim', entityId: c.id,
                action: e.decision === 'approved' ? 'submit' : 'approval_rejected', data: { status: [c.status, to], note: e.note },
            });
            return okVoid();
        });
    }
}
