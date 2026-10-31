import { Injectable } from '@nestjs/common';
import type { ApprovalSubject } from '@contrack/contract';
import { AuditLog, Clock, UnitOfWork } from '../../../../shared/application/ports';
import { type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { ApprovalRequestRepository } from '../ports/approval-request.repository';

/**
 * `Approvals.cancel`: the owning module withdrew the document; its pending request becomes `cancelled` (pending step
 * `skipped`). Nothing when no request is pending. Joins the caller's transaction; the caller checked access already.
 */
@Injectable()
export class CancelApprovalUseCase {
    constructor(
        private readonly requests: ApprovalRequestRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(workspaceId: WorkspaceId, subject: ApprovalSubject, rawSubjectId: string, by: UserId): Promise<void> {
        if (!isUuid(rawSubjectId)) return;
        const subjectId = rawSubjectId.toLowerCase();
        await this.uow.run(async () => {
            const pending = await this.requests.findPending(workspaceId, subject, subjectId);
            if (pending === undefined) return;
            const request = await this.requests.lockForUpdate(workspaceId, pending.id);
            if (request?.cancel(by, this.clock.now()).ok !== true) return;
            await this.requests.update(request);
            await this.audit.record({
                workspaceId,
                projectId: request.projectId,
                actor: by,
                entityType: 'approval_request',
                entityId: request.id,
                action: 'cancelled',
                data: { subject, subjectId, status: ['pending', 'cancelled'] },
            });
        });
    }
}
