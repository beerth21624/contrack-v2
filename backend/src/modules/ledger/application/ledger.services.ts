// ─── CostLedger + FinancialEvents (WP-20): append-only rows written inside the caller's transaction ───
// Everything is validated before the first write (an `err` returned does not roll back the caller's work).
import { Injectable } from '@nestjs/common';
import { isBusinessDate } from '@contrack/domain/dates/business-date';
import { round2, roundQty } from '@contrack/domain/money';
import {
    Clock, type CostLedgerCodeTotals, type CostLedgerEntry, type CostLedgerEntryInput, type CostLedgerReverseInput, type CostLedgerTotals,
    CostCodeLookup, CostLedger, type FinEvent, type FinEventFilter, type FinEventInput, FinancialEvents, IdGenerator, ProjectStatusLookup,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';
import { type Result, err, ok } from '../../../shared/domain/result';
import {
    commitmentBreach, commitmentKey, costEntryProblem, finEventProblem, movesCommitment, normalizeCostEntry,
} from '../domain/ledger-rules';
import { CostLedgerRepository, FinEventRepository } from './ports/ledger.repository';

const invalid = (field: string): DomainError => DomainError.validation(`Invalid ${field}`, { field });

function reverseProblem(input: CostLedgerReverseInput): DomainError | undefined {
    if (typeof input.date !== 'string' || !isBusinessDate(input.date)) return invalid('date');
    if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 1000)) return invalid('note');
    return undefined;
}

const alreadyReversed = (): DomainError => DomainError.conflict('The entry has already been reversed', { reason: 'already_reversed' });
const reversalEntry = (): DomainError => DomainError.conflict('A reversal cannot be reversed', { reason: 'reversal_entry' });

/** Projects named by the rows must exist in the workspace (no FK for fin_events; memory adapters). */
async function checkProjects(
    projects: ProjectStatusLookup, workspaceId: WorkspaceId, ids: Iterable<ProjectId>,
): Promise<DomainError | undefined> {
    for (const id of new Set(ids)) {
        const p = await projects.find(id);
        if (p?.workspaceId !== workspaceId) return DomainError.notFound('Project');
    }
    return undefined;
}

@Injectable()
export class LedgerService extends CostLedger {
    constructor(
        private readonly repo: CostLedgerRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly projects: ProjectStatusLookup,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {
        super();
    }

    async post(workspaceId: WorkspaceId, entries: readonly CostLedgerEntryInput[]): Promise<Result<CostLedgerEntry[], DomainError>> {
        if (entries.length === 0) return ok([]);
        for (const e of entries) {
            const problem = costEntryProblem(e);
            if (problem !== undefined) return err(invalid(problem));
        }
        const now = this.clock.now();
        const rows: CostLedgerEntry[] = entries.map(e => ({
            ...normalizeCostEntry(e), id: this.ids.newId(), workspaceId, reversesId: null, createdAt: now,
        }));
        const missingProject = await checkProjects(this.projects, workspaceId, rows.map(r => r.projectId));
        if (missingProject !== undefined) return err(missingProject);
        // Cost codes must belong to the row's project (omitted codes are fine: late costs still arrive).
        const codesByProject = new Map<ProjectId, Set<string>>();
        for (const r of rows) {
            if (r.costCodeId === null) continue;
            const set = codesByProject.get(r.projectId) ?? new Set<string>();
            set.add(r.costCodeId);
            codesByProject.set(r.projectId, set);
        }
        for (const [projectId, wanted] of codesByProject) {
            const found = new Set((await this.costCodes.findMany(workspaceId, projectId, [...wanted])).map(c => c.id.toLowerCase()));
            if ([...wanted].some(id => !found.has(id))) return err(DomainError.notFound('Cost code'));
        }
        const breach = await this.checkCommitments(workspaceId, rows);
        if (breach !== undefined) return err(breach);
        await this.repo.insertMany(rows);
        return ok(rows);
    }

    async reverse(workspaceId: WorkspaceId, entryId: string, input: CostLedgerReverseInput): Promise<Result<CostLedgerEntry, DomainError>> {
        const problem = reverseProblem(input);
        if (problem !== undefined) return err(problem);
        const original = await this.repo.findForUpdate(workspaceId, entryId.toLowerCase());
        if (original === undefined) return err(DomainError.notFound('Cost ledger entry'));
        const written = await this.writeReversals(workspaceId, [original], input);
        if (!written.ok) return written;
        const [row] = written.value;
        return row === undefined ? err(alreadyReversed()) : ok(row);
    }

    async reverseSource(
        workspaceId: WorkspaceId, sourceType: string, sourceId: string, input: CostLedgerReverseInput,
    ): Promise<Result<CostLedgerEntry[], DomainError>> {
        const problem = reverseProblem(input);
        if (problem !== undefined) return err(problem);
        const rows = await this.repo.bySource(workspaceId, sourceType, sourceId.toLowerCase(), true);
        const reversed = new Set(rows.flatMap(r => (r.reversesId === null ? [] : [r.reversesId])));
        for (const id of await this.repo.reversedIds(workspaceId, rows.map(r => r.id))) reversed.add(id);
        const open = rows.filter(r => r.reversesId === null && !reversed.has(r.id));
        if (open.length === 0) return ok([]);
        return this.writeReversals(workspaceId, open, input);
    }

    async totalsByCostCode(workspaceId: WorkspaceId, projectId: ProjectId): Promise<CostLedgerCodeTotals[]> {
        return this.repo.totalsByCostCode(workspaceId, projectId);
    }

    async totalsByProject(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, CostLedgerTotals>> {
        return this.repo.totalsByProject(workspaceId, projectIds);
    }

    async entriesBySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string): Promise<CostLedgerEntry[]> {
        return this.repo.bySource(workspaceId, sourceType, sourceId.toLowerCase());
    }

    async openCommitments(workspaceId: WorkspaceId, refs: readonly string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>();
        for (const r of await this.repo.openByCommitment(workspaceId, refs.map(ref => ref.toLowerCase()))) {
            out.set(r.commitmentRef, round2((out.get(r.commitmentRef) ?? 0) + r.open));
        }
        return out;
    }

    /** Reversal rows (negated amount / qty) for originals that are neither reversals nor reversed yet. */
    private async writeReversals(
        workspaceId: WorkspaceId, originals: readonly CostLedgerEntry[], input: CostLedgerReverseInput,
    ): Promise<Result<CostLedgerEntry[], DomainError>> {
        if (originals.some(o => o.reversesId !== null)) return err(reversalEntry());
        const reversed = await this.repo.reversedIds(workspaceId, originals.map(o => o.id));
        if (reversed.size > 0) return err(alreadyReversed());
        const now = this.clock.now();
        // Releases first, then actuals, then commits: a source's own releases are undone before its commitment.
        const rank = { commit_release: 0, actual: 1, commit: 2 } as const;
        const rows: CostLedgerEntry[] = [...originals].sort((a, b) => rank[a.kind] - rank[b.kind]).map(o => ({
            ...o,
            id: this.ids.newId(),
            entryDate: input.date,
            amount: round2(-o.amount),
            qty: o.qty === null ? null : roundQty(-o.qty),
            reversesId: o.id,
            note: (input.note ?? '').trim(),
            createdBy: input.by,
            createdAt: now,
        }));
        const breach = await this.checkCommitments(workspaceId, rows);
        if (breach !== undefined) return err(breach);
        await this.repo.insertMany(rows);
        return ok(rows);
    }

    /** Locks the touched commitments, then refuses rows that would leave one below 0. */
    private async checkCommitments(workspaceId: WorkspaceId, rows: readonly CostLedgerEntry[]): Promise<DomainError | undefined> {
        const refs = [...new Set(rows.filter(movesCommitment).flatMap(r => (r.commitmentRef === null ? [] : [r.commitmentRef])))];
        if (refs.length === 0) return undefined;
        await this.repo.lockCommitments(workspaceId, refs);
        const open = new Map((await this.repo.openByCommitment(workspaceId, refs)).map(o => [commitmentKey(o.commitmentRef, o.costCodeId), o.open]));
        const breach = commitmentBreach(open, rows);
        if (breach === undefined) return undefined;
        return DomainError.unprocessable('The release is larger than the open commitment', { reason: 'commitment_exceeded', ...breach });
    }
}

@Injectable()
export class FinancialEventsService extends FinancialEvents {
    constructor(
        private readonly repo: FinEventRepository,
        private readonly projects: ProjectStatusLookup,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {
        super();
    }

    async post(workspaceId: WorkspaceId, event: FinEventInput): Promise<Result<FinEvent, DomainError>> {
        const problem = finEventProblem(event);
        if (problem !== undefined) return err(invalid(problem));
        if (event.projectId !== null) {
            const missing = await checkProjects(this.projects, workspaceId, [event.projectId]);
            if (missing !== undefined) return err(missing);
        }
        const row: FinEvent = {
            id: this.ids.newId(),
            workspaceId,
            projectId: event.projectId,
            eventDate: event.eventDate,
            eventType: event.eventType,
            direction: event.direction,
            counterpartyType: event.counterpartyType,
            counterpartyId: event.counterpartyId === undefined || event.counterpartyId === null ? null : event.counterpartyId.toLowerCase(),
            counterpartyName: event.counterpartyName.trim(),
            counterpartyTaxId: (event.counterpartyTaxId ?? '').trim(),
            counterpartyBranch: (event.counterpartyBranch ?? '').trim(),
            docType: event.docType ?? null,
            docNumber: event.docNumber ?? null,
            docDate: event.docDate ?? null,
            sourceType: event.sourceType.trim(),
            sourceId: event.sourceId.toLowerCase(),
            net: round2(event.net),
            vat: round2(event.vat ?? 0),
            wht: round2(event.wht ?? 0),
            retention: round2(event.retention ?? 0),
            cash: round2(event.cash ?? 0),
            reversesId: null,
            data: event.data ?? {},
            createdBy: event.by,
            createdAt: this.clock.now(),
        };
        await this.repo.insert(row);
        return ok(row);
    }

    async reverse(workspaceId: WorkspaceId, eventId: string, input: CostLedgerReverseInput): Promise<Result<FinEvent, DomainError>> {
        const problem = reverseProblem(input);
        if (problem !== undefined) return err(problem);
        const original = await this.repo.findForUpdate(workspaceId, eventId.toLowerCase());
        if (original === undefined) return err(DomainError.notFound('Financial event'));
        if (original.reversesId !== null) return err(reversalEntry());
        if (await this.repo.isReversed(workspaceId, original.id)) return err(alreadyReversed());
        const row: FinEvent = {
            ...original,
            id: this.ids.newId(),
            eventDate: input.date,
            net: round2(-original.net),
            vat: round2(-original.vat),
            wht: round2(-original.wht),
            retention: round2(-original.retention),
            cash: round2(-original.cash),
            reversesId: original.id,
            data: input.note === undefined || input.note.trim() === '' ? original.data : { ...original.data, reversalNote: input.note.trim() },
            createdBy: input.by,
            createdAt: this.clock.now(),
        };
        await this.repo.insert(row);
        return ok(row);
    }

    async list(workspaceId: WorkspaceId, filter: FinEventFilter): Promise<FinEvent[]> {
        return this.repo.list(workspaceId, filter);
    }

    async bySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string): Promise<FinEvent[]> {
        return this.repo.bySource(workspaceId, sourceType, sourceId.toLowerCase());
    }
}
