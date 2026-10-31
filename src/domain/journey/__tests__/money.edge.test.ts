import { describe, expect, it } from 'vitest';
import { getCalculator } from '../../calculators/registry';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import { JOURNEY_LEVELS, getLevel, type JourneyLevel } from '../levels';
import { levelRows, levelTotal } from '../money';

const level = (id: string): JourneyLevel => {
    const l = getLevel(id);
    if (!l) throw new Error(`level ${id} missing`);
    return l;
};
const section = (res: ProjectResult, no: number) => {
    const s = res.boq.sections.find(x => x.no === no);
    if (!s) throw new Error(`section ${String(no)} missing`);
    return s;
};
const total = (id: string, res: ProjectResult) => levelTotal(level(id), res);
const skipped = (start: 'blank' | 'sample', ...ids: string[]): Project => ({
    ...createProject(start),
    journey: Object.fromEntries(ids.map(id => [id, 'skipped' as const])),
});
const allTotals = (res: ProjectResult) => JOURNEY_LEVELS.reduce((s, l) => s + levelTotal(l, res), 0);

const SAMPLE = computeProject(createProject('sample'));
const BLANK = computeProject(createProject('blank'));

describe('journey money — blank project', () => {
    it('only the standard lump sums carry money: land 7,500, temp 2,700, layout 5,500, roof-structure R158 10,000', () => {
        const nonZero = Object.fromEntries(JOURNEY_LEVELS.flatMap(l => { const v = levelTotal(l, BLANK); return v === 0 ? [] : [[l.id, v] as const]; }));
        expect(nonZero).toEqual({
            'land-inspection': 7500,
            'temp-utilities': 2700,
            layout: 5500,
            'roof-structure': 10000,
        });
    });

    it('blank totals: construction 18,200 (2,700 + 5,500 + 10,000), pre-construction 7,500', () => {
        expect(BLANK.boq.constructionTotal).toBe(18200);
        expect(BLANK.boq.preConstructionTotal).toBe(7500);
        expect(allTotals(BLANK)).toBeCloseTo(25700, 6);
    });

    it('every level total is finite and never negative', () => {
        for (const l of JOURNEY_LEVELS) {
            const t = levelTotal(l, BLANK);
            expect(Number.isFinite(t), l.id).toBe(true);
            expect(t, l.id).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('journey money — sample project', () => {
    it('level totals add up to the Excel total 1,855,162 (+ 7,500 pre-construction)', () => {
        expect(SAMPLE.boq.constructionTotal).toBeCloseTo(1855162.2484765165, 4);
        expect(allTotals(SAMPLE)).toBeCloseTo(SAMPLE.boq.constructionTotal + SAMPLE.boq.preConstructionTotal, 4);
    });

    it('prepare levels: 0 / 7,500 / 0 / 0 / 7,969 / 55,400 / 5,500', () => {
        const ids = ['project-info', 'land-inspection', 'demolition', 'fill', 'temp-utilities', 'site-camp', 'layout'];
        expect(ids.map(id => Math.round(total(id, SAMPLE)))).toEqual([0, 7500, 0, 0, 7969, 55400, 5500]);
    });

    it('the prepare levels together equal sections 0-4 (their rows are all of those sections)', () => {
        const prepare = ['land-inspection', 'demolition', 'fill', 'temp-utilities', 'site-camp', 'layout'].reduce((s, id) => s + total(id, SAMPLE), 0);
        const sections = [0, 1, 2, 3, 4].reduce((s, no) => s + section(SAMPLE, no).total, 0);
        expect(prepare).toBeCloseTo(sections, 6);
        const blankSections = [0, 1, 2, 3, 4].reduce((s, no) => s + section(BLANK, no).total, 0);
        const blankPrepare = ['land-inspection', 'demolition', 'fill', 'temp-utilities', 'site-camp', 'layout'].reduce((s, id) => s + total(id, BLANK), 0);
        expect(blankPrepare).toBeCloseTo(blankSections, 6);
    });

    it('every level total is finite and never negative', () => {
        for (const l of JOURNEY_LEVELS) {
            const t = levelTotal(l, SAMPLE);
            expect(Number.isFinite(t), l.id).toBe(true);
            expect(t, l.id).toBeGreaterThanOrEqual(0);
        }
    });

    it('a BOQ-rows level (column-plates) equals its section 14 total', () => {
        expect(total('column-plates', SAMPLE)).toBeCloseTo(section(SAMPLE, 14).total, 6);
        expect(total('column-plates', SAMPLE)).toBe(9450);
        expect(levelRows(level('column-plates'), SAMPLE).map(r => r.key).sort()).toEqual(
            section(SAMPLE, 14).rows.flatMap(r => (r.type === 'item' ? [r.key] : [])).sort(),
        );
    });

    it('the meta level has no rows and no money', () => {
        expect(levelRows(level('project-info'), SAMPLE)).toEqual([]);
        expect(total('project-info', SAMPLE)).toBe(0);
    });

    it('rows with money belong to exactly one level (no double counting)', () => {
        const owner = new Map<string, string>();
        for (const l of JOURNEY_LEVELS) {
            for (const r of levelRows(l, SAMPLE)) {
                if (r.total === 0) continue;
                expect(owner.get(r.key), `${r.key} in ${l.id} and ${owner.get(r.key) ?? ''}`).toBeUndefined();
                owner.set(r.key, l.id);
            }
        }
        expect(owner.size).toBeGreaterThan(100);
    });

    it('levelRows only returns item rows of the result', () => {
        for (const l of JOURNEY_LEVELS) for (const r of levelRows(l, SAMPLE)) expect(r.type, l.id).toBe('item');
    });
});

describe('journey money — extraRows (typed lump sums)', () => {
    it('layout owns R32 in the sample: 4,000 + 1,500 = 5,500', () => {
        const r32 = levelRows(level('layout'), SAMPLE).find(r => r.key === 'R32');
        expect(r32?.total).toBe(5500);
        expect(levelRows(level('layout'), SAMPLE).map(r => r.key)).toEqual(['R32']);
    });

    it('roof-structure owns R158 (ทาสีกันสนิม 1 เหมา 8,000 + 2,000 = 10,000) — blank and sample', () => {
        for (const res of [BLANK, SAMPLE]) {
            const r158 = levelRows(level('roof-structure'), res).find(r => r.key === 'R158');
            expect(r158?.total).toBe(10000);
        }
    });

    it('R32 and R158 are not counted by any other level', () => {
        for (const l of JOURNEY_LEVELS) {
            if (l.id === 'layout' || l.id === 'roof-structure') continue;
            const keys = levelRows(l, SAMPLE).map(r => r.key);
            expect(keys, l.id).not.toContain('R32');
            expect(keys, l.id).not.toContain('R158');
        }
    });

    it('skipping layout zeroes R32 although layout has no BOQ link; skipping roof-structure zeroes R158', () => {
        const a = computeProject(skipped('sample', 'layout'));
        expect(total('layout', a)).toBe(0);
        expect(SAMPLE.boq.constructionTotal - a.boq.constructionTotal).toBeCloseTo(5500, 6);
        const b = computeProject(skipped('sample', 'roof-structure'));
        expect(total('roof-structure', b)).toBe(0);
        expect(levelRows(level('roof-structure'), b).find(r => r.key === 'R158')?.total).toBe(0);
        expect(SAMPLE.boq.constructionTotal - b.boq.constructionTotal).toBeGreaterThanOrEqual(10000);
    });

    it('skipping layout / roof-structure in a blank project removes their lump sums (5,500 / 10,000)', () => {
        const a = computeProject(skipped('blank', 'layout'));
        expect(BLANK.boq.constructionTotal - a.boq.constructionTotal).toBe(5500);
        const b = computeProject(skipped('blank', 'roof-structure'));
        expect(BLANK.boq.constructionTotal - b.boq.constructionTotal).toBe(10000);
        const c = computeProject(skipped('blank', 'layout', 'roof-structure', 'temp-utilities', 'land-inspection'));
        expect(c.boq.constructionTotal).toBe(0);
        expect(c.boq.preConstructionTotal).toBe(0);
    });
});

describe('journey money — skipping a level zeroes its money', () => {
    it('every calculator level: skipped → level total exactly 0, other money still adds up to the BOQ', () => {
        for (const l of JOURNEY_LEVELS) {
            if (l.kind.type !== 'calc') continue;
            const res = computeProject(skipped('sample', l.id));
            expect(levelTotal(l, res), l.id).toBe(0);
            expect(allTotals(res), l.id).toBeCloseTo(res.boq.constructionTotal + res.boq.preConstructionTotal, 4);
            expect(res.boq.constructionTotal + res.boq.preConstructionTotal, l.id)
                .toBeLessThanOrEqual(SAMPLE.boq.constructionTotal + SAMPLE.boq.preConstructionTotal + 1e-6);
        }
    });

    it('every calculator level: skipped → all its outputs 0 and every BOQ line it links has quantity 0', () => {
        for (const l of JOURNEY_LEVELS) {
            if (l.kind.type !== 'calc') continue;
            const def = getCalculator(l.kind.calc);
            if (!def) throw new Error(`no calculator ${l.id}`);
            const res = computeProject(skipped('sample', l.id));
            expect(Object.values(res.calcOutputs[def.id] ?? {}).every(v => v === 0), `${l.id} outputs`).toBe(true);
            const items = new Map(res.boq.sections.flatMap(s => s.rows.flatMap(r => (r.type === 'item' ? [[r.key, r] as const] : []))));
            for (const link of def.boqLinks) {
                const row = items.get(link.line);
                if (!row || (row.qtySource !== 'input' && row.qtySource !== 'calc')) continue;
                expect(row.qty, `${l.id} → ${link.line}`).toBe(0);
                expect(row.total, `${l.id} → ${link.line}`).toBe(0);
            }
        }
    });

    it('skipping the 7 optional levels in the sample lowers the total by at least what they cost', () => {
        for (const l of JOURNEY_LEVELS.filter(x => x.optional === true)) {
            const res = computeProject(skipped('sample', l.id));
            const drop = SAMPLE.boq.constructionTotal - res.boq.constructionTotal;
            expect(drop, l.id).toBeGreaterThanOrEqual(total(l.id, SAMPLE) - 1e-6);
        }
    });

    it('skipping several optional levels at once equals the sum of skipping each (independent rows)', () => {
        const ids = ['piles', 'precast-slab', 'stair', 'wall-finishing'];
        const together = computeProject(skipped('sample', ...ids)).boq.constructionTotal;
        const drops = ids.map(id => SAMPLE.boq.constructionTotal - computeProject(skipped('sample', id)).boq.constructionTotal);
        expect(SAMPLE.boq.constructionTotal - together).toBeGreaterThan(Math.max(...drops) - 1e-6);
    });

    it('prepare levels: exact drop when each is skipped on the sample', () => {
        const drop = (id: string) => {
            const r = computeProject(skipped('sample', id));
            return [SAMPLE.boq.constructionTotal - r.boq.constructionTotal, SAMPLE.boq.preConstructionTotal - r.boq.preConstructionTotal];
        };
        expect(drop('land-inspection')).toEqual([0, 7500]);
        expect(drop('temp-utilities')[0]).toBeCloseTo(7969, 6);
        expect(drop('site-camp')[0]).toBeCloseTo(55400, 6);
        expect(drop('layout')[0]).toBeCloseTo(5500, 6);
        expect(drop('demolition')[0]).toBe(0);
        expect(drop('fill')[0]).toBe(0);
    });

    it('a level marked done (not skipped) keeps its money', () => {
        const p = { ...createProject('sample'), journey: { footing: 'done' as const, 'land-inspection': 'done' as const } };
        const res = computeProject(p);
        expect(total('footing', res)).toBeCloseTo(total('footing', SAMPLE), 6);
        expect(res.boq.constructionTotal).toBeCloseTo(SAMPLE.boq.constructionTotal, 6);
    });

    it('skipping an unknown level id changes nothing', () => {
        const res = computeProject({ ...createProject('sample'), journey: { nope: 'skipped' } });
        expect(res.boq.constructionTotal).toBeCloseTo(SAMPLE.boq.constructionTotal, 6);
    });
});

describe('journey money — levels follow the typed data', () => {
    it('demolition work and a priced fill row show in their own levels only (section 1 = both)', () => {
        const p = createProject('blank');
        p.calculators.demolition = {
            items: [
                { label: 'รื้อ', unit: 'ตร.ม.', qty: 10, rate: 350, check: '' },
                { label: 'ต้นไม้', unit: 'ต้น', qty: 2, rate: 1000, check: '' },
            ],
        };
        p.calculators.fill = { width: 10, length: 10, height: 0.5, settlementPct: 0, material: 'ดินถม' };
        p.boqOverrides = { R13: { mat: 80 } };
        const res = computeProject(p);
        expect(total('demolition', res)).toBe(5500);
        expect(total('fill', res)).toBeCloseTo(4400, 6);   // gross 50 × 1.1 = 55 × 80
        expect(section(res, 1).total).toBeCloseTo(9900, 6);
        expect(total('land-inspection', res)).toBe(7500);
    });

    it('a level with no BOQ rows yet (load-center, blank) has no rows and 0 money; typing an item adds a row', () => {
        expect(levelRows(level('load-center'), BLANK)).toEqual([]);
        expect(total('load-center', BLANK)).toBe(0);
        expect(levelRows(level('load-center'), SAMPLE).length).toBeGreaterThan(0);
        expect(total('load-center', SAMPLE)).toBeCloseTo(29960, 0);
    });

    it('a calculator-level result with an unknown calculator id yields no rows', () => {
        const fake: JourneyLevel = { id: 'x', title: 'x', planHint: '', kind: { type: 'calc', calc: 'does-not-exist' }, after: [], sections: [] };
        expect(levelRows(fake, SAMPLE)).toEqual([]);
        expect(levelTotal(fake, SAMPLE)).toBe(0);
    });
});
