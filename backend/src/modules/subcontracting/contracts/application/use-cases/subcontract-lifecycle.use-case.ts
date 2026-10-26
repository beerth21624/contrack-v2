// ─── One subcontract: read, contract document, accept / request change, cancel, terminate, complete, close, scan, rate ───
// Plan §4.6–4.7, §5.5, §7. Every use case resolves the caller's side through ContractAccess. Writes lock the subcontract
// row FIRST inside the UnitOfWork and check the state on that locked row (UnitOfWork.run commits even when the work
// returns an error Result, so nothing is written before every check passed).
import { Injectable } from '@nestjs/common';
import type { ContractDocumentDto, RatingRequest, SubcontractDto } from '@contrack/contract';
import { sanitizeContractHtml } from '@contrack/domain/subcontracting/contract-template';
import { Clock, FileService, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import { DomainError, type Result, type UserId, err, ok, okVoid } from '../../../../../shared/domain';
import { asRatingId, type SubcontractId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { ScAccess } from '../../../shared/sc-access';
import type { Subcontract } from '../../domain/entities/subcontract.entity';
import { type AccessNeed, ContractAccess, type ContractActor, READ_BOTH } from '../contract-access';
import { logContract } from '../contract-activity';
import { ContractNotices } from '../contract-notices';
import { allInstallmentsPaid, retentionOf } from '../contract-state';
import { ContractViews } from '../contract-views';
import { PackageFollowUp } from '../package-follow-up';
import { ClaimRepository } from '../ports/claim.repository';
import { ContractDocumentRepository } from '../ports/contract-document.repository';
import { RatingRepository } from '../ports/rating.repository';
import { RetentionRepository } from '../ports/retention.repository';
import { SubcontractRepository } from '../ports/subcontract.repository';
import { formatBaht } from '../thai-format';

interface ById {
    userId: UserId;
    subcontractId: SubcontractId;
}

@Injectable()
export class GetSubcontractUseCase {
    constructor(private readonly access: ContractAccess, private readonly views: ContractViews) {}

    async execute(input: ById): Promise<Result<SubcontractDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, READ_BOTH);
        if (!loaded.ok) return loaded;
        return ok(await this.views.detail(loaded.value.subcontract, loaded.value));
    }
}

@Injectable()
export class GetContractDocumentUseCase {
    constructor(private readonly access: ContractAccess, private readonly scAccess: ScAccess, private readonly documents: ContractDocumentRepository) {}

    async execute(input: ById): Promise<Result<ContractDocumentDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, READ_BOTH);
        if (!loaded.ok) return loaded;
        const { subcontract: sc, side, role } = loaded.value;
        const doc = await this.documents.findDocument(sc.id, sc.documentVersion);
        if (doc === undefined) return err(DomainError.notFound('Contract document'));
        const editable = side === 'buyer' && sc.canEditDocument() && await this.scAccess.allowed(role, 'sc.award', sc.buyerWorkspaceId);
        // Stored versions are sanitized on save; sanitizing again on the way out keeps older rows safe too.
        return ok({ version: doc.version, html: sanitizeContractHtml(doc.html), editable });
    }
}

@Injectable()
export class UpdateContractDocumentUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly subcontracts: SubcontractRepository,
        private readonly documents: ContractDocumentRepository,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    /** Buyer, before acceptance: a new version (sanitized) that the crew must accept again. */
    async execute(input: ById & { html: string }): Promise<Result<ContractDocumentDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, { buyer: ['sc.award'], write: true });
        if (!loaded.ok) return loaded;
        const html = sanitizeContractHtml(input.html);
        if (html.replace(/<[^>]*>/g, '').trim() === '') return err(DomainError.unprocessable('The contract text is empty'));
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<{ sc: Subcontract; version: number }, DomainError>> => {
            const locked = await this.access.lock(input.subcontractId);
            if (!locked.ok) return locked;
            const sc = locked.value;
            const version = sc.newDocumentVersion(now);
            if (!version.ok) return version;
            await this.documents.insertDocument({
                id: this.ids.newId(), subcontractId: sc.id, buyerWorkspaceId: sc.buyerWorkspaceId, version: version.value, html,
                createdBy: input.userId, createdAt: now,
            });
            await this.documents.resolveChangeRequests(sc.id, now);
            await this.subcontracts.update(sc);
            await logContract(this.activity, sc, 'subcontract', sc.id, 'document_updated', input.userId, now, { version: version.value });
            return ok({ sc, version: version.value });
        });
        if (!done.ok) return done;
        const { sc, version } = done.value;
        await this.notices.toVendor(sc, 'sc.contract_to_accept', { buyerName: sc.buyerName, title: sc.title, total: formatBaht(sc.total) });
        return ok({ version, html, editable: true });
    }
}

@Injectable()
export class AcceptSubcontractUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly subcontracts: SubcontractRepository,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly views: ContractViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /** The crew accepts the CURRENT document version (time, user, IP and version are kept as evidence). */
    async execute(input: ById & { documentVersion: number; ip: string | null }): Promise<Result<SubcontractDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, { vendor: ['vendor.contract.act'], write: true });
        if (!loaded.ok) return loaded;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<Subcontract, DomainError>> => {
            const locked = await this.access.lock(input.subcontractId);
            if (!locked.ok) return locked;
            const sc = locked.value;
            const accepted = sc.accept(input.documentVersion, input.userId, input.ip, now);
            if (!accepted.ok) return accepted;
            await this.subcontracts.update(sc);
            await logContract(this.activity, sc, 'subcontract', sc.id, 'accepted', input.userId, now, {
                from: 'pending_acceptance', to: 'active', documentVersion: input.documentVersion, ip: input.ip,
            });
            return ok(sc);
        });
        if (!done.ok) return done;
        const sc = done.value;
        await this.notices.toBuyer(sc, 'sc.contract_accepted', { vendorName: sc.vendorName, title: sc.title });
        return ok(await this.views.detail(sc, loaded.value));
    }
}

@Injectable()
export class RequestContractChangeUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly documents: ContractDocumentRepository,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly views: ContractViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: ById & { text: string }): Promise<Result<SubcontractDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, { vendor: ['vendor.contract.act'], write: true });
        if (!loaded.ok) return loaded;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<Subcontract, DomainError>> => {
            const locked = await this.access.lock(input.subcontractId);
            if (!locked.ok) return locked;
            const sc = locked.value;
            const pending = sc.requireStatus('request changes to', 'pending_acceptance');
            if (!pending.ok) return pending;
            await this.documents.insertChangeRequest({
                id: this.ids.newId(), subcontractId: sc.id, buyerWorkspaceId: sc.buyerWorkspaceId, text: input.text,
                requestedBy: input.userId, createdAt: now, resolvedAt: null,
            });
            await logContract(this.activity, sc, 'subcontract', sc.id, 'change_requested', input.userId, now, { documentVersion: sc.documentVersion });
            return ok(sc);
        });
        if (!done.ok) return done;
        const sc = done.value;
        await this.notices.toBuyer(sc, 'sc.change_requested', { vendorName: sc.vendorName, title: sc.title });
        return ok(await this.views.detail(sc, loaded.value));
    }
}

interface StatusStep {
    from: string;
    action: string;
    data: Record<string, unknown>;
}

/**
 * Shared shape of cancel / terminate / complete / close: access check, then in one transaction lock (the whole package's
 * subcontracts when the package follow-up runs), check + change the status on the locked row, write, follow up.
 */
@Injectable()
abstract class StatusChange {
    constructor(
        protected readonly access: ContractAccess,
        protected readonly subcontracts: SubcontractRepository,
        protected readonly followUp: PackageFollowUp,
        protected readonly activity: ScActivityLog,
        protected readonly views: ContractViews,
        protected readonly uow: UnitOfWork,
        protected readonly clock: Clock,
    ) {}

    protected async change(
        input: ById, need: AccessNeed, followUp: boolean,
        apply: (sc: Subcontract, now: Date, actor: ContractActor) => Promise<Result<StatusStep, DomainError>>,
    ): Promise<Result<SubcontractDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, need);
        if (!loaded.ok) return loaded;
        const known = loaded.value.subcontract;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<Subcontract, DomainError>> => {
            const siblings = followUp ? await this.subcontracts.lockByPackage(known.buyerWorkspaceId, known.packageId) : [];
            const sc = followUp ? siblings.find(s => s.id === known.id) : await this.subcontracts.lockForUpdate(known.id);
            if (sc === undefined) return err(DomainError.notFound('Subcontract'));
            const step = await apply(sc, now, loaded.value);
            if (!step.ok) return step;
            await this.subcontracts.update(sc);
            if (followUp) await this.followUp.afterEnded(sc, siblings, now);
            await logContract(this.activity, sc, 'subcontract', sc.id, step.value.action, input.userId, now, {
                from: step.value.from, to: sc.status, ...step.value.data,
            });
            return ok(sc);
        });
        if (!done.ok) return done;
        return ok(await this.views.detail(done.value, loaded.value));
    }
}

@Injectable()
export class CancelSubcontractUseCase extends StatusChange {
    /** Either side, before acceptance. The package opens again (bids re-decidable) when no other live subcontract of it is left. */
    async execute(input: ById & { reason: string }): Promise<Result<SubcontractDto, DomainError>> {
        const need: AccessNeed = { buyer: ['sc.award'], vendor: ['vendor.contract.act'], write: true };
        return this.change(input, need, true, (sc, now, actor) => {
            const done = sc.cancel(input.reason, now);
            return Promise.resolve(done.ok ? ok({ from: 'pending_acceptance', action: 'cancelled', data: { reason: input.reason, by: actor.side } }) : done);
        });
    }
}

@Injectable()
export class TerminateSubcontractUseCase extends StatusChange {
    /** Buyer, active only; approved installments stay (plan rule 12). */
    async execute(input: ById & { reason: string }): Promise<Result<SubcontractDto, DomainError>> {
        return this.change(input, { buyer: ['sc.award'], write: true }, true, (sc, now) => {
            const done = sc.terminate(input.reason, now);
            return Promise.resolve(done.ok ? ok({ from: 'active', action: 'terminated', data: { reason: input.reason } }) : done);
        });
    }
}

@Injectable()
export class CompleteSubcontractUseCase extends StatusChange {
    constructor(
        access: ContractAccess, subcontracts: SubcontractRepository, followUp: PackageFollowUp, activity: ScActivityLog,
        views: ContractViews, uow: UnitOfWork, clock: Clock, private readonly claims: ClaimRepository,
    ) {
        super(access, subcontracts, followUp, activity, views, uow, clock);
    }

    /** Every installment paid → completed; the retention release dates count from now. */
    async execute(input: ById): Promise<Result<SubcontractDto, DomainError>> {
        return this.change(input, { buyer: ['sc.claims.approve'], write: true }, false, async (sc, now) => {
            const active = sc.requireStatus('complete', 'active');
            if (!active.ok) return active;
            if (!allInstallmentsPaid(sc, await this.claims.listBySubcontracts([sc.id]))) {
                return err(DomainError.conflict('Every installment must be paid first', { reason: 'installments_unpaid' }));
            }
            const done = sc.complete(now);
            return done.ok ? ok({ from: 'active', action: 'completed', data: {} }) : done;
        });
    }
}

@Injectable()
export class CloseSubcontractUseCase extends StatusChange {
    constructor(
        access: ContractAccess, subcontracts: SubcontractRepository, followUp: PackageFollowUp, activity: ScActivityLog,
        views: ContractViews, uow: UnitOfWork, clock: Clock, private readonly retention: RetentionRepository,
    ) {
        super(access, subcontracts, followUp, activity, views, uow, clock);
    }

    /** Completed and every baht of retention released / forfeited → closed. */
    async execute(input: ById): Promise<Result<SubcontractDto, DomainError>> {
        return this.change(input, { buyer: ['sc.payments.record'], write: true }, true, async (sc, now) => {
            const completed = sc.requireStatus('close', 'completed');
            if (!completed.ok) return completed;
            const balance = retentionOf(sc, await this.retention.listBySubcontracts([sc.id])).balance;
            if (balance !== 0) return err(DomainError.conflict('Retention is still held: release or forfeit it first', { reason: 'retention_held', balance }));
            const done = sc.close(now);
            return done.ok ? ok({ from: 'completed', action: 'closed', data: {} }) : done;
        });
    }
}

@Injectable()
export class AttachSignedScanUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly subcontracts: SubcontractRepository,
        private readonly files: FileService,
        private readonly activity: ScActivityLog,
        private readonly views: ContractViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /** The scan of the contract signed on paper (uploaded by the caller). */
    async execute(input: ById & { fileId: string }): Promise<Result<SubcontractDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, { buyer: ['sc.packages.manage'], write: true });
        if (!loaded.ok) return loaded;
        const owned = await this.files.assertUploadedBy([input.fileId], input.userId);
        if (!owned.ok) return owned;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<Subcontract, DomainError>> => {
            const locked = await this.access.lock(input.subcontractId);
            if (!locked.ok) return locked;
            const sc = locked.value;
            const attached = sc.attachSignedScan(input.fileId, now);
            if (!attached.ok) return attached;
            await this.subcontracts.update(sc);
            await logContract(this.activity, sc, 'subcontract', sc.id, 'signed_scan_attached', input.userId, now, { fileId: input.fileId });
            return ok(sc);
        });
        if (!done.ok) return done;
        return ok(await this.views.detail(done.value, loaded.value));
    }
}

const SCORE_KEYS = { buyer: ['quality', 'time', 'communication'], vendor: ['payment', 'communication'] } as const;

@Injectable()
export class RateSubcontractUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly ratings: RatingRepository,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    /** Either side once, after the work ended. Buyer → crew: quality, time, communication; crew → buyer: payment, communication. */
    async execute(input: ById & RatingRequest): Promise<Result<undefined, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, {
            buyer: ['sc.packages.manage'], vendor: ['vendor.contract.act'], write: true,
        });
        if (!loaded.ok) return loaded;
        const side = loaded.value.side;
        const allowed: readonly string[] = SCORE_KEYS[side];
        const keys = Object.keys(input.scores);
        if (keys.length === 0 || keys.some(k => !allowed.includes(k))) {
            return err(DomainError.unprocessable(`Scores allowed for the ${side}: ${allowed.join(', ')}`, { allowed }));
        }
        const now = this.clock.now();
        return this.uow.run(async (): Promise<Result<undefined, DomainError>> => {
            const locked = await this.access.lock(input.subcontractId);
            if (!locked.ok) return locked;
            const sc = locked.value;
            const ended = sc.requireStatus('rate', 'completed', 'closed', 'terminated');
            if (!ended.ok) return ended;
            const vendorWs = sc.vendorWorkspaceId;
            const fromWorkspaceId = side === 'buyer' ? sc.buyerWorkspaceId : vendorWs;
            if (fromWorkspaceId === null) return err(DomainError.forbidden());
            const inserted = await this.ratings.insert({
                id: asRatingId(this.ids.newId()), subcontractId: sc.id, buyerWorkspaceId: sc.buyerWorkspaceId, fromSide: side, fromWorkspaceId,
                toWorkspaceId: side === 'buyer' ? vendorWs : sc.buyerWorkspaceId, scores: { ...input.scores }, comment: input.comment,
                createdBy: input.userId, createdAt: now,
            });
            if (!inserted) return err(DomainError.conflict('Already rated', { reason: 'already_rated' }));
            await logContract(this.activity, sc, 'subcontract', sc.id, 'rated', input.userId, now, { side });
            return okVoid();
        });
    }
}
