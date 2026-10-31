// ─── Shared parts of the variation use cases: access, pricing, submit, the customer's answer and its effects ───
import { Injectable, Logger } from '@nestjs/common';
import type { ContractVariationBilling, VariationResponseAction } from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { priceVariationLine, variationTotals } from '@contrack/domain/variations/pricing';
import { type ProjectGrant, ModuleAccess } from '../../../shared/application/module-access';
import {
    AuditLog, Clock, CostCodeLookup, CustomerLookup, DocumentNumbering, type MainContractInfo, MainContracts, Notifier, ProjectCatalog,
    ProjectLifecycle, QuotationPricingLookup, type QuotationSellFactors, UnitOfWork, WorkspaceDirectory,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { type Permission, can } from '../../../shared/domain/permissions';
import { type Result, err, ok, okVoid } from '../../../shared/domain/result';
import { requireStatus } from '../domain/variation-state';
import { variationMilestoneLabel } from '../domain/variation-rules';
import {
    type VariationEvidenceRecord, type VariationLineRecord, VariationRepository, type VariationRecord,
} from './ports/variation.repository';

export const MODULE = 'variations';

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

export interface LoadedVariation {
    grant: ProjectGrant;
    variation: VariationRecord;
}

/** Loads a variation / evidence by id and authorizes the caller on its project (a stranger or unknown id → not_found). */
@Injectable()
export class VariationAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: VariationRepository) {}

    async variation(userId: UserId, variationId: string, permissions: Permission[], write: boolean): Promise<Result<LoadedVariation, DomainError>> {
        if (!isUuid(variationId)) return err(DomainError.notFound('Variation'));
        const variation = await this.repo.find(variationId.toLowerCase());
        if (variation === undefined) return err(DomainError.notFound('Variation'));
        const grant = await this.access.toProject(userId, variation.projectId, MODULE, { permissions, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Variation')) : grant;
        if (grant.value.workspaceId !== variation.workspaceId) return err(DomainError.notFound('Variation'));
        return ok({ grant: grant.value, variation });
    }

    async evidence(
        userId: UserId, evidenceId: string, permissions: Permission[], write: boolean,
    ): Promise<Result<LoadedVariation & { evidence: VariationEvidenceRecord }, DomainError>> {
        if (!isUuid(evidenceId)) return err(DomainError.notFound('VariationEvidence'));
        const evidence = await this.repo.findEvidence(evidenceId.toLowerCase());
        if (evidence === undefined) return err(DomainError.notFound('VariationEvidence'));
        const loaded = await this.variation(userId, evidence.variationId, permissions, write);
        if (!loaded.ok) return loaded.error.code === 'not_found' ? err(DomainError.notFound('VariationEvidence')) : loaded;
        return ok({ ...loaded.value, evidence });
    }
}

export const contractNotSigned = (status: string): DomainError =>
    DomainError.conflict('The project has no signed main contract', { reason: 'contract_not_signed', status });

export const invalidBillingOption = (): DomainError =>
    DomainError.unprocessable('next_claim needs a progress-billed contract', { reason: 'invalid_billing_option' });

/** `next_claim` only on a progress-billed contract (D-41). */
export function checkBilling(contract: Pick<MainContractInfo, 'billingMode'>, billing: ContractVariationBilling): Result<void, DomainError> {
    return billing === 'next_claim' && contract.billingMode !== 'progress' ? err(invalidBillingOption()) : okVoid();
}

/** A line before pricing (the server never trusts sell prices from the client). */
export type UnpricedLine = Omit<VariationLineRecord, 'costAmount' | 'sellUnit' | 'sellAmount' | 'sort'> & { costAmount?: number };

/** What an answer needs. */
export interface VariationAnswer {
    action: VariationResponseAction;
    name: string;
    note: string;
    at: Date;
    actor: UserId | null;
    via: 'link' | 'recorded';
}

@Injectable()
export class VariationWorkflow {
    private readonly logger = new Logger(VariationWorkflow.name);

    constructor(
        private readonly repo: VariationRepository,
        private readonly contracts: MainContracts,
        private readonly costCodes: CostCodeLookup,
        private readonly pricing: QuotationPricingLookup,
        private readonly customers: CustomerLookup,
        private readonly numbering: DocumentNumbering,
        private readonly lifecycle: ProjectLifecycle,
        private readonly catalog: ProjectCatalog,
        private readonly directory: WorkspaceDirectory,
        private readonly notifier: Notifier,
        private readonly audit: AuditLog,
        private readonly clock: Clock,
    ) {}

    /** The project's signed main contract, else conflict `contract_not_signed`. */
    async signedContract(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Result<MainContractInfo, DomainError>> {
        const c = await this.contracts.forProject(workspaceId, projectId);
        if (c?.status !== 'signed') return err(contractNotSigned(c?.status ?? 'none'));
        return ok(c);
    }

    async contractOf(v: VariationRecord): Promise<MainContractInfo | undefined> {
        return this.contracts.find(v.workspaceId, v.contractId);
    }

    async sellFactors(workspaceId: WorkspaceId, contract: MainContractInfo): Promise<QuotationSellFactors> {
        return this.pricing.sellFactors(workspaceId, contract.quotationVersionId);
    }

    /** Prices every line, numbers them in order and stores lines + totals (VAT at the contract's rate). */
    async storeLines(v: VariationRecord, lines: readonly UnpricedLine[], factors: QuotationSellFactors, vatRate: number): Promise<VariationRecord> {
        const priced: VariationLineRecord[] = lines.map((l, i) => ({ ...l, ...priceVariationLine(l, factors), sort: i + 1 }));
        await this.repo.replaceLines(v.workspaceId, v.id, priced);
        const totals = variationTotals(priced, vatRate);
        const next: VariationRecord = { ...v, ...totals, updatedAt: this.clock.now() };
        await this.repo.save(next);
        return next;
    }

    async projectName(workspaceId: WorkspaceId, projectId: ProjectId): Promise<string> {
        return (await this.catalog.find(workspaceId, projectId))?.name ?? '';
    }

    /** draft / pending_approval → submitted inside the caller's transaction (row locked): number `VO`, customer snapshot. */
    async submitLocked(v: VariationRecord, by: UserId): Promise<Result<VariationRecord, DomainError>> {
        const contract = await this.contractOf(v);
        if (contract?.status !== 'signed') return err(contractNotSigned(contract?.status ?? 'none'));
        const billing = checkBilling(contract, v.billing);
        if (!billing.ok) return billing;
        const now = this.clock.now();
        const issued = await this.numbering.issue({
            workspaceId: v.workspaceId, docType: 'variation', issueDate: bangkokToday(now), subjectType: 'variation', subjectId: v.id,
            projectId: v.projectId, issuedBy: by,
        });
        if (!issued.ok) return issued;
        const customerSnapshot = (await this.customers.snapshot(v.workspaceId, contract.customerId, v.language)) ?? null;
        const next: VariationRecord = { ...v, status: 'submitted', number: issued.value.number, customerSnapshot, submittedAt: now, updatedAt: now };
        await this.repo.save(next);
        await this.audit.record({
            workspaceId: v.workspaceId, projectId: v.projectId, actor: by, entityType: 'variation', entityId: v.id, action: 'submit',
            data: { status: [v.status, 'submitted'], number: next.number, sellTotal: v.sellTotal },
        });
        return ok(next);
    }

    /**
     * The customer's answer to a submitted VO inside the caller's transaction (row locked). Accept needs the evidence of
     * who asked and when (requested by + date) and either the link answer or ≥ 1 evidence item (422 `evidence_required`);
     * then, all or nothing: the main contract (value, extension, finish date, milestones), the cost codes (budget, VO
     * contract amount, new `VO{seq}-{n}` items), the project's planned finish.
     */
    async respondLocked(v: VariationRecord, answer: VariationAnswer): Promise<Result<VariationRecord, DomainError>> {
        const allowed = requireStatus(v.status, ['submitted']);
        if (!allowed.ok) return allowed;
        const now = this.clock.now();
        if (answer.action === 'reject') {
            const next: VariationRecord = { ...v, status: 'rejected', acceptedByName: answer.name, responseNote: answer.note, updatedAt: now };
            await this.repo.save(next);
            await this.audit.record({
                workspaceId: v.workspaceId, projectId: v.projectId, actor: answer.actor, entityType: 'variation', entityId: v.id,
                action: 'respond', data: { status: [v.status, 'rejected'], action: answer.action, via: answer.via, name: answer.name },
            });
            return ok(next);
        }

        const evidence = await this.repo.evidenceOf(v.workspaceId, v.id);
        if (v.requestedByName.trim() === '' || v.requestedDate === null || (answer.via !== 'link' && evidence.length === 0)) {
            return err(DomainError.unprocessable('Who asked for the change, when, and the customer\'s answer or evidence are needed', {
                reason: 'evidence_required',
            }));
        }
        const contract = await this.contractOf(v);
        if (contract?.status !== 'signed') return err(contractNotSigned(contract?.status ?? 'none'));
        const billing = checkBilling(contract, v.billing);
        if (!billing.ok) return billing;
        const lines = await this.repo.linesOf(v.workspaceId, v.id);

        const applied = await this.contracts.applyVariation(v.workspaceId, contract.id, {
            sellDelta: v.sellTotal, extensionDays: v.scheduleImpactDays, billing: v.billing, variationId: v.id,
            label: variationMilestoneLabel(v.number ?? `#${v.seqNo}`), by: answer.actor,
        });
        if (!applied.ok) return applied;
        const codeIds = await this.costCodes.applyVariation(v.workspaceId, v.projectId, {
            variationId: v.id, voSeq: v.seqNo,
            lines: lines.map(l => ({
                costCodeId: l.costCodeId, sectionNo: l.sectionNo, lineKey: l.lineKey, descTh: l.descTh, descEn: l.descEn, unit: l.unit,
                qtyDelta: l.qtyDelta, costAmount: l.costAmount, sellAmount: l.sellAmount,
            })),
        });
        if (!codeIds.ok) return codeIds;
        // Every line now points at its cost code (new items at the `VO{seq}-{n}` one made for it).
        await this.repo.replaceLines(v.workspaceId, v.id, lines.map((l, i) => ({ ...l, costCodeId: codeIds.value[i] ?? l.costCodeId })));
        await this.lifecycle.shiftPlannedFinish(v.workspaceId, v.projectId, v.scheduleImpactDays, answer.actor);

        const next: VariationRecord = {
            ...v, status: 'accepted', acceptedAt: answer.at, acceptedByName: answer.name, responseNote: answer.note, updatedAt: now,
        };
        await this.repo.save(next);
        await this.audit.record({
            workspaceId: v.workspaceId, projectId: v.projectId, actor: answer.actor, entityType: 'variation', entityId: v.id, action: 'respond',
            data: {
                status: [v.status, 'accepted'], action: answer.action, via: answer.via, name: answer.name, sellTotal: v.sellTotal,
                costTotal: v.costTotal, scheduleImpactDays: v.scheduleImpactDays, billing: v.billing,
            },
        });
        return ok(next);
    }

    /** After commit: `variation.accepted` / `variation.rejected` to the members who read variations. Never throws. */
    async notifyResponse(workspaceId: WorkspaceId, variationId: string, exceptUserId: UserId | null): Promise<void> {
        try {
            const v = await this.repo.find(variationId);
            if (v?.workspaceId !== workspaceId || (v.status !== 'accepted' && v.status !== 'rejected')) return;
            const toUserIds = (await this.directory.members(workspaceId))
                .filter(m => can(m.role, 'variations.read') && m.userId !== exceptUserId)
                .map(m => m.userId);
            if (toUserIds.length === 0) return;
            const accepted = v.status === 'accepted';
            await this.notifier.notify({
                template: accepted ? 'variation.accepted' : 'variation.rejected',
                toUserIds,
                payload: {
                    docNumber: v.number ?? `#${v.seqNo}`,
                    title: v.title,
                    customerName: v.customerSnapshot?.name ?? v.acceptedByName,
                    projectName: await this.projectName(workspaceId, v.projectId),
                    ...(accepted ? { amount: v.sellTotal } : { note: v.responseNote }),
                    href: `/p/${v.projectId}/variations/${v.id}`,
                },
            });
        } catch (e) {
            this.logger.error(`variation response notice not sent: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
