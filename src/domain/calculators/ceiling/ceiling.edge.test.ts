// QA edge tests (group U5) — ฝ้าเพดาน_Ceiling. Expected values are hand-computed from the spec
// (docs/excel-spec/04 §1): F = D*E, or (D*E)/COS(RADIANS(slope)); BOQ E199–E202 = SUMIF(B, code, F);
// paint groups = SUMIF(H, group, F). Nothing here calls the function under test to get an expectation.
import { describe, expect, it } from 'vitest';
import {
    ceiling, ceilingAreaByCode, ceilingAreaByPaint, ceilingRowArea, setCeilingCode,
    CEILING_CODES, CEILING_DEFAULT_PAINT, CEILING_DESCRIPTIONS, CEILING_DESCRIPTION_ORDER, CEILING_PAINT_GROUPS,
    SLOPED_CEILING_DEG, paintGroupLabel, paintKey, type CeilingInput, type CeilingRow,
} from '.';
import { computeProject, createProject, type Project } from '../../project';

const ctx = { outputs: () => undefined };
const r = (code: CeilingRow['code'], width: number, length: number, paint: CeilingRow['paint'] = '', slope?: number): CeilingRow =>
    (slope === undefined ? { code, width, length, location: '', paint } : { code, width, length, location: '', paint, slope });
const out = (rows: CeilingRow[]) => ceiling.compute({ rows }, ctx);

const projectWith = (rows: CeilingRow[], start: 'blank' | 'sample' = 'blank'): Project => {
    const p = createProject(start);
    p.calculators.ceiling = { rows } satisfies CeilingInput;
    return p;
};
const boqQty = (p: Project, key: string): number | undefined => {
    for (const s of computeProject(p).boq.sections) {
        for (const row of s.rows) if (row.type === 'item' && row.key === key) return row.qty;
    }
    return undefined;
};

describe('ceiling — blank()', () => {
    it('is an empty table', () => {
        expect(ceiling.blank?.()).toEqual({ rows: [] });
    });
    it('every output is finite and 0', () => {
        const o = ceiling.compute(ceiling.blank?.() ?? { rows: [] }, ctx);
        for (const [k, v] of Object.entries(o)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
    });
    it('BOQ-linked outputs are 0 and the BOQ lines R199–R202 are 0 in a blank project', () => {
        const o = ceiling.compute({ rows: [] }, ctx);
        for (const l of ceiling.boqLinks) expect(o[l.output], l.line).toBe(0);
        const p = createProject('blank');
        for (const k of ['R199', 'R200', 'R201', 'R202']) expect(boqQty(p, k), k).toBe(0);
    });
    it('exposes a paint key per group (0) so the paint sheet can read them', () => {
        const o = ceiling.compute({ rows: [] }, ctx);
        for (const g of CEILING_PAINT_GROUPS) expect(o[paintKey(g)]).toBe(0);
    });
});

describe('ceiling — each type alone (equivalence partitions)', () => {
    it('C1 only: 2 × 3 = 6', () => {
        const o = out([r('C1', 2, 3)]);
        expect([o.C1, o.C2, o.C3, o.C4]).toEqual([6, 0, 0, 0]);
        expect([o.R199, o.R200, o.R201, o.R202]).toEqual([6, 0, 0, 0]);
        expect(o.total).toBe(6);
    });
    it('C2 only: 2.5 × 4 = 10', () => {
        const o = out([r('C2', 2.5, 4)]);
        expect([o.R199, o.R200, o.R201, o.R202]).toEqual([0, 10, 0, 0]);
        expect(o.total).toBe(10);
    });
    it('C3 only (eaves): 0.5 × 10 = 5', () => {
        const o = out([r('C3', 0.5, 10)]);
        expect([o.R199, o.R200, o.R201, o.R202]).toEqual([0, 0, 5, 0]);
    });
    it('C4 only (slats): 1.5 × 2 = 3', () => {
        const o = out([r('C4', 1.5, 2)]);
        expect([o.R199, o.R200, o.R201, o.R202]).toEqual([0, 0, 0, 3]);
    });
    it('rows of the same type add; different types stay apart', () => {
        const o = out([r('C1', 2, 2), r('C1', 3, 1), r('C2', 1, 1), r('C4', 2, 2)]);
        expect([o.C1, o.C2, o.C3, o.C4]).toEqual([7, 1, 0, 4]);
        expect(o.total).toBe(12);
    });
    it('a row without a type feeds no BOQ line but counts in total only', () => {
        const o = out([r('', 4, 5)]);
        expect([o.R199, o.R200, o.R201, o.R202]).toEqual([0, 0, 0, 0]);
        expect(o.total).toBe(20);
    });
    it('every dropdown code is covered by BOQ output, description and default paint group', () => {
        for (const c of CEILING_CODES) {
            const o = out([r(c, 2, 2)]);
            expect(o[c], c).toBe(4);
            expect(CEILING_DESCRIPTIONS[c].length).toBeGreaterThan(5);
            expect(CEILING_PAINT_GROUPS).toContain(CEILING_DEFAULT_PAINT[c]);
        }
        expect(CEILING_CODES).toHaveLength(4);
        expect([...CEILING_DESCRIPTION_ORDER].sort()).toEqual([...CEILING_CODES].sort());
    });
    it('BOQ links map R199–R202 to the C1–C4 area outputs', () => {
        expect(ceiling.boqLinks.map(l => [l.line, l.field, l.output])).toEqual([
            ['R199', 'qty', 'R199'], ['R200', 'qty', 'R200'], ['R201', 'qty', 'R201'], ['R202', 'qty', 'R202'],
        ]);
    });
});

describe('ceiling — paint groups', () => {
    it('each group alone', () => {
        expect(out([r('C1', 2, 3, 'ภายใน')])['paint.ภายใน']).toBe(6);
        expect(out([r('C3', 2, 3, 'ภายนอก')])['paint.ภายนอก']).toBe(6);
        expect(out([r('C4', 2, 3, 'ไม้ระแนง')])['paint.ไม้ระแนง']).toBe(6);
    });
    it('a group only receives its own rows', () => {
        const o = out([r('C1', 1, 1, 'ภายใน'), r('C3', 2, 1, 'ภายนอก'), r('C4', 3, 1, 'ไม้ระแนง')]);
        expect([o['paint.ภายใน'], o['paint.ภายนอก'], o['paint.ไม้ระแนง']]).toEqual([1, 2, 3]);
    });
    it('a row with no paint group is in no paint total (but still in its type)', () => {
        const o = out([r('C1', 2, 2, '')]);
        expect([o['paint.ภายใน'], o['paint.ภายนอก'], o['paint.ไม้ระแนง']]).toEqual([0, 0, 0]);
        expect(o.C1).toBe(4);
    });
    it('paint group is independent of the type (C1 painted exterior)', () => {
        const o = out([r('C1', 2, 5, 'ภายนอก')]);
        expect(o.C1).toBe(10);
        expect(o['paint.ภายนอก']).toBe(10);
        expect(o['paint.ภายใน']).toBe(0);
    });
    it('paint key and label helpers', () => {
        expect(paintKey('ภายใน')).toBe('paint.ภายใน');
        expect(paintGroupLabel('ไม้ระแนง')).toBe('ทาสีฝ้า - ไม้ระแนง');
        expect(ceilingAreaByPaint({ rows: [r('C1', 2, 2, 'ภายใน')] }, 'ภายนอก')).toBe(0);
    });
});

describe('ceiling — slope (O-1)', () => {
    it('slope 0 / undefined is flat', () => {
        expect(ceilingRowArea(r('C1', 2, 3, '', 0))).toBe(6);
        expect(ceilingRowArea(r('C1', 2, 3))).toBe(6);
    });
    it('slope 40° (Excel rows 16–17): 6 / cos 40° = 7.83244', () => {
        // 1 / cos(40°) = 1.3054072893
        expect(ceilingRowArea(r('C2', 2, 3, '', SLOPED_CEILING_DEG))).toBeCloseTo(6 * 1.3054072893, 6);
    });
    it('slope 60° doubles the plan area; 45° gives × √2', () => {
        expect(ceilingRowArea(r('C1', 2, 3, '', 60))).toBeCloseTo(12, 9);
        expect(ceilingRowArea(r('C1', 2, 3, '', 45))).toBeCloseTo(6 * Math.SQRT2, 9);
    });
    it('slope 89° is large but finite (6 / 0.0174524064 = 343.79)', () => {
        const a = ceilingRowArea(r('C1', 2, 3, '', 89));
        expect(Number.isFinite(a)).toBe(true);
        expect(a).toBeCloseTo(343.79213, 3);
    });
    it('impossible slopes (90°, 91°, 180°) give 0, never Infinity/NaN', () => {
        for (const s of [90, 91, 135, 180, 270]) {
            const a = ceilingRowArea(r('C1', 2, 3, '', s));
            expect(Number.isFinite(a), String(s)).toBe(true);
            expect(a, String(s)).toBe(0);
        }
    });
    it('non-finite slope is treated as flat', () => {
        expect(ceilingRowArea(r('C1', 2, 3, '', Number.NaN))).toBe(6);
        expect(ceilingRowArea(r('C1', 2, 3, '', Number.POSITIVE_INFINITY))).toBe(6);
    });
    it('a sloped row moves the BOQ line and the paint total together', () => {
        const o = out([r('C2', 2, 3, 'ภายใน', 60)]);
        expect(o.R200).toBeCloseTo(12, 9);
        expect(o['paint.ภายใน']).toBeCloseTo(12, 9);
        expect(o.total).toBeCloseTo(12, 9);
    });
});

describe('ceiling — boundary values (zero / negative / decimal / huge)', () => {
    it('zero width or length → 0', () => {
        expect(out([r('C1', 0, 5)]).R199).toBe(0);
        expect(out([r('C1', 5, 0)]).R199).toBe(0);
    });
    it('decimal sizes: 0.1 × 0.2 = 0.02; 3.333 × 3 = 9.999', () => {
        expect(out([r('C1', 0.1, 0.2)]).R199).toBeCloseTo(0.02, 12);
        expect(out([r('C1', 3.333, 3)]).R199).toBeCloseTo(9.999, 12);
    });
    it('very large sizes stay finite (1e6 × 1e6 = 1e12)', () => {
        const o = out([r('C1', 1e6, 1e6, 'ภายใน')]);
        expect(o.R199).toBe(1e12);
        expect(Number.isFinite(o.total)).toBe(true);
    });
    it('NaN / Infinity inputs never leak: they count as 0', () => {
        const o = out([r('C1', Number.NaN, 5, 'ภายใน'), r('C2', Number.POSITIVE_INFINITY, 2), r('C3', 2, Number.NEGATIVE_INFINITY)]);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        expect([o.R199, o.R200, o.R201]).toEqual([0, 0, 0]);
    });
    it('negative size: the output stays finite (Excel would give D*E, a negative area)', () => {
        const o = out([r('C1', -2, 3)]);
        expect(Number.isFinite(o.R199)).toBe(true);
        expect(o.R199).toBe(-6);
    });
    it('ceilingAreaByCode on an unknown code is 0', () => {
        expect(ceilingAreaByCode({ rows: [r('C1', 2, 2)] }, 'C9' as 'C1')).toBe(0);
    });
});

describe('ceiling — table sizes', () => {
    it('empty / 1 row / Excel count (24) / more than Excel (60) / delete', () => {
        expect(out([]).total).toBe(0);
        expect(out([r('C1', 1, 1)]).total).toBe(1);
        const make = (n: number) => Array.from({ length: n }, (_, i) => r(CEILING_CODES[i % 4] ?? 'C1', 1, 2));
        expect(out(make(24)).total).toBe(48);
        const o60 = out(make(60));
        expect([o60.C1, o60.C2, o60.C3, o60.C4]).toEqual([30, 30, 30, 30]);
        const rows = make(60);
        rows.splice(0, 4);                      // delete one of each type
        const o56 = out(rows);
        expect([o56.C1, o56.C2, o56.C3, o56.C4]).toEqual([28, 28, 28, 28]);
        rows.length = 0;
        expect(out(rows).total).toBe(0);
    });
    it('deleting every row of one type zeroes only that type', () => {
        const rows = [r('C1', 2, 2), r('C2', 2, 2)];
        const o = out(rows.filter(x => x.code !== 'C1'));
        expect([o.R199, o.R200]).toEqual([0, 4]);
    });
    it('the sample still reproduces Excel BOQ E199–E202 (regression anchor)', () => {
        const o = ceiling.compute(ceiling.defaults(), ctx);
        expect(o.R199).toBeCloseTo(72.25, 9);
        expect(o.R201).toBeCloseTo(37.38, 9);
        expect(o.R202).toBeCloseTo(19.5, 9);
    });
});

describe('ceiling — setCeilingCode (type picker pre-fills paint)', () => {
    it('fills an empty paint group from the type', () => {
        expect(setCeilingCode(r('', 1, 1, ''), 'C3').paint).toBe('ภายนอก');
        expect(setCeilingCode(r('', 1, 1, ''), 'C4').paint).toBe('ไม้ระแนง');
    });
    it('follows the previous type default but keeps a user-chosen group', () => {
        expect(setCeilingCode(r('C1', 1, 1, 'ภายใน'), 'C3').paint).toBe('ภายนอก');
        expect(setCeilingCode(r('C1', 1, 1, 'ภายนอก'), 'C4').paint).toBe('ภายนอก');
    });
    it('clearing the type keeps the paint group', () => {
        const x = setCeilingCode(r('C1', 1, 1, 'ภายใน'), '');
        expect(x.code).toBe('');
        expect(x.paint).toBe('ภายใน');
    });
});

describe('ceiling — through computeProject', () => {
    it('a ceiling row reaches BOQ R199–R202 qty', () => {
        const p = projectWith([r('C1', 2, 3), r('C2', 1, 4), r('C3', 1, 5), r('C4', 2, 2)]);
        expect([boqQty(p, 'R199'), boqQty(p, 'R200'), boqQty(p, 'R201'), boqQty(p, 'R202')]).toEqual([6, 4, 5, 4]);
    });
    it('feeds paint: interior / exterior / slat ceiling lines (§23, §25, §31 rows)', () => {
        const p = projectWith([r('C1', 2, 3, 'ภายใน'), r('C3', 1, 5, 'ภายนอก'), r('C4', 2, 2, 'ไม้ระแนง')]);
        expect([boqQty(p, 'R226'), boqQty(p, 'R248'), boqQty(p, 'R303')]).toEqual([6, 6, 6]);
        expect([boqQty(p, 'R225'), boqQty(p, 'R247'), boqQty(p, 'R302')]).toEqual([5, 5, 5]);
        expect([boqQty(p, 'R227'), boqQty(p, 'R249'), boqQty(p, 'R304')]).toEqual([4, 4, 4]);
    });
    it('ceiling paint does not enter the skim-coat line (C13 = wall interior + exterior only)', () => {
        const p = projectWith([r('C1', 2, 3, 'ภายใน')]);
        expect(boqQty(p, 'R231')).toBe(0);
    });
    it('does not change floor-tile outputs (no dependency)', () => {
        const base = computeProject(createProject('blank')).calcOutputs['floor-tile'];
        const withCeiling = computeProject(projectWith([r('C1', 2, 3)])).calcOutputs['floor-tile'];
        expect(withCeiling).toEqual(base);
    });
    it('skipped level: outputs 0, BOQ lines 0 and paint ceiling lines 0', () => {
        const p = projectWith([r('C1', 2, 3, 'ภายใน'), r('C3', 1, 5, 'ภายนอก')]);
        p.journey = { ceiling: 'skipped' };
        const res = computeProject(p);
        for (const [k, v] of Object.entries(res.calcOutputs.ceiling ?? {})) expect(v, k).toBe(0);
        for (const k of ['R199', 'R200', 'R201', 'R202', 'R225', 'R226', 'R227']) expect(boqQty(p, k), k).toBe(0);
    });
    it('skipped level also beats a quantity typed on the BOQ page', () => {
        const p = projectWith([r('C1', 2, 3)]);
        p.journey = { ceiling: 'skipped' };
        p.boqOverrides.R199 = { qty: 99 };
        expect(boqQty(p, 'R199')).toBe(0);
    });
    it('sample project: ceiling quantities equal the Excel sample', () => {
        const p = createProject('sample');
        expect(boqQty(p, 'R199')).toBeCloseTo(72.25, 9);
        expect(boqQty(p, 'R202')).toBeCloseTo(19.5, 9);
    });
});
