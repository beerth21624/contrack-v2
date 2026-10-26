import { MAX_DOC_BYTES } from '@contrack/contract';
import { computeProject, createProject } from '@contrack/domain/project';
import { docsToProject, projectSummary, projectToDocs, stableStringify } from '@contrack/domain/sync';
import { ProjectAssembler } from './project-assembler.service';

const assembler = new ProjectAssembler();

const edited = [
    { docKey: 'meta', data: { projectName: 'บ้านคุณสมชาย', ownerName: 'สมชาย' } },
    { docKey: 'journey', data: { 'project-info': 'done', demolition: 'skipped' } },
    { docKey: 'calc:fill', data: { width: 10, length: 12, height: 0.5 } },
    { docKey: 'boq:R13', data: { mat: 350 } },
] as const;

describe('ProjectAssembler.checkDoc', () => {
    it('accepts a known key with valid data, and null (reset)', () => {
        expect(assembler.checkDoc('calc:fill', { width: 1 })).toEqual({ ok: true, value: 'calc:fill' });
        expect(assembler.checkDoc('boq:R13', null).ok).toBe(true);
    });

    it('refuses an unknown key', () => {
        const r = assembler.checkDoc('calc:nope', {});
        expect(!r.ok && r.error.code).toBe('unprocessable');
        expect(assembler.checkDoc('boq:R99999', { qty: 1 }).ok).toBe(false);
        expect(assembler.checkDoc('other', {}).ok).toBe(false);
    });

    it('refuses a document larger than MAX_DOC_BYTES', () => {
        const r = assembler.checkDoc('calc:fill', { big: 'x'.repeat(MAX_DOC_BYTES) });
        expect(!r.ok && r.error.code).toBe('unprocessable');
        expect(!r.ok && r.error.message).toMatch(/bytes/);
    });

    it('refuses invalid shapes with the shared reason', () => {
        const r = assembler.checkDoc('boq:R13', { price: 3 });
        expect(!r.ok && r.error.code).toBe('unprocessable');
        expect(!r.ok && r.error.message).toMatch(/unknown field/);
        expect(assembler.checkDoc('journey', { 'project-info': 'maybe' }).ok).toBe(false);
    });

    it('refuses missing data (undefined is never a reset)', () => {
        expect(assembler.checkDoc('calc:fill', undefined).ok).toBe(false);
    });
});

describe('ProjectAssembler.evaluate', () => {
    it('assembles exactly like the shared docsToProject and its summary equals the shared projectSummary', () => {
        for (const start of ['sample', 'blank'] as const) {
            const r = assembler.evaluate(start, edited);
            if (!r.ok) throw new Error(r.error.message);
            const shared = docsToProject(start, edited);
            expect(stableStringify(r.value.project)).toBe(stableStringify(shared));
            expect(r.value.summary).toEqual(projectSummary(shared));
            const boq = computeProject(shared).boq;
            expect(r.value.summary.constructionTotal).toBe(boq.constructionTotal);
            expect(r.value.summary.preConstructionTotal).toBe(boq.preConstructionTotal);
        }
    });

    it('round-trips a project through its documents with the same totals', () => {
        const project = { ...createProject('sample'), boqOverrides: { R13: { mat: 350 } } };
        const r = assembler.evaluate('sample', projectToDocs(project));
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.summary).toEqual(projectSummary(project));
    });

    it('with no documents is the plain start project', () => {
        const r = assembler.evaluate('sample', []);
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.summary).toEqual(projectSummary(docsToProject('sample', [])));
    });

    it('refuses documents that stop the project from computing', () => {
        const r = assembler.evaluate('sample', [{ docKey: 'calc:footing', data: { rows: 'not a list' } }]);
        expect(!r.ok && r.error.code).toBe('unprocessable');
    });
});

describe('ProjectAssembler.snapshot', () => {
    it('is plain JSON that recomputes to the same totals', () => {
        const r = assembler.evaluate('sample', edited);
        if (!r.ok) throw new Error(r.error.message);
        const snap = assembler.snapshot(r.value.project);
        expect(snap).not.toBe(r.value.project);
        expect(projectSummary(snap)).toEqual(r.value.summary);
    });
});
