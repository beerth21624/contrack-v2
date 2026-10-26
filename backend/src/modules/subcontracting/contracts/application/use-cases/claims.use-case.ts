// ─── Progress claims: list, request (vendor, or buyer on behalf), inspect, approve, pay, reject — plan §4.7, rule 9 ───
// Every write locks the subcontract row first (ContractAccess.lock / lockClaim) and checks the claim as read under that
// lock: a double-click or two people at once get a 409 on the second request, never a second claim or payment.
import { Injectable } from '@nestjs/common';
import type {
    ApproveClaimRequest, ClaimDto, InspectClaimRequest, PayClaimRequest,
} from '@contrack/contract';
import { type ClaimAmountsResult, contractClaimAmounts } from '@contrack/domain/subcontracting/claims';
import { Clock, FileService, IdGenerator, UnitOfWork, UserDirectory } from '../../../../../shared/application/ports';
import { DomainError, type Result, type UserId, err, ok } from '../../../../../shared/domain';
import { asClaimId, asRetentionEntryId, type ClaimId, type SubcontractId } from '../../../shared/ids';
import { ScActivityLog, SubcontractingSettingsReader } from '../../../shared/ports';
import { Claim } from '../../domain/entities/claim.entity';
import type { Subcontract } from '../../domain/entities/subcontract.entity';
import { ContractAccess, READ_BOTH } from '../contract-access';
import { logContract } from '../contract-activity';
import { ContractNotices } from '../contract-notices';
import { openClaimOf } from '../contract-state';
import { ContractViews } from '../contract-views';
import { ClaimRepository } from '../ports/claim.repository';
import { RetentionRepository } from '../ports/retention.repository';
import { INSPECTION_RESULT_TEXT, formatBaht } from '../thai-format';

/** The one claim formula (shared with the browser previews): contract terms + labour share of the contract lines. */
export function amountsFor(sc: Subcontract, gross: number, adjustments: ApproveClaimRequest['adjustments']): ClaimAmountsResult {
    return contractClaimAmounts({ terms: sc.terms, lines: sc.state.lines }, gross, adjustments);
}

@Injectable()
export class ListClaimsUseCase {
    constructor(private readonly access: ContractAccess, private readonly claims: ClaimRepository, private readonly views: ContractViews) {}

    async execute(input: { userId: UserId; subcontractId: SubcontractId }): Promise<Result<ClaimDto[], DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, READ_BOTH);
        if (!loaded.ok) return loaded;
        return ok(await this.views.claimDtos(await this.claims.listBySubcontracts([input.subcontractId]), loaded.value.seesPrices));
    }
}

@Injectable()
export class RequestClaimUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly claims: ClaimRepository,
        private readonly files: FileService,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly views: ContractViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    /** One non-rejected claim per installment; a claim that failed inspection is claimed again (back to requested). */
    async execute(input: { userId: UserId; subcontractId: SubcontractId; installmentNo: number; note: string; photoFileIds: string[] }): Promise<Result<ClaimDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, {
            buyer: ['sc.claims.inspect'], vendor: ['vendor.contract.act'], write: true,
        });
        if (!loaded.ok) return loaded;
        const side = loaded.value.side;
        const photos = [...new Set(input.photoFileIds)];
        if (photos.length > 0) {
            const owned = await this.files.assertUploadedBy(photos, input.userId);
            if (!owned.ok) return owned;
        }
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<{ sc: Subcontract; claim: Claim }, DomainError>> => {
            const locked = await this.access.lock(input.subcontractId);
            if (!locked.ok) return locked;
            const sc = locked.value;
            const active = sc.requireStatus('claim on', 'active');
            if (!active.ok) return active;
            const installment = sc.installmentAmount(input.installmentNo);
            if (installment === undefined) return err(DomainError.unprocessable('No such installment', { installmentNo: input.installmentNo }));
            const amounts = amountsFor(sc, installment.amount, []);
            const open = openClaimOf(await this.claims.listBySubcontracts([sc.id]), input.installmentNo);
            let claim: Claim;
            if (open !== undefined) {
                const again = open.requestAgain({ requestedBy: side, requestedByUser: input.userId, photoFileIds: photos, note: input.note, amounts, now });
                if (!again.ok) return err(DomainError.conflict('This installment already has a claim', { claimId: open.id, status: open.status }));
                claim = open;
                await this.claims.update(claim);
            } else {
                claim = Claim.request({
                    id: asClaimId(this.ids.newId()), subcontractId: sc.id, buyerWorkspaceId: sc.buyerWorkspaceId,
                    installmentNo: installment.no, condition: installment.condition, requestedBy: side, requestedByUser: input.userId,
                    photoFileIds: photos, note: input.note, amounts, now,
                });
                await this.claims.insert(claim);
            }
            await logContract(this.activity, sc, 'claim', claim.id, open !== undefined ? 'requested_again' : 'requested', input.userId, now, {
                installmentNo: claim.installmentNo, side, gross: amounts.gross,
            });
            return ok({ sc, claim });
        });
        if (!done.ok) return done;
        const { sc, claim } = done.value;
        if (side === 'vendor') {
            await this.notices.toBuyer(sc, 'sc.claim_requested', { vendorName: sc.vendorName, title: sc.title, installmentNo: claim.installmentNo });
        }
        return ok(await this.views.claimDto(claim, loaded.value.seesPrices));
    }
}

@Injectable()
export class InspectClaimUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly claims: ClaimRepository,
        private readonly users: UserDirectory,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly views: ContractViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /**
     * Buyer inspection with the trade checklist. Again on an approved / paid claim = follow-up of the fixes (marking them
     * done clears `fixesBlockNextClaim`): only checklist, fixes and note change.
     */
    async execute(input: { userId: UserId; claimId: ClaimId } & InspectClaimRequest): Promise<Result<ClaimDto, DomainError>> {
        const loaded = await this.access.loadClaim(input.userId, input.claimId, { buyer: ['sc.claims.inspect'], write: true });
        if (!loaded.ok) return loaded;
        const now = this.clock.now();
        const byName = (await this.users.findMany([input.userId])).get(input.userId)?.displayName ?? '';
        const done = await this.uow.run(async (): Promise<Result<{ sc: Subcontract; claim: Claim; followUp: boolean }, DomainError>> => {
            const locked = await this.access.lockClaim(input.claimId, loaded.value.subcontract.id);
            if (!locked.ok) return locked;
            const { subcontract: sc, claim } = locked.value;
            const open = sc.requireStatus('inspect a claim of', 'active', 'completed', 'terminated');
            if (!open.ok) return open;
            const before = claim.status;
            const inspected = claim.inspect({
                result: input.result, checklist: input.checklist, fixes: input.fixes, note: input.note, byUserId: input.userId, byName, at: now,
            });
            if (!inspected.ok) return inspected;
            await this.claims.update(claim);
            await logContract(this.activity, sc, 'claim', claim.id, inspected.value.followUp ? 'fixes_updated' : 'inspected', input.userId, now, {
                from: before, to: claim.status, result: claim.inspection?.result, openFixes: claim.hasOpenFixes(),
            });
            return ok({ sc, claim, followUp: inspected.value.followUp });
        });
        if (!done.ok) return done;
        const { sc, claim, followUp } = done.value;
        if (!followUp) {
            await this.notices.toVendor(sc, 'sc.inspection_result', {
                title: sc.title, installmentNo: claim.installmentNo, result: INSPECTION_RESULT_TEXT[input.result],
            });
        }
        return ok(await this.views.claimDto(claim, loaded.value.seesPrices));
    }
}

@Injectable()
export class ApproveClaimUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly claims: ClaimRepository,
        private readonly settings: SubcontractingSettingsReader,
        private readonly activity: ScActivityLog,
        private readonly views: ContractViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /** Inspected pass / pass_with_fixes → approved; the amounts are computed again with the adjustments. */
    async execute(input: { userId: UserId; claimId: ClaimId } & ApproveClaimRequest): Promise<Result<ClaimDto, DomainError>> {
        const loaded = await this.access.loadClaim(input.userId, input.claimId, { buyer: ['sc.claims.approve'], write: true });
        if (!loaded.ok) return loaded;
        const fixesBlock = (await this.settings.get(loaded.value.subcontract.buyerWorkspaceId)).fixesBlockNextClaim;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<Claim, DomainError>> => {
            const locked = await this.access.lockClaim(input.claimId, loaded.value.subcontract.id);
            if (!locked.ok) return locked;
            const { subcontract: sc, claim } = locked.value;
            const active = sc.requireStatus('approve a claim of', 'active');
            if (!active.ok) return active;
            if (fixesBlock) {
                const blocking = (await this.claims.listBySubcontracts([sc.id]))
                    .find(c => c.installmentNo < claim.installmentNo && c.status !== 'rejected' && c.hasOpenFixes());
                if (blocking !== undefined) {
                    return err(DomainError.conflict('Fixes of an earlier installment are still open', { reason: 'open_fixes', installmentNo: blocking.installmentNo }));
                }
            }
            const installment = sc.installmentAmount(claim.installmentNo);
            if (installment === undefined) return err(DomainError.unprocessable('No such installment', { installmentNo: claim.installmentNo }));
            const amounts = amountsFor(sc, installment.amount, input.adjustments);
            const approved = claim.approve(amounts, input.userId, now);
            if (!approved.ok) return approved;
            await this.claims.update(claim);
            await logContract(this.activity, sc, 'claim', claim.id, 'approved', input.userId, now, { from: 'inspected', to: 'approved', net: amounts.net });
            return ok(claim);
        });
        if (!done.ok) return done;
        return ok(await this.views.claimDto(done.value, loaded.value.seesPrices));
    }
}

@Injectable()
export class PayClaimUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly claims: ClaimRepository,
        private readonly retention: RetentionRepository,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly views: ContractViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    /** Records the payment (the system holds no money); the claim's retention goes into the ledger as withheld (once). */
    async execute(input: { userId: UserId; claimId: ClaimId } & PayClaimRequest): Promise<Result<ClaimDto, DomainError>> {
        const loaded = await this.access.loadClaim(input.userId, input.claimId, { buyer: ['sc.payments.record'], write: true });
        if (!loaded.ok) return loaded;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<{ sc: Subcontract; claim: Claim }, DomainError>> => {
            const locked = await this.access.lockClaim(input.claimId, loaded.value.subcontract.id);
            if (!locked.ok) return locked;
            const { subcontract: sc, claim } = locked.value;
            const open = sc.requireStatus('record a payment of', 'active', 'terminated');
            if (!open.ok) return open;
            const paid = claim.pay({ paidAt: input.paidAt, amount: input.amount, channel: input.channel, ref: input.ref, by: input.userId, now });
            if (!paid.ok) return paid;
            await this.claims.update(claim);
            if (claim.amounts.retention > 0) {
                await this.retention.insert({
                    id: asRetentionEntryId(this.ids.newId()), subcontractId: sc.id, buyerWorkspaceId: sc.buyerWorkspaceId, kind: 'withheld',
                    amount: claim.amounts.retention, claimId: claim.id, note: `งวดที่ ${claim.installmentNo}`, createdBy: input.userId, createdAt: now,
                });
            }
            await logContract(this.activity, sc, 'claim', claim.id, 'paid', input.userId, now, {
                from: 'approved', to: 'paid', amount: input.amount, retention: claim.amounts.retention,
            });
            return ok({ sc, claim });
        });
        if (!done.ok) return done;
        const { sc, claim } = done.value;
        await this.notices.toVendor(sc, 'sc.claim_paid', { title: sc.title, installmentNo: claim.installmentNo, amount: formatBaht(input.amount) });
        return ok(await this.views.claimDto(claim, loaded.value.seesPrices));
    }
}

@Injectable()
export class RejectClaimUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly claims: ClaimRepository,
        private readonly activity: ScActivityLog,
        private readonly views: ContractViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; claimId: ClaimId; reason: string }): Promise<Result<ClaimDto, DomainError>> {
        const loaded = await this.access.loadClaim(input.userId, input.claimId, { buyer: ['sc.claims.inspect'], write: true });
        if (!loaded.ok) return loaded;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<Claim, DomainError>> => {
            const locked = await this.access.lockClaim(input.claimId, loaded.value.subcontract.id);
            if (!locked.ok) return locked;
            const { subcontract: sc, claim } = locked.value;
            const before = claim.status;
            const rejected = claim.reject(input.reason, now);
            if (!rejected.ok) return rejected;
            await this.claims.update(claim);
            await logContract(this.activity, sc, 'claim', claim.id, 'rejected', input.userId, now, { from: before, to: 'rejected', reason: input.reason });
            return ok(claim);
        });
        if (!done.ok) return done;
        return ok(await this.views.claimDto(done.value, loaded.value.seesPrices));
    }
}
