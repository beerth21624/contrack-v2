import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
    DATE_ORDERED_DOC_TYPES, DELETION_EXEMPT_DOC_TYPES, type DocType, businessDateSchema, docTypeSchema, uuidSchema,
} from '@contrack/contract';
import {
    AuditLog, Clock, DocumentNumbering, IdGenerator, type IssueNumberInput, type IssuedNumber, ProjectDeletionGuards, UnitOfWork,
    type VoidNumberInput, WorkspaceDeletionGuards,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../shared/domain/result';
import { NumberingRepository } from '../../application/ports/numbering.repository';
import { type NumberingSeries, effectiveSeries, seriesNumber, seriesPeriodKey } from '../../domain/numbering-series';

/** Numbers skipped at most when a formatted number is already taken (only after a pattern change). */
const MAX_COLLISIONS = 1000;

/**
 * DocumentNumbering over NumberingRepository. Also registers the deletion guards: a project / workspace with any
 * issued number other than `project` codes may not be deleted (checked whether or not the ERP modules are active:
 * issued tax documents must be kept; release 1 has none).
 */
@Injectable()
export class RepositoryDocumentNumbering extends DocumentNumbering implements OnModuleInit {
    constructor(
        private readonly repo: NumberingRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly projectGuards: ProjectDeletionGuards,
        private readonly workspaceGuards: WorkspaceDeletionGuards,
    ) {
        super();
    }

    onModuleInit(): void {
        this.projectGuards.register(async (ws, projectId) => {
            const n = await this.repo.countBlocking(ws, projectId, DELETION_EXEMPT_DOC_TYPES);
            return n > 0 ? [{ reason: 'document_issued_exists', count: n }] : [];
        });
        this.workspaceGuards.register(async ws => {
            const n = await this.repo.countBlocking(ws, null, DELETION_EXEMPT_DOC_TYPES);
            return n > 0 ? [{ reason: 'document_issued_exists', count: n }] : [];
        });
    }

    async series(workspaceId: WorkspaceId, docType: DocType): Promise<NumberingSeries> {
        return effectiveSeries(docType, await this.repo.findSeries(workspaceId, docType));
    }

    /** First seq after `lastSeq` whose number is not taken yet. */
    private async freeSeq(workspaceId: WorkspaceId, series: NumberingSeries, issueDate: string, lastSeq: number): Promise<{ seq: number; number: string }> {
        let seq = lastSeq + 1;
        let number = seriesNumber(series, issueDate, seq);
        for (let i = 0; i < MAX_COLLISIONS && await this.repo.numberExists(workspaceId, series.docType, number); i += 1) {
            seq += 1;
            number = seriesNumber(series, issueDate, seq);
        }
        return { seq, number };
    }

    async issue(input: IssueNumberInput): Promise<Result<IssuedNumber, DomainError>> {
        if (!docTypeSchema.safeParse(input.docType).success) return err(DomainError.validation(`Unknown document type ${input.docType}`));
        if (!businessDateSchema.safeParse(input.issueDate).success) return err(DomainError.validation('issueDate must be a date YYYY-MM-DD'));
        if (!uuidSchema.safeParse(input.subjectId).success) return err(DomainError.validation('subjectId must be a uuid'));
        return this.uow.run(async () => {
            const series = await this.series(input.workspaceId, input.docType);
            const periodKey = seriesPeriodKey(series, input.issueDate);
            return this.repo.exclusive(input.workspaceId, input.docType, periodKey, async (lastSeq): Promise<Result<IssuedNumber, DomainError>> => {
                if (await this.repo.findBySubject(input.workspaceId, input.docType, input.subjectId) !== undefined) {
                    return err(DomainError.conflict('This document already has a number', { reason: 'already_issued' }));
                }
                if (DATE_ORDERED_DOC_TYPES.includes(input.docType)) {
                    const latest = await this.repo.latestIssueDate(input.workspaceId, input.docType, periodKey);
                    if (latest !== undefined && input.issueDate < latest) {
                        return err(DomainError.unprocessable('The date is before the latest document of this series',
                            { reason: 'date_before_last_issued', latestIssueDate: latest }));
                    }
                }
                const { seq, number } = await this.freeSeq(input.workspaceId, series, input.issueDate, lastSeq);
                await this.repo.setLastSeq(input.workspaceId, input.docType, periodKey, seq);
                const id = this.ids.newId();
                await this.repo.insertIssued({
                    id,
                    workspaceId: input.workspaceId,
                    docType: input.docType,
                    number,
                    periodKey,
                    seq,
                    issueDate: input.issueDate,
                    subjectType: input.subjectType,
                    subjectId: input.subjectId,
                    projectId: input.projectId,
                    issuedBy: input.issuedBy,
                    issuedAt: this.clock.now(),
                    status: 'issued',
                    voidedBy: null,
                    voidedAt: null,
                    voidReason: '',
                });
                await this.audit.record({
                    workspaceId: input.workspaceId, projectId: input.projectId, actor: input.issuedBy,
                    entityType: 'issued_document', entityId: id, action: 'issue',
                    data: { docType: input.docType, number, subjectType: input.subjectType, subjectId: input.subjectId, issueDate: input.issueDate },
                });
                return ok({ number, seq, periodKey, issuedDocumentId: id });
            });
        });
    }

    async void(input: VoidNumberInput): Promise<Result<void, DomainError>> {
        return this.uow.run(async () => {
            const found = await this.repo.findBySubject(input.workspaceId, input.docType, input.subjectId);
            if (found === undefined) return err(DomainError.notFound('Issued document'));
            if (found.status === 'voided') return err(DomainError.conflict('The number is already voided', { reason: 'already_voided' }));
            const reason = input.reason.trim().slice(0, 500);
            await this.repo.markVoided(input.workspaceId, found.id, input.by, this.clock.now(), reason);
            await this.audit.record({
                workspaceId: input.workspaceId, projectId: found.projectId, actor: input.by,
                entityType: 'issued_document', entityId: found.id, action: 'void',
                data: { docType: found.docType, number: found.number, reason },
            });
            return okVoid();
        });
    }

    async preview(workspaceId: WorkspaceId, docType: DocType, issueDate: string): Promise<string> {
        return this.previewOf(workspaceId, await this.series(workspaceId, docType), issueDate);
    }

    /** Next number of an already loaded series (no reservation). */
    async previewOf(workspaceId: WorkspaceId, series: NumberingSeries, issueDate: string): Promise<string> {
        const periodKey = seriesPeriodKey(series, issueDate);
        const lastSeq = await this.repo.peekLastSeq(workspaceId, series.docType, periodKey);
        return (await this.freeSeq(workspaceId, series, issueDate, lastSeq)).number;
    }
}
