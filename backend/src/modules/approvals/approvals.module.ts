// ─── Approval workflow (ERP foundation, docs/erp/01-architecture.md §6): generic, auto-skipped when working alone ───
// Provides Approvals (src/shared/application/ports.ts) to every module; owning modules register their ApprovalHandler
// (core registry) in onModuleInit. Routes gated by `project-hub`. Needs ModuleAccess (platform), WorkspaceDirectory
// (workspaces), UserDirectory (identity), AuditLog (audit). Registers the PortalSources task `approval_pending` (WP-35).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { Approvals, PortalSources } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { ApprovalPolicyRepository } from './application/ports/approval-policy.repository';
import { ApprovalRequestRepository } from './application/ports/approval-request.repository';
import { ListApprovalPoliciesUseCase, PutApprovalPolicyUseCase } from './application/use-cases/approval-policies.use-cases';
import { CancelApprovalUseCase } from './application/use-cases/cancel-approval.use-case';
import { DecideApprovalUseCase } from './application/use-cases/decide-approval.use-case';
import { ListApprovalsUseCase } from './application/use-cases/list-approvals.use-case';
import { RequestApprovalUseCase } from './application/use-cases/request-approval.use-case';
import { RepositoryApprovals } from './infrastructure/adapters/approvals.adapter';
import { DrizzleApprovalPolicyRepository } from './infrastructure/adapters/drizzle-approval-policy.repository';
import { DrizzleApprovalRequestRepository } from './infrastructure/adapters/drizzle-approval-request.repository';
import { InMemoryApprovalPolicyRepository } from './infrastructure/adapters/in-memory-approval-policy.repository';
import { InMemoryApprovalRequestRepository } from './infrastructure/adapters/in-memory-approval-request.repository';
import { ApprovalsController } from './presentation/approvals.controller';

@Global()
@Module({
    controllers: [ApprovalsController],
    providers: [
        persistence(ApprovalPolicyRepository, () => new InMemoryApprovalPolicyRepository(), ctx => new DrizzleApprovalPolicyRepository(ctx)),
        persistence(ApprovalRequestRepository, () => new InMemoryApprovalRequestRepository(), ctx => new DrizzleApprovalRequestRepository(ctx)),
        RequestApprovalUseCase,
        CancelApprovalUseCase,
        DecideApprovalUseCase,
        ListApprovalsUseCase,
        ListApprovalPoliciesUseCase,
        PutApprovalPolicyUseCase,
        { provide: Approvals, useClass: RepositoryApprovals },
    ],
    exports: [Approvals],
})
export class ApprovalsModule implements OnModuleInit {
    constructor(private readonly portal: PortalSources, private readonly list: ListApprovalsUseCase) {}

    onModuleInit(): void {
        // Portal (WP-35): pending requests the caller may decide now.
        this.portal.register('project-hub', null, async ctx => {
            const page = await this.list.execute({ userId: ctx.userId, workspaceId: ctx.workspaceId, mine: true, limit: 50 });
            if (!page.ok) return [];
            return page.value.items.map(r => ({
                kind: 'approval_pending' as const,
                params: { title: r.title, subject: r.subject },
                href: '/approvals',
                dueDate: null,
                amount: r.amount,
                projectId: r.projectId,
            }));
        });
    }
}
