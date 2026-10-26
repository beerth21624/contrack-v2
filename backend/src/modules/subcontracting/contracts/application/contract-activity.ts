// ─── Activity entries of the contracts stream (plan §6 rule 14: who, when, from what to what) ───
import type { UserId } from '../../../../shared/domain';
import type { ScActivityLog, ScActivityRecord } from '../../shared/ports';
import type { Subcontract } from '../domain/entities/subcontract.entity';

export function logContract(
    log: ScActivityLog,
    sc: Subcontract,
    entity: ScActivityRecord['entity'],
    entityId: string,
    action: string,
    actorUserId: UserId | null,
    at: Date,
    data?: Record<string, unknown>,
): Promise<void> {
    return log.record({
        buyerWorkspaceId: sc.buyerWorkspaceId,
        vendorWorkspaceId: sc.vendorWorkspaceId,
        entity,
        entityId,
        action,
        actorUserId,
        at,
        ...(data === undefined ? {} : { data }),
    });
}
