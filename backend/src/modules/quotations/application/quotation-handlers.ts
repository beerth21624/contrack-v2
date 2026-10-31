// ─── What the quotations module plugs into the core registries (wired in QuotationsModule.onModuleInit) ───
// ApprovalHandlers('quotation.issue'), CustomerLinkHandlers('quotation'), DailySweeps('quotations.expire'),
// PortalSources (issued versions expiring within 7 days, WP-35).
import { Injectable, Logger } from '@nestjs/common';
import { PORTAL_QUOTATION_EXPIRY_DAYS, type QuotationLinkPayload, type QuotationResponseAction } from '@contrack/contract';
import { addDays } from '@contrack/domain/dates/business-date';
import {
    type ApprovalDecidedEvent, AuditLog, Clock, type CustomerLinkRespondInput, type CustomerLinkSubjectView,
    type CustomerLinkViewedInput, ModuleFlags, type PortalContext, type PortalTaskItem, type SweepContext, UnitOfWork,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { WorkspaceId } from '../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../shared/domain/result';
import { requireStatus } from '../domain/quotation-state';
import { QuotationRepository } from './ports/quotation.repository';
import { versionDto } from './quotation-views';
import { MODULE, QuotationWorkflow, transact } from './quotation.service';

export const EXPIRE_SWEEP = 'quotations.expire';

/** Versions a customer link never shows (not sent to the customer yet, or withdrawn). */
const HIDDEN_FROM_LINKS = new Set(['draft', 'pending_approval', 'cancelled']);

const TEMPLATE_OF: Readonly<Record<QuotationResponseAction, 'quotation.accepted' | 'quotation.change_requested' | null>> = {
    accept: 'quotation.accepted',
    request_change: 'quotation.change_requested',
    reject: null,
};

@Injectable()
export class QuotationHandlers {
    private readonly logger = new Logger(QuotationHandlers.name);

    constructor(
        private readonly repo: QuotationRepository,
        private readonly workflow: QuotationWorkflow,
        private readonly flags: ModuleFlags,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    // ── approval of `quotation.issue` (subject id = the version id) ──

    async onApprovalDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const found = await this.repo.findVersion(e.subjectId);
            if (found?.workspaceId !== e.workspaceId) return okVoid();
            const q = await this.repo.lockQuotation(e.workspaceId, found.quotationId);
            const v = await this.repo.findVersion(found.id);
            // Withdrawn meanwhile: nothing to apply.
            if (q === undefined || v?.status !== 'pending_approval') return okVoid();
            if (e.decision === 'approved') {
                const issued = await this.workflow.issueLocked(q, v, e.decidedBy);
                return issued.ok ? okVoid() : issued;
            }
            await this.repo.saveVersion({ ...v, status: 'draft', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: v.projectId, actor: e.decidedBy, entityType: 'quotation_version', entityId: v.id,
                action: 'approval_rejected', data: { status: ['pending_approval', 'draft'], note: e.note },
            });
            return okVoid();
        });
    }

    // ── customer link (subject id = the version id) ──

    async linkView(workspaceId: WorkspaceId, subjectId: string): Promise<CustomerLinkSubjectView | undefined> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return undefined;
        const v = await this.repo.findVersion(subjectId.toLowerCase());
        if (v?.workspaceId !== workspaceId || HIDDEN_FROM_LINKS.has(v.status)) return undefined;
        const q = await this.repo.findQuotation(v.quotationId);
        if (q === undefined) return undefined;
        const rows = await this.repo.rows(workspaceId, v.id);
        const payload: QuotationLinkPayload = {
            quotationId: q.id,
            version: versionDto(q, v, rows, { seesMargins: false, canEdit: false }),
            projectName: await this.workflow.projectName(workspaceId, v.projectId),
        };
        return {
            projectId: v.projectId,
            language: v.language,
            title: v.number ?? q.title,
            respondable: v.status === 'issued',
            payload,
        };
    }

    async linkRespond(i: CustomerLinkRespondInput): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(i.workspaceId, MODULE))) {
            return err(DomainError.conflict('The document can no longer be answered', { reason: 'invalid_transition' }));
        }
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const found = await this.repo.findVersion(i.subjectId.toLowerCase());
            if (found?.workspaceId !== i.workspaceId || found.projectId !== i.projectId) return err(DomainError.notFound('QuotationVersion'));
            const q = await this.repo.lockQuotation(i.workspaceId, found.quotationId);
            const v = await this.repo.findVersion(found.id);
            if (q === undefined || v === undefined) return err(DomainError.notFound('QuotationVersion'));
            const answered = await this.workflow.respondLocked(q, v, {
                action: i.action, name: i.name, note: i.note, at: i.at, actor: null, via: 'link',
            });
            return answered.ok ? okVoid() : answered;
        });
    }

    async afterLinkRespond(i: CustomerLinkRespondInput): Promise<void> {
        const template = TEMPLATE_OF[i.action];
        if (template === null) return;
        await this.workflow.notifyResponse({
            workspaceId: i.workspaceId, projectId: i.projectId, versionId: i.subjectId.toLowerCase(), template, note: i.note, exceptUserId: null,
        });
    }

    async onLinkViewed(i: CustomerLinkViewedInput): Promise<void> {
        if (!i.firstView) return;
        await this.workflow.notifyResponse({
            workspaceId: i.workspaceId, projectId: i.projectId, versionId: i.subjectId.toLowerCase(), template: 'quotation.viewed', note: '',
            exceptUserId: null,
        });
    }

    // ── daily sweep: issued versions past valid_until → expired ──

    async expire(ctx: SweepContext): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        const active = new Map<WorkspaceId, boolean>();
        for (const ref of await this.repo.issuedValidBefore(ctx.today, 2000)) {
            let on = active.get(ref.workspaceId);
            if (on === undefined) {
                on = await this.flags.isEnabled(ref.workspaceId, MODULE);
                active.set(ref.workspaceId, on);
            }
            if (!on) continue;
            try {
                await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
                    const found = await this.repo.findVersion(ref.id);
                    if (found === undefined) return okVoid();
                    await this.repo.lockQuotation(ref.workspaceId, found.quotationId);
                    const v = await this.repo.findVersion(ref.id);
                    if (v === undefined || !requireStatus(v.status, ['issued']).ok || v.validUntil === null || v.validUntil >= ctx.today) return okVoid();
                    await this.repo.saveVersion({ ...v, status: 'expired', updatedAt: this.clock.now() });
                    await this.audit.record({
                        workspaceId: v.workspaceId, projectId: v.projectId, actor: null, entityType: 'quotation_version', entityId: v.id,
                        action: 'expire', data: { status: ['issued', 'expired'], validUntil: v.validUntil },
                    });
                    return ok(undefined);
                });
            } catch (e) {
                this.logger.error(`expiring quotation version ${ref.id} failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    // ── portal ──

    /** Issued versions whose `validUntil` is today … today + 7 days (of the workspace's live projects). */
    async portalExpiring(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        const versions = (await this.repo.issuedValidBetween(ctx.workspaceId, ctx.today, addDays(ctx.today, PORTAL_QUOTATION_EXPIRY_DAYS)))
            .filter(v => ctx.projects.has(v.projectId));
        const out: PortalTaskItem[] = [];
        for (const v of versions) {
            const q = await this.repo.findQuotation(v.quotationId);
            if (q?.workspaceId !== ctx.workspaceId) continue;
            out.push({
                kind: 'quotation_expiring',
                params: { number: v.number ?? q.number ?? '', title: q.title, versionNo: v.versionNo },
                href: `/p/${v.projectId}/quotations/${q.id}`,
                dueDate: v.validUntil,
                amount: v.totals.grandTotal,
                projectId: v.projectId,
            });
        }
        return out;
    }
}
