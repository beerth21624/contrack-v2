import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS } from '../../journey/levels';
import { journeyComplete } from '../../journey/progress';
import { missingRequirements } from '../../journey/requirements';
import { computeProject } from '../../project';
import { projectToDocs, validateDoc, validateProject } from '../../sync';
import {
    buildShowcaseProject, buildShowcaseRev00, SHOWCASE_ASSIGNMENTS, SHOWCASE_PROJECT_NAME, SHOWCASE_REVISIONS,
    SHOWCASE_SKIPPED_LEVELS,
} from '../showcase-project';

const TODAY = '2026-10-26';
const project = buildShowcaseProject(TODAY);
const result = computeProject(project);
const schedule = result.planning.schedule;

/** Every number anywhere in a value (deep). */
function numbers(x: unknown, out: number[] = []): number[] {
    if (typeof x === 'number') out.push(x);
    else if (Array.isArray(x)) for (const v of x) numbers(v, out);
    else if (x !== null && typeof x === 'object') for (const v of Object.values(x)) numbers(v, out);
    return out;
}

describe('showcase project', () => {
    it('is a valid project, and every document passes the server checks', () => {
        expect(validateProject(project)).toEqual({ ok: true });
        for (const d of projectToDocs(project)) expect(validateDoc(d.docKey, d.data), d.docKey).toEqual({ ok: true });
        expect(validateProject(buildShowcaseRev00(TODAY))).toEqual({ ok: true });
    });

    it('reads as a real job: Thai header, revision 01, site in a province', () => {
        expect(project.meta.projectName).toBe(SHOWCASE_PROJECT_NAME);
        expect(project.meta.revision).toBe('01');
        expect(project.meta.siteAddress).toMatch(/จ\.นครปฐม/);
        expect(project.meta.ownerName).not.toBe('');
        expect(project.meta.preparedBy).not.toBe('');
        expect(project.meta.documentDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        expect(buildShowcaseRev00(TODAY).meta.revision).toBe('00');
    });

    it('answers the whole land-inspection checklist, with one problem written down', () => {
        const li = project.calculators['land-inspection'] as { checklist: { done: boolean; answer?: string; note: string }[] };
        expect(li.checklist).toHaveLength(5);
        expect(li.checklist.every(a => a.done && a.note.trim() !== '')).toBe(true);
        expect(li.checklist.filter(a => a.answer === 'no')).toHaveLength(1);
    });

    it('passes every journey step, and no done step misses a required value', () => {
        expect(journeyComplete(project.journey ?? {})).toBe(true);
        for (const l of JOURNEY_LEVELS) {
            const mark = project.journey?.[l.id];
            expect(mark, l.id).toBe(SHOWCASE_SKIPPED_LEVELS.includes(l.id) ? 'skipped' : 'done');
            if (mark === 'skipped') expect(l.optional, `${l.id} can be skipped`).toBe(true);
            expect(missingRequirements(l.id, project), l.id).toEqual([]);
        }
    });

    it('has totals that are finite and plausible for a 1-storey house', () => {
        const total = result.boq.constructionTotal;
        expect(Number.isFinite(total)).toBe(true);
        expect(total).toBeGreaterThan(1_200_000);
        expect(total).toBeLessThan(3_000_000);
        expect(result.planning.cashflow.quotation).toBeGreaterThan(total);
        expect(numbers(result).filter(n => Number.isNaN(n))).toEqual([]);
    });

    it('plans a job that started 3–4 months ago and is about 60 % done, a few days late', () => {
        const start = Date.parse(schedule.start ?? '');
        const months = (Date.parse(TODAY) - start) / (30.4 * 86_400_000);
        expect(months).toBeGreaterThan(3);
        expect(months).toBeLessThan(4);
        expect(Date.parse(schedule.finish ?? '')).toBeGreaterThan(Date.parse(TODAY));

        const actual = schedule.actualCumulative.at(-1) ?? 0;
        expect(actual).toBeGreaterThan(0.55);
        expect(actual).toBeLessThan(0.65);
        const earned = schedule.status.earnedValue / schedule.budget;
        expect(earned).toBeGreaterThan(0.55);
        expect(earned).toBeLessThan(0.65);

        expect(schedule.status.delayStatus).toBe('late');
        expect(schedule.status.delayDays).toBeGreaterThanOrEqual(-7);
        expect(schedule.status.delayDays).toBeLessThanOrEqual(-2);
        // Recorded work ends before today.
        expect(Date.parse(schedule.status.lastUpdate ?? '')).toBeLessThan(Date.parse(TODAY));
    });

    it('records actuals on the finished tasks, one slightly over budget, and % progress on the task in progress', () => {
        const done = schedule.tasks.filter(t => t.actual.finish !== null);
        expect(done.length).toBeGreaterThan(10);
        const over = done.filter(t => (t.actual.cost ?? 0) > t.budget * 1.04);
        expect(over.map(t => t.id)).toEqual(['3.2']);
        const late = done.filter(t => (t.actual.start ?? '') > (t.start ?? ''));
        expect(late.length).toBeGreaterThan(1);
        const inProgress = schedule.tasks.filter(t => t.progress > 0 && t.progress < 1);
        expect(inProgress.map(t => t.id)).toEqual(['5.1']);
        expect(inProgress[0]?.actual.start).not.toBeNull();
    });

    it('bills the installments in order and measures the cash flow up to today', () => {
        const cf = result.planning.cashflow;
        const placed = cf.installments.map(i => i.bucket);
        expect(placed.every(b => b !== null)).toBe(true);
        const nums = placed.filter((b): b is number => b !== null);
        expect([...nums].sort((a, b) => a - b)).toEqual(nums);
        expect(cf.installmentPctTotal).toBeCloseTo(1, 9);
        expect(cf.evm.ac).toBeGreaterThan(0);
        expect(cf.evm.spi).not.toBeNull();
        expect(cf.evm.spi ?? 0).toBeLessThan(1);
        // Slightly over budget overall (the roof frame), not wildly.
        expect(cf.evm.cpi ?? 0).toBeLessThan(1);
        expect(cf.evm.cpi ?? 0).toBeGreaterThan(0.95);
    });

    it('rebuilds the same plan relative to any day', () => {
        const later = computeProject(buildShowcaseProject('2027-03-15')).planning.schedule;
        expect(later.actualCumulative.at(-1)).toBeCloseTo(schedule.actualCumulative.at(-1) ?? 0, 9);
        expect(later.status.delayDays).toBe(schedule.status.delayDays);
    });

    it('differs a little between Rev 00 and Rev 01, and Rev 00 has no actuals', () => {
        const rev00 = computeProject(buildShowcaseRev00(TODAY));
        expect(rev00.boq.constructionTotal).not.toBeCloseTo(result.boq.constructionTotal, 0);
        expect(Math.abs(rev00.boq.constructionTotal / result.boq.constructionTotal - 1)).toBeLessThan(0.05);
        expect(rev00.planning.schedule.tasks.every(t => t.actual.finish === null)).toBe(true);
        expect(SHOWCASE_REVISIONS.map(r => r.label)).toEqual(['Rev 00', 'Rev 01']);
    });

    it('assigns only real journey steps', () => {
        const ids = new Set(JOURNEY_LEVELS.map(l => l.id));
        expect(SHOWCASE_ASSIGNMENTS.every(a => ids.has(a.levelId))).toBe(true);
    });
});
