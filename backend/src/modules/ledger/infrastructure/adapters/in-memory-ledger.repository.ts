import { round2 } from '@contrack/domain/money';
import type { CostLedgerEntry, CostLedgerTotals, FinEvent, FinEventFilter } from '../../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import { CostLedgerRepository, FinEventRepository } from '../../application/ports/ledger.repository';
import { commitmentKey, sumTotals, totalsByCode } from '../../domain/ledger-rules';

const copyEntry = (e: CostLedgerEntry): CostLedgerEntry => ({ ...e, createdAt: new Date(e.createdAt.getTime()) });
const copyEvent = (e: FinEvent): FinEvent => ({ ...structuredClone(e), createdAt: new Date(e.createdAt.getTime()) });

const byCreation = <T extends { createdAt: Date; id: string }>(dateOf: (r: T) => string) => (a: T, b: T): number =>
    dateOf(a).localeCompare(dateOf(b)) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

const entryOrder = byCreation<CostLedgerEntry>(e => e.entryDate);
const eventOrder = byCreation<FinEvent>(e => e.eventDate);

/** Memory adapter; mimics the partial unique index on `reverses_id`. Insertion keeps creation order. */
export class InMemoryCostLedgerRepository extends CostLedgerRepository {
    private readonly rows = new Map<string, CostLedgerEntry>();

    private inWorkspace(workspaceId: WorkspaceId): CostLedgerEntry[] {
        return [...this.rows.values()].filter(e => e.workspaceId === workspaceId);
    }

    insertMany(entries: readonly CostLedgerEntry[]): Promise<void> {
        const reversed = new Set([...this.rows.values()].flatMap(e => (e.reversesId === null ? [] : [e.reversesId])));
        for (const e of entries) {
            if (this.rows.has(e.id) || (e.reversesId !== null && reversed.has(e.reversesId))) {
                return Promise.reject(new Error(`duplicate ledger entry ${e.id} (reverses ${e.reversesId ?? '-'})`));
            }
            if (e.reversesId !== null) reversed.add(e.reversesId);
        }
        for (const e of entries) this.rows.set(e.id, copyEntry(e));
        return Promise.resolve();
    }

    findForUpdate(workspaceId: WorkspaceId, id: string): Promise<CostLedgerEntry | undefined> {
        const e = this.rows.get(id);
        return Promise.resolve(e?.workspaceId === workspaceId ? copyEntry(e) : undefined);
    }

    reversedIds(workspaceId: WorkspaceId, ids: readonly string[]): Promise<Set<string>> {
        const wanted = new Set(ids);
        return Promise.resolve(new Set(this.inWorkspace(workspaceId)
            .flatMap(e => (e.reversesId !== null && wanted.has(e.reversesId) ? [e.reversesId] : []))));
    }

    lockCommitments(): Promise<void> {
        return Promise.resolve();
    }

    openByCommitment(workspaceId: WorkspaceId, refs: readonly string[]): Promise<{ commitmentRef: string; costCodeId: string | null; open: number }[]> {
        const wanted = new Set(refs);
        const by = new Map<string, { commitmentRef: string; costCodeId: string | null; open: number }>();
        for (const e of this.inWorkspace(workspaceId)) {
            if (e.commitmentRef === null || !wanted.has(e.commitmentRef) || e.kind === 'actual') continue;
            const key = commitmentKey(e.commitmentRef, e.costCodeId);
            const row = by.get(key) ?? { commitmentRef: e.commitmentRef, costCodeId: e.costCodeId, open: 0 };
            by.set(key, { ...row, open: round2(row.open + e.amount) });
        }
        return Promise.resolve([...by.values()]);
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId, costCodeId?: string): Promise<CostLedgerEntry[]> {
        return Promise.resolve(this.inWorkspace(workspaceId)
            .filter(e => e.projectId === projectId && (costCodeId === undefined || e.costCodeId === costCodeId))
            .sort(entryOrder)
            .map(copyEntry));
    }

    bySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string): Promise<CostLedgerEntry[]> {
        return Promise.resolve(this.inWorkspace(workspaceId)
            .filter(e => e.sourceType === sourceType && e.sourceId === sourceId)
            .sort(entryOrder)
            .map(copyEntry));
    }

    totalsByCostCode(workspaceId: WorkspaceId, projectId: ProjectId): Promise<(CostLedgerTotals & { costCodeId: string | null })[]> {
        return Promise.resolve(totalsByCode(this.inWorkspace(workspaceId).filter(e => e.projectId === projectId)));
    }

    totalsByProject(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, CostLedgerTotals>> {
        const out = new Map<ProjectId, CostLedgerTotals>();
        const entries = this.inWorkspace(workspaceId);
        for (const projectId of new Set(projectIds)) {
            const mine = entries.filter(e => e.projectId === projectId);
            if (mine.length > 0) out.set(projectId, sumTotals(mine));
        }
        return Promise.resolve(out);
    }

    totalsByProjectCostCode(
        workspaceId: WorkspaceId, projectIds: readonly ProjectId[],
    ): Promise<(CostLedgerTotals & { projectId: ProjectId; costCodeId: string | null })[]> {
        const entries = this.inWorkspace(workspaceId);
        return Promise.resolve([...new Set(projectIds)].flatMap(projectId =>
            totalsByCode(entries.filter(e => e.projectId === projectId)).map(t => ({ projectId, ...t }))));
    }

        countByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<number> {
        return Promise.resolve(this.inWorkspace(workspaceId).filter(e => e.projectId === projectId).length);
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const e of [...this.rows.values()]) {
            if (e.workspaceId === workspaceId && e.projectId === projectId) this.rows.delete(e.id);
        }
        return Promise.resolve();
    }
}

export class InMemoryFinEventRepository extends FinEventRepository {
    private readonly rows = new Map<string, FinEvent>();

    private inWorkspace(workspaceId: WorkspaceId): FinEvent[] {
        return [...this.rows.values()].filter(e => e.workspaceId === workspaceId);
    }

    insert(event: FinEvent): Promise<void> {
        const clash = this.rows.has(event.id)
            || (event.reversesId !== null && [...this.rows.values()].some(e => e.reversesId === event.reversesId));
        if (clash) return Promise.reject(new Error(`duplicate financial event ${event.id} (reverses ${event.reversesId ?? '-'})`));
        this.rows.set(event.id, copyEvent(event));
        return Promise.resolve();
    }

    findForUpdate(workspaceId: WorkspaceId, id: string): Promise<FinEvent | undefined> {
        const e = this.rows.get(id);
        return Promise.resolve(e?.workspaceId === workspaceId ? copyEvent(e) : undefined);
    }

    isReversed(workspaceId: WorkspaceId, id: string): Promise<boolean> {
        return Promise.resolve(this.inWorkspace(workspaceId).some(e => e.reversesId === id));
    }

    list(workspaceId: WorkspaceId, filter: FinEventFilter): Promise<FinEvent[]> {
        const types = filter.types === undefined || filter.types.length === 0 ? undefined : new Set<string>(filter.types);
        return Promise.resolve(this.inWorkspace(workspaceId)
            .filter(e => (filter.from === undefined || e.eventDate >= filter.from)
                && (filter.to === undefined || e.eventDate <= filter.to)
                && (types === undefined || types.has(e.eventType))
                && (filter.projectId === undefined || e.projectId === filter.projectId))
            .sort(eventOrder)
            .map(copyEvent));
    }

    bySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string): Promise<FinEvent[]> {
        return Promise.resolve(this.inWorkspace(workspaceId)
            .filter(e => e.sourceType === sourceType && e.sourceId === sourceId)
            .sort(eventOrder)
            .map(copyEvent));
    }

    countByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<number> {
        return Promise.resolve(this.inWorkspace(workspaceId).filter(e => e.projectId === projectId).length);
    }
}
