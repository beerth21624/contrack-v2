// ─── What the variations module plugs into the core registries (wired in VariationsModule.onModuleInit) ───
// ApprovalHandlers('variation.submit'), CustomerLinkHandlers('variation'), HubRollups('variations'), BaselineUnlockGuards.
import { Injectable } from '@nestjs/common';
import { type ProjectRollup, VARIATION_OPEN_STATUSES, type VariationLinkPayload } from '@contrack/contract';
import {
    type ApprovalDecidedEvent, AuditLog, Clock, type CustomerLinkRespondInput, type CustomerLinkSubjectView, ModuleFlags, UnitOfWork,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../shared/domain/result';
import { VariationRepository } from './ports/variation.repository';
import { VariationViews } from './variation-views';
import { MODULE, VariationWorkflow, transact } from './variation.service';

/** Variations a customer link never shows (not sent to the customer yet, or dropped before). */
const HIDDEN_FROM_LINKS = new Set(['draft', 'pending_approval', 'cancelled']);

@Injectable()
export class VariationHandlers {
    constructor(
        private readonly repo: VariationRepository,
        private readonly workflow: VariationWorkflow,
        private readonly views: VariationViews,
        private readonly flags: ModuleFlags,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    // ── approval of `variation.submit` (subject id = the variation id) ──

    async onApprovalDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(e.workspaceId, e.subjectId.toLowerCase());
            // Withdrawn meanwhile: nothing to apply.
            if (v?.status !== 'pending_approval') return okVoid();
            if (e.decision === 'approved') {
                const submitted = await this.workflow.submitLocked(v, e.decidedBy);
                return submitted.ok ? okVoid() : submitted;
            }
            await this.repo.save({ ...v, status: 'draft', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: v.projectId, actor: e.decidedBy, entityType: 'variation', entityId: v.id,
                action: 'approval_rejected', data: { status: ['pending_approval', 'draft'], note: e.note },
            });
            return okVoid();
        });
    }

    // ── customer link (subject id = the variation id) ──

    async linkView(workspaceId: WorkspaceId, subjectId: string): Promise<CustomerLinkSubjectView | undefined> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return undefined;
        const v = await this.repo.find(subjectId.toLowerCase());
        if (v?.workspaceId !== workspaceId || HIDDEN_FROM_LINKS.has(v.status)) return undefined;
        const contract = await this.workflow.contractOf(v);
        const payload: VariationLinkPayload = {
            // The sandbox holds calculator inputs and BOQ unit costs: never sent to the customer.
            variation: { ...(await this.views.detail(v, { seesCost: false, canEdit: false })), sandbox: { calculators: {}, boqOverrides: {} } },
            projectName: await this.workflow.projectName(workspaceId, v.projectId),
            contractNumber: contract?.number ?? null,
        };
        return { projectId: v.projectId, language: v.language, title: v.number ?? v.title, respondable: v.status === 'submitted', payload };
    }

    async linkRespond(i: CustomerLinkRespondInput): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(i.workspaceId, MODULE))) {
            return err(DomainError.conflict('The document can no longer be answered', { reason: 'invalid_transition' }));
        }
        if (i.action !== 'accept' && i.action !== 'reject') {
            return err(DomainError.unprocessable('This document does not take that answer', { reason: 'action_not_supported' }));
        }
        const action = i.action;
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(i.workspaceId, i.subjectId.toLowerCase());
            if (v?.projectId !== i.projectId) return err(DomainError.notFound('Variation'));
            const answered = await this.workflow.respondLocked(v, { action, name: i.name, note: i.note, at: i.at, actor: null, via: 'link' });
            return answered.ok ? okVoid() : answered;
        });
    }

    async afterLinkRespond(i: CustomerLinkRespondInput): Promise<void> {
        await this.workflow.notifyResponse(i.workspaceId, i.subjectId.toLowerCase(), null);
    }

    // ── hub roll-up and the baseline unlock guard ──

    /** openVariations: VOs not answered yet (draft, waiting for approval, sent to the customer). */
    async rollup(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, Partial<ProjectRollup>>> {
        const out = new Map<ProjectId, Partial<ProjectRollup>>();
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return out;
        for (const id of projectIds) out.set(id, { openVariations: 0 });
        for (const v of await this.repo.listByProjects(workspaceId, projectIds)) {
            if (!VARIATION_OPEN_STATUSES.includes(v.status)) continue;
            const r = out.get(v.projectId);
            if (r !== undefined) r.openVariations = (r.openVariations ?? 0) + 1;
        }
        return out;
    }

    /** An accepted VO changed the cost codes: the baseline stays locked. */
    async unlockBlockers(workspaceId: WorkspaceId, projectId: ProjectId): Promise<{ reason: string; count: number }[]> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return [];
        const accepted = (await this.repo.listByProject(workspaceId, projectId)).filter(v => v.status === 'accepted').length;
        return accepted > 0 ? [{ reason: 'variations', count: accepted }] : [];
    }
}
