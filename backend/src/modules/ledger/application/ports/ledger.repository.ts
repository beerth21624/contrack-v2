import type { CostLedgerEntry, CostLedgerTotals, FinEvent, FinEventFilter } from '../../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';

/** `cost_ledger_entries` (append-only). Every query filters by workspace. */
export abstract class CostLedgerRepository {
    abstract insertMany(entries: readonly CostLedgerEntry[]): Promise<void>;
    /** The row, locked until the transaction ends (PostgreSQL). */
    abstract findForUpdate(workspaceId: WorkspaceId, id: string): Promise<CostLedgerEntry | undefined>;
    /** Ids among `ids` that already have a reversal row. */
    abstract reversedIds(workspaceId: WorkspaceId, ids: readonly string[]): Promise<Set<string>>;
    /** Serializes writers of these commitments until the transaction ends (advisory locks; memory: no-op). */
    abstract lockCommitments(workspaceId: WorkspaceId, refs: readonly string[]): Promise<void>;
    /** Σ commit + commit_release per (commitment_ref, cost_code_id) for these refs. */
    abstract openByCommitment(
        workspaceId: WorkspaceId, refs: readonly string[],
    ): Promise<{ commitmentRef: string; costCodeId: string | null; open: number }[]>;
    /** Oldest first (entry date, creation, id); only one cost code when given. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId, costCodeId?: string): Promise<CostLedgerEntry[]>;
    /** Oldest first; `forUpdate` locks the rows (PostgreSQL). */
    abstract bySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string, forUpdate?: boolean): Promise<CostLedgerEntry[]>;
    abstract totalsByCostCode(workspaceId: WorkspaceId, projectId: ProjectId): Promise<(CostLedgerTotals & { costCodeId: string | null })[]>;
    abstract totalsByProject(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, CostLedgerTotals>>;
    abstract countByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<number>;
    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}

/** `fin_events` (append-only). Every query filters by workspace. */
export abstract class FinEventRepository {
    abstract insert(event: FinEvent): Promise<void>;
    abstract findForUpdate(workspaceId: WorkspaceId, id: string): Promise<FinEvent | undefined>;
    abstract isReversed(workspaceId: WorkspaceId, id: string): Promise<boolean>;
    /** Oldest first (event date, creation, id). */
    abstract list(workspaceId: WorkspaceId, filter: FinEventFilter): Promise<FinEvent[]>;
    abstract bySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string): Promise<FinEvent[]>;
    abstract countByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<number>;
}
