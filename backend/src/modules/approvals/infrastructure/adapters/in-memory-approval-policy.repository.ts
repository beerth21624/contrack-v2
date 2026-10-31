import type { ApprovalSubject } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { ApprovalPolicyRepository, type SavedApprovalPolicy } from '../../application/ports/approval-policy.repository';

const copy = (p: SavedApprovalPolicy): SavedApprovalPolicy => ({ ...p, approverRoles: [...p.approverRoles], updatedAt: new Date(p.updatedAt.getTime()) });

/** Map-based; stores snapshots. */
export class InMemoryApprovalPolicyRepository extends ApprovalPolicyRepository {
    private readonly rows = new Map<string, { workspaceId: WorkspaceId; policy: SavedApprovalPolicy }>();

    find(workspaceId: WorkspaceId, subject: ApprovalSubject): Promise<SavedApprovalPolicy | undefined> {
        const row = this.rows.get(`${workspaceId}|${subject}`);
        return Promise.resolve(row === undefined ? undefined : copy(row.policy));
    }

    listByWorkspace(workspaceId: WorkspaceId): Promise<SavedApprovalPolicy[]> {
        return Promise.resolve([...this.rows.values()].filter(r => r.workspaceId === workspaceId).map(r => copy(r.policy)));
    }

    save(workspaceId: WorkspaceId, policy: SavedApprovalPolicy): Promise<void> {
        this.rows.set(`${workspaceId}|${policy.subject}`, { workspaceId, policy: copy(policy) });
        return Promise.resolve();
    }
}
