// ─── Shared parts of the quotation use cases: access, pricing, issue, the customer's answer, notifications ───
import { Injectable, Logger } from '@nestjs/common';
import type { ProjectCommercialSettings, QuotationResponseAction } from '@contrack/contract';
import { addDays, bangkokToday } from '@contrack/domain/dates/business-date';
import { defaultProjectTypeFor, resolveSettings } from '@contrack/domain/erp/profiles';
import {
    type DetailLevel, type QuotationFormat, type QuotationLineInput, type QuotationPricing, QuotationPricingError,
    type QuotationSectionInput, priceQuotation,
} from '@contrack/domain/quotation';
import { type ProjectGrant, ModuleAccess } from '../../../shared/application/module-access';
import {
    AuditLog, Clock, CompanyProfiles, CustomerLookup, DocumentNumbering, type ErpNotificationTemplate, IdGenerator, Notifier, ProjectCatalog, ProjectLifecycle,
    UnitOfWork, WorkspaceDirectory,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { type Permission, can } from '../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../shared/domain/result';
import { RESPONSE_STATUS, requireStatus, revisionNumber } from '../domain/quotation-state';
import {
    QuotationRepository, type QuotationRecord, type QuotationVersionRecord, type QuotationVersionRows, type StoredQuotationLine,
} from './ports/quotation.repository';

export const MODULE = 'quotations';

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

export interface LoadedQuotation {
    grant: ProjectGrant;
    quotation: QuotationRecord;
}

export interface LoadedVersion extends LoadedQuotation {
    version: QuotationVersionRecord;
}

/** Loads a quotation / version by id and authorizes the caller on its project (a stranger or unknown id → not_found). */
@Injectable()
export class QuotationAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: QuotationRepository) {}

    async quotation(userId: UserId, quotationId: string, permissions: Permission[], write: boolean): Promise<Result<LoadedQuotation, DomainError>> {
        if (!isUuid(quotationId)) return err(DomainError.notFound('Quotation'));
        const quotation = await this.repo.findQuotation(quotationId.toLowerCase());
        if (quotation === undefined) return err(DomainError.notFound('Quotation'));
        const grant = await this.access.toProject(userId, quotation.projectId, MODULE, { permissions, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Quotation')) : grant;
        if (grant.value.workspaceId !== quotation.workspaceId) return err(DomainError.notFound('Quotation'));
        return ok({ grant: grant.value, quotation });
    }

    async version(userId: UserId, versionId: string, permissions: Permission[], write: boolean): Promise<Result<LoadedVersion, DomainError>> {
        if (!isUuid(versionId)) return err(DomainError.notFound('QuotationVersion'));
        const version = await this.repo.findVersion(versionId.toLowerCase());
        if (version === undefined) return err(DomainError.notFound('QuotationVersion'));
        const loaded = await this.quotation(userId, version.quotationId, permissions, write);
        if (!loaded.ok) return loaded.error.code === 'not_found' ? err(DomainError.notFound('QuotationVersion')) : loaded;
        return ok({ ...loaded.value, version });
    }
}

export const seesMargins = (grant: { role: ProjectGrant['role'] }): boolean => can(grant.role, 'quotations.seeMargins');

export interface PricingSource {
    format: QuotationFormat;
    detailLevel: DetailLevel;
    pricing: QuotationPricing;
    sections: readonly QuotationSectionInput[];
    lines: readonly (QuotationLineInput & { id: string })[];
}

/** What a response notification needs. */
interface ResponseNotice {
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    versionId: string;
    template: ErpNotificationTemplate;
    note: string;
    exceptUserId: UserId | null;
}

@Injectable()
export class QuotationWorkflow {
    private readonly logger = new Logger(QuotationWorkflow.name);

    constructor(
        private readonly repo: QuotationRepository,
        private readonly company: CompanyProfiles,
        private readonly customers: CustomerLookup,
        private readonly numbering: DocumentNumbering,
        private readonly lifecycle: ProjectLifecycle,
        private readonly catalog: ProjectCatalog,
        private readonly directory: WorkspaceDirectory,
        private readonly notifier: Notifier,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    /** Commercial terms of the project (hub project type + settings over the company defaults) and the VAT registration. */
    async settings(workspaceId: WorkspaceId, projectId: ProjectId): Promise<{ project: ProjectCommercialSettings; vatRegistered: boolean; vatRate: number }> {
        const profile = await this.company.get(workspaceId);
        const hub = await this.lifecycle.hubFields(workspaceId, projectId);
        const type = hub?.projectType ?? profile.defaultProjectType ?? defaultProjectTypeFor(profile.businessProfiles);
        return {
            project: resolveSettings(type, profile.defaults, hub?.settings ?? {}),
            vatRegistered: profile.vatRegistered,
            vatRate: profile.vatRate,
        };
    }

    async hubCustomerId(workspaceId: WorkspaceId, projectId: ProjectId): Promise<string | null> {
        return (await this.lifecycle.hubFields(workspaceId, projectId))?.customerId ?? null;
    }

    async projectName(workspaceId: WorkspaceId, projectId: ProjectId): Promise<string> {
        return (await this.catalog.find(workspaceId, projectId))?.name ?? '';
    }

    /** A customer of the workspace that may go on a new document: not_found / conflict `customer_archived`. */
    async checkCustomer(workspaceId: WorkspaceId, customerId: string | null): Promise<Result<string | null, DomainError>> {
        if (customerId === null) return ok(null);
        const customer = await this.customers.find(workspaceId, customerId.toLowerCase());
        if (customer === undefined) return err(DomainError.notFound('Customer'));
        if (customer.archivedAt !== null) return err(DomainError.conflict('The customer is archived', { reason: 'customer_archived' }));
        return ok(customer.id);
    }

    /** Prices a version (never trusting amounts from the client); a pricing problem → 400 with `details.reason`. */
    async price(workspaceId: WorkspaceId, source: PricingSource): Promise<Result<{ totals: QuotationVersionRecord['totals']; rows: QuotationVersionRows }, DomainError>> {
        const profile = await this.company.get(workspaceId);
        try {
            const priced = priceQuotation({ ...source, vatRegistered: profile.vatRegistered });
            const lines = priced.lines.map((l): StoredQuotationLine => {
                if (l.id === undefined) throw new Error('quotation line without id');
                return { ...l, id: l.id };
            });
            return ok({ totals: priced.totals, rows: { sections: priced.sections, lines } });
        } catch (e) {
            if (e instanceof QuotationPricingError) {
                const first = e.issues[0];
                return err(DomainError.validation(e.message, { reason: first?.reason, path: first?.path, issues: e.issues }));
            }
            throw e;
        }
    }

    newLineId(): string {
        return this.ids.newId();
    }

    /**
     * Issues a version inside the caller's transaction (the quotation row is locked): the base number from numbering on
     * the first issue, `${base}-R<n>` afterwards; seller / buyer snapshots; earlier issued or change-requested versions
     * superseded; project → `quoted`.
     */
    async issueLocked(q: QuotationRecord, v: QuotationVersionRecord, by: UserId): Promise<Result<QuotationVersionRecord, DomainError>> {
        const now = this.clock.now();
        const issueDate = v.issueDate ?? bangkokToday(now);
        const validUntil = v.validUntil ?? addDays(issueDate, 30);
        const versions = await this.repo.versionsOf(q.workspaceId, [q.id]);
        let quotation = q;
        let number: string;
        if (q.number === null) {
            const issued = await this.numbering.issue({
                workspaceId: q.workspaceId, docType: 'quotation', issueDate, subjectType: 'quotation', subjectId: q.id,
                projectId: q.projectId, issuedBy: by,
            });
            if (!issued.ok) return issued;
            number = issued.value.number;
            quotation = { ...quotation, number };
        } else {
            const reissues = versions.filter(o => o.id !== v.id && o.number !== null).length;
            number = revisionNumber(q.number, Math.max(1, reissues));
        }
        const companySnapshot = await this.company.snapshot(q.workspaceId, v.language);
        const customerSnapshot = q.customerId === null ? null : (await this.customers.snapshot(q.workspaceId, q.customerId, v.language)) ?? null;

        for (const other of versions) {
            if (other.id === v.id || (other.status !== 'issued' && other.status !== 'change_requested')) continue;
            await this.repo.saveVersion({ ...other, status: 'superseded', updatedAt: now });
            await this.audit.record({
                workspaceId: q.workspaceId, projectId: q.projectId, actor: by, entityType: 'quotation_version', entityId: other.id,
                action: 'supersede', data: { status: [other.status, 'superseded'], by: v.id },
            });
        }
        const issued: QuotationVersionRecord = {
            ...v, status: 'issued', number, issueDate, validUntil, companySnapshot, customerSnapshot, issuedBy: by, issuedAt: now, updatedAt: now,
        };
        await this.repo.saveVersion(issued);
        await this.repo.saveQuotation({ ...quotation, currentVersionId: v.id, updatedAt: now });
        await this.audit.record({
            workspaceId: q.workspaceId, projectId: q.projectId, actor: by, entityType: 'quotation_version', entityId: v.id, action: 'issue',
            data: { status: [v.status, 'issued'], number, issueDate, validUntil, grandTotal: v.totals.grandTotal },
        });
        await this.lifecycle.advance(q.workspaceId, q.projectId, 'quoted', by);
        return ok(issued);
    }

    /** The customer's answer to an issued version, inside the caller's transaction (the quotation row is locked). */
    async respondLocked(
        q: QuotationRecord, v: QuotationVersionRecord,
        answer: { action: QuotationResponseAction; name: string; note: string; at: Date; actor: UserId | null; via: 'link' | 'recorded' },
    ): Promise<Result<QuotationVersionRecord, DomainError>> {
        const allowed = requireStatus(v.status, ['issued']);
        if (!allowed.ok) return allowed;
        const status = RESPONSE_STATUS[answer.action];
        const now = this.clock.now();
        const next: QuotationVersionRecord = {
            ...v, status, acceptedByName: answer.name, responseNote: answer.note,
            acceptedAt: answer.action === 'accept' ? answer.at : v.acceptedAt, updatedAt: now,
        };
        await this.repo.saveVersion(next);
        await this.audit.record({
            workspaceId: q.workspaceId, projectId: q.projectId, actor: answer.actor, entityType: 'quotation_version', entityId: v.id,
            action: 'respond', data: { status: [v.status, status], action: answer.action, via: answer.via },
        });
        if (answer.action === 'accept') {
            for (const other of await this.repo.versionsOf(q.workspaceId, [q.id])) {
                if (other.id === v.id || other.status !== 'issued') continue;
                await this.repo.saveVersion({ ...other, status: 'superseded', updatedAt: now });
            }
            await this.repo.saveQuotation({ ...q, acceptedVersionId: v.id, updatedAt: now });
            await this.lifecycle.advance(q.workspaceId, q.projectId, 'won', answer.actor);
        }
        return ok(next);
    }

    /** After commit: tells the members who read quotations that the customer answered. Never throws. */
    async notifyResponse(n: ResponseNotice): Promise<void> {
        try {
            const v = await this.repo.findVersion(n.versionId);
            if (v?.workspaceId !== n.workspaceId) return;
            const toUserIds = (await this.directory.members(n.workspaceId))
                .filter(m => can(m.role, 'quotations.read') && m.userId !== n.exceptUserId)
                .map(m => m.userId);
            if (toUserIds.length === 0) return;
            const q = await this.repo.findQuotation(v.quotationId);
            await this.notifier.notify({
                template: n.template,
                toUserIds,
                payload: {
                    docNumber: v.number ?? q?.title ?? '',
                    customerName: v.customerSnapshot?.name ?? v.acceptedByName,
                    projectName: await this.projectName(n.workspaceId, n.projectId),
                    amount: v.totals.grandTotal,
                    note: n.note,
                    href: `/p/${n.projectId}/quotations/${v.quotationId}`,
                },
            });
        } catch (e) {
            this.logger.error(`${n.template} not sent: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
