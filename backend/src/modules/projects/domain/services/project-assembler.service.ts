// ─── ProjectAssembler: the shared BOQ domain as the server uses it ───
// The server never re-implements a rule: keys, document shapes, "does it still compute" and the summary all come
// from src/domain/sync (the same code the browser runs), so a total stored here is the total the user sees.
import { MAX_DOC_BYTES } from '@contrack/contract';
import type { Project as BoqProject, ProjectStart } from '@contrack/domain/project';
import {
    type DocEntry, type DocKey, docBytes, docsToProject, isDocKey, projectSummary, validateDoc, validateProject,
} from '@contrack/domain/sync';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';
import type { ProjectSummary } from '../entities/project.entity';

export interface EvaluatedProject {
    /** The project the documents make. */
    project: BoqProject;
    /** What the project list shows (recomputed by the shared engine). */
    summary: ProjectSummary;
}

const isFiniteSummary = (s: ProjectSummary): boolean =>
    Number.isFinite(s.constructionTotal) && Number.isFinite(s.preConstructionTotal)
    && Number.isSafeInteger(s.levelsDone) && Number.isSafeInteger(s.levelsTotal);

export class ProjectAssembler {
    /** A document key that names something real (calculator, BOQ line, planning sheet, meta, journey). */
    checkKey(docKey: string): Result<DocKey, DomainError> {
        return isDocKey(docKey)
            ? ok(docKey)
            : err(DomainError.unprocessable(`unknown document "${docKey}"`, { docKey }));
    }

    /** Key, size (≤ MAX_DOC_BYTES of JSON) and shape of one document. `null` = reset; `undefined` is refused. */
    checkDoc(docKey: string, data: unknown): Result<DocKey, DomainError> {
        const key = this.checkKey(docKey);
        if (!key.ok) return key;
        if (data === undefined) {
            return err(DomainError.unprocessable(`document "${docKey}" has no data (send null to reset it)`, { docKey }));
        }
        const bytes = docBytes(data);
        if (bytes > MAX_DOC_BYTES) {
            return err(DomainError.unprocessable(
                `document "${docKey}" is ${bytes} bytes, more than the limit of ${MAX_DOC_BYTES}`,
                { docKey, bytes, maxBytes: MAX_DOC_BYTES },
            ));
        }
        const shape = validateDoc(docKey, data);
        if (!shape.ok) return err(DomainError.unprocessable(shape.reason, { docKey, reason: shape.reason }));
        return ok(key.value);
    }

    /** The project rebuilt from its documents (shared docsToProject). */
    assemble(start: ProjectStart, docs: readonly DocEntry[]): BoqProject {
        return docsToProject(start, docs);
    }

    /** The project the documents make, refused when it no longer computes with finite totals; with its summary. */
    evaluate(start: ProjectStart, docs: readonly DocEntry[]): Result<EvaluatedProject, DomainError> {
        const project = this.assemble(start, docs);
        const valid = validateProject(project);
        if (!valid.ok) return err(DomainError.unprocessable(valid.reason, { reason: valid.reason }));
        let summary: ProjectSummary;
        try {
            summary = projectSummary(project);
        } catch (e) {
            const reason = `the project no longer computes: ${e instanceof Error ? e.message : String(e)}`;
            return err(DomainError.unprocessable(reason, { reason }));
        }
        if (!isFiniteSummary(summary)) {
            return err(DomainError.unprocessable('the project totals are not numbers', { reason: 'non-finite summary' }));
        }
        return ok({ project, summary });
    }

    /** The project as plain JSON (what a revision stores, identical in memory and in PostgreSQL). */
    snapshot(project: BoqProject): BoqProject {
        return JSON.parse(JSON.stringify(project)) as BoqProject;
    }
}
