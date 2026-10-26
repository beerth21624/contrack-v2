import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project } from '../../project';
import { CALCULATORS } from '../../calculators/registry';
import { JOURNEY_LEVELS } from '../../journey/levels';
import {
    applyDoc, diffDocs, docBytes, docsToProject, projectSummary, projectToDocs, stableStringify, validateDoc, validateProject,
} from '../project-docs';
import { isDocKey, isKnownBoqLine, parseDocKey } from '../doc-keys';

/** A project with something in every kind of document. */
function editedProject(): Project {
    const base = createProject('sample');
    const footing = CALCULATORS.find(c => c.id === 'footing');
    if (!footing) throw new Error('footing missing');
    return {
        ...base,
        meta: { ...base.meta, projectName: 'บ้านคุณสมชาย', ownerName: 'สมชาย' },
        journey: { 'project-info': 'done', 'land-inspection': 'done', demolition: 'skipped' },
        calculators: { footing: footing.defaults(), fill: { width: 10, length: 12, height: 0.5 } },
        boqOverrides: { R13: { mat: 350 }, R97: { qty: 40, note: 'ตามแบบ' } },
        planning: { cashflow: { quotationFactor: 1.25 } as never },
    };
}

describe('doc keys', () => {
    it('accept what exists and reject what does not', () => {
        expect(parseDocKey('meta')).toEqual({ kind: 'meta' });
        expect(parseDocKey('journey')).toEqual({ kind: 'journey' });
        expect(parseDocKey('calc:footing')).toEqual({ kind: 'calc', calcId: 'footing' });
        expect(parseDocKey('calc:nope')).toBeUndefined();
        expect(parseDocKey('boq:R13')).toEqual({ kind: 'boq', lineKey: 'R13' });
        expect(parseDocKey('boq:R99999')).toBeUndefined();
        expect(parseDocKey('planning:cashflow')).toEqual({ kind: 'planning', sheet: 'cashflow' });
        expect(parseDocKey('planning:other')).toBeUndefined();
        expect(parseDocKey('other')).toBeUndefined();
        expect(isDocKey('calc:brick')).toBe(true);
    });

    it('accept every key the BOQ can produce, including calculator slot rows', () => {
        const result = computeProject(createProject('sample'));
        const keys = result.boq.sections.flatMap(s => s.rows.map(r => r.key));
        expect(keys.some(k => k.includes(':'))).toBe(true);
        for (const k of keys) expect(isKnownBoqLine(k), k).toBe(true);
    });

    it('every calculator has a valid key', () => {
        for (const c of CALCULATORS) expect(isDocKey(`calc:${c.id}`), c.id).toBe(true);
    });
});

describe('project ⇄ documents', () => {
    it('round-trips: documents rebuild the same project and the same totals', () => {
        for (const p of [editedProject(), createProject('blank'), createProject('sample')]) {
            const start = p.start ?? 'sample';
            const rebuilt = docsToProject(start, projectToDocs(p));
            expect(stableStringify(projectToDocs(rebuilt))).toBe(stableStringify(projectToDocs(p)));
            const a = computeProject(p).boq;
            const b = computeProject(rebuilt).boq;
            expect(b.constructionTotal).toBe(a.constructionTotal);
            expect(b.preConstructionTotal).toBe(a.preConstructionTotal);
        }
    });

    it('applyDoc sets and resets each kind of document', () => {
        let p = createProject('sample');
        p = applyDoc(p, 'calc:fill', { width: 1 });
        expect(p.calculators.fill).toEqual({ width: 1 });
        p = applyDoc(p, 'calc:fill', null);
        expect(p.calculators.fill).toBeUndefined();
        p = applyDoc(p, 'boq:R13', { qty: 2 });
        expect(p.boqOverrides.R13).toEqual({ qty: 2 });
        p = applyDoc(p, 'boq:R13', null);
        expect(p.boqOverrides.R13).toBeUndefined();
        p = applyDoc(p, 'journey', { 'project-info': 'done' });
        expect(p.journey).toEqual({ 'project-info': 'done' });
        p = applyDoc(p, 'planning:manday', { subcontractLabourShare: 0.3 });
        expect(p.planning?.manday).toEqual({ subcontractLabourShare: 0.3 });
        p = applyDoc(p, 'planning:manday', null);
        expect(p.planning?.manday).toBeUndefined();
        p = applyDoc(p, 'meta', { projectName: 'X' });
        expect(p.meta.projectName).toBe('X');
        expect(p.meta.revision).toBe('00');
        expect(applyDoc(p, 'calc:nope', { a: 1 })).toBe(p);
    });

    it('diffDocs lists changed, added and removed documents only', () => {
        const before = editedProject();
        const after: Project = {
            ...before,
            calculators: { footing: before.calculators.footing, brick: { walls: [] } },
            boqOverrides: { ...before.boqOverrides, R13: { mat: 360 } },
        };
        const diff = diffDocs(before, after);
        const byKey = Object.fromEntries(diff.map(d => [d.docKey, d.data]));
        expect(Object.keys(byKey).sort()).toEqual(['boq:R13', 'calc:brick', 'calc:fill'].sort());
        expect(byKey['calc:fill']).toBeNull();
        expect(byKey['boq:R13']).toEqual({ mat: 360 });
        expect(diffDocs(before, before)).toEqual([]);
    });

    it('diffDocs ignores key order inside a document', () => {
        const a: Project = { ...createProject('sample'), boqOverrides: { R13: { qty: 1, mat: 2 } } };
        const b: Project = { ...createProject('sample'), boqOverrides: { R13: { mat: 2, qty: 1 } } };
        expect(diffDocs(a, b)).toEqual([]);
    });
});

describe('validation', () => {
    it('checks document shapes', () => {
        expect(validateDoc('meta', { projectName: 'x' }).ok).toBe(true);
        expect(validateDoc('meta', { projectName: 3 }).ok).toBe(false);
        expect(validateDoc('meta', { hacked: 'x' }).ok).toBe(false);
        expect(validateDoc('journey', { 'project-info': 'done' }).ok).toBe(true);
        expect(validateDoc('journey', { 'project-info': 'maybe' }).ok).toBe(false);
        expect(validateDoc('journey', { 'no-such-level': 'done' }).ok).toBe(false);
        expect(validateDoc('boq:R13', { qty: 3, note: 'x' }).ok).toBe(true);
        expect(validateDoc('boq:R13', { qty: Number.NaN }).ok).toBe(false);
        expect(validateDoc('boq:R13', { price: 3 }).ok).toBe(false);
        expect(validateDoc('boq:R13', {}).ok).toBe(false);
        expect(validateDoc('calc:fill', { width: 1 }).ok).toBe(true);
        expect(validateDoc('calc:fill', [1, 2]).ok).toBe(false);
        expect(validateDoc('calc:nope', {}).ok).toBe(false);
        expect(validateDoc('boq:R13', null).ok).toBe(true);
    });

    it('a project that computes is valid; one with a broken calculator input is not', () => {
        expect(validateProject(createProject('sample')).ok).toBe(true);
        const broken = applyDoc(createProject('sample'), 'calc:footing', { rows: 'not a list' });
        expect(validateProject(broken).ok).toBe(false);
    });

    it('measures document size in UTF-8 bytes', () => {
        expect(docBytes({ a: 'ก' })).toBe(new TextEncoder().encode('{"a":"ก"}').length);
    });
});

describe('summary', () => {
    it('matches the computed BOQ and the journey marks', () => {
        const p = editedProject();
        const s = projectSummary(p);
        const r = computeProject(p);
        expect(s.constructionTotal).toBe(r.boq.constructionTotal);
        expect(s.preConstructionTotal).toBe(r.boq.preConstructionTotal);
        expect(s.levelsDone).toBe(3);
        expect(s.levelsTotal).toBe(JOURNEY_LEVELS.length);
    });
});
