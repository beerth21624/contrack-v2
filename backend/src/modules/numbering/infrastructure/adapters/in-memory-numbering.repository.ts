import type { DocType } from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { KeyedMutex } from '../../../../shared/infrastructure/keyed-mutex';
import { type IssuedDocumentRecord, NumberingRepository, type SavedSeries } from '../../application/ports/numbering.repository';

const counterKey = (ws: WorkspaceId, docType: DocType, periodKey: string): string => `${ws}|${docType}|${periodKey}`;

/**
 * Memory adapter (tests / trying without a database); stores snapshots. The in-memory UnitOfWork has no rollback, so
 * a number issued by a transaction that later fails stays used here (Postgres rolls it back).
 */
export class InMemoryNumberingRepository extends NumberingRepository {
    private readonly series = new Map<string, SavedSeries>();
    private readonly counters = new Map<string, number>();
    private readonly issued = new Map<string, IssuedDocumentRecord>();
    private readonly mutex = new KeyedMutex();

    findSeries(workspaceId: WorkspaceId, docType: DocType): Promise<SavedSeries | undefined> {
        const s = this.series.get(`${workspaceId}|${docType}`);
        return Promise.resolve(s === undefined ? undefined : { ...s });
    }

    listSeries(workspaceId: WorkspaceId): Promise<SavedSeries[]> {
        return Promise.resolve([...this.series.entries()].filter(([k]) => k.startsWith(`${workspaceId}|`)).map(([, s]) => ({ ...s })));
    }

    saveSeries(workspaceId: WorkspaceId, series: SavedSeries): Promise<void> {
        this.series.set(`${workspaceId}|${series.docType}`, { ...series });
        return Promise.resolve();
    }

    exclusive<T>(workspaceId: WorkspaceId, docType: DocType, periodKey: string, work: (lastSeq: number) => Promise<T>): Promise<T> {
        const key = counterKey(workspaceId, docType, periodKey);
        return this.mutex.run(key, () => work(this.counters.get(key) ?? 0));
    }

    setLastSeq(workspaceId: WorkspaceId, docType: DocType, periodKey: string, seq: number): Promise<void> {
        this.counters.set(counterKey(workspaceId, docType, periodKey), seq);
        return Promise.resolve();
    }

    peekLastSeq(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<number> {
        return Promise.resolve(this.counters.get(counterKey(workspaceId, docType, periodKey)) ?? 0);
    }

    private rows(workspaceId: WorkspaceId): IssuedDocumentRecord[] {
        return [...this.issued.values()].filter(r => r.workspaceId === workspaceId);
    }

    latestIssueDate(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<string | undefined> {
        let latest: string | undefined;
        for (const r of this.rows(workspaceId)) {
            if (r.docType === docType && r.periodKey === periodKey && (latest === undefined || r.issueDate > latest)) latest = r.issueDate;
        }
        return Promise.resolve(latest);
    }

    countInPeriod(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<number> {
        return Promise.resolve(this.rows(workspaceId).filter(r => r.docType === docType && r.periodKey === periodKey).length);
    }

    numberExists(workspaceId: WorkspaceId, docType: DocType, number: string): Promise<boolean> {
        return Promise.resolve(this.rows(workspaceId).some(r => r.docType === docType && r.number === number));
    }

    findBySubject(workspaceId: WorkspaceId, docType: DocType, subjectId: string): Promise<IssuedDocumentRecord | undefined> {
        const r = this.rows(workspaceId).find(x => x.docType === docType && x.subjectId === subjectId);
        return Promise.resolve(r === undefined ? undefined : { ...r });
    }

    insertIssued(record: IssuedDocumentRecord): Promise<void> {
        const clash = this.rows(record.workspaceId).some(r => r.docType === record.docType
            && (r.number === record.number || r.subjectId === record.subjectId));
        if (clash) return Promise.reject(new Error('issued_documents unique violation'));
        this.issued.set(record.id, { ...record });
        return Promise.resolve();
    }

    markVoided(workspaceId: WorkspaceId, id: string, by: UserId, at: Date, reason: string): Promise<void> {
        const r = this.issued.get(id);
        if (r?.workspaceId === workspaceId) this.issued.set(id, { ...r, status: 'voided', voidedBy: by, voidedAt: at, voidReason: reason });
        return Promise.resolve();
    }

    searchNumbers(workspaceId: WorkspaceId, q: string, limit: number): Promise<IssuedDocumentRecord[]> {
        const needle = q.toLowerCase();
        return Promise.resolve([...this.issued.values()]
            .filter(r => r.workspaceId === workspaceId && r.number.toLowerCase().includes(needle))
            .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
            .slice(0, limit)
            .map(r => ({ ...r })));
    }

    countBlocking(workspaceId: WorkspaceId, projectId: ProjectId | null, exemptTypes: readonly DocType[]): Promise<number> {
        return Promise.resolve(this.rows(workspaceId)
            .filter(r => !exemptTypes.includes(r.docType) && (projectId === null || r.projectId === projectId)).length);
    }
}
