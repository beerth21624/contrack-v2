// BOQ review: AI request rows (derived flags) and the deterministic rules, driven through computeBoq on the
// Excel v5 template plus the overrides that trigger each rule.
import { describe, expect, it } from 'vitest';
import { computeBoq, type ComputeBoqInput } from '../engine';
import { BOQ_TEMPLATE_V5 } from '../template.v5';
import { formatNumber, isDerivedPrice, isDerivedQty, reviewBoqRules, toReviewRows, type BoqReviewContext } from '../review';
import { rebarSlotRows } from '../slots';
import type { BoqItemRow, BoqResult } from '../types';

const compute = (input: Omit<ComputeBoqInput, 'sections'> = {}): BoqResult => computeBoq({ sections: BOQ_TEMPLATE_V5, ...input });
const review = (input: Omit<ComputeBoqInput, 'sections'> = {}, ctx?: BoqReviewContext) =>
    reviewBoqRules(compute(input), BOQ_TEMPLATE_V5, ctx);
const ofKind = (findings: ReturnType<typeof review>, kind: string) => findings.filter(f => f.kind === kind);

const itemRowCount = (r: BoqResult) => r.sections.reduce((n, s) => n + s.rows.filter(x => x.type === 'item').length, 0);
const firstItemKey = (r: BoqResult, sectionNo: number): string => {
    const s = r.sections.find(x => x.no === sectionNo);
    const row = s?.rows.find((x): x is BoqItemRow => x.type === 'item');
    if (!row) throw new Error(`section ${String(sectionNo)} has no item row`);
    return row.key;
};

describe('toReviewRows', () => {
    const result = compute();
    const rows = toReviewRows(result, BOQ_TEMPLATE_V5);
    const byKey = new Map(rows.map(r => [r.key, r]));

    it('maps every item row, skips headings and keeps order', () => {
        expect(rows.length).toBe(itemRowCount(result));
        expect(rows.length).toBe(212);
        expect(rows[0]?.key).toBe('R9');
        expect(rows[0]?.section).toBe('งานตรวจสอบที่ดิน');
        const keys = result.sections.flatMap(s => s.rows.filter(r => r.type === 'item').map(r => r.key));
        expect(rows.map(r => r.key)).toEqual(keys);
    });

    it('copies engine values: net qty, gross qty, waste as a percentage, prices, note', () => {
        const r13 = byKey.get('R13');
        expect(r13).toMatchObject({ desc: 'ดินถม (ตามสเปค) + บดอัด', unit: 'ลบ.ม.', qty: 234, wastePct: 10, matUnit: 0, labUnit: 0, note: 'ลูกค้าจัดหาเอง' });
        expect(r13?.grossQty).toBeCloseTo(257.4, 6);
        expect(byKey.get('R12')?.note).toBe('ไม่มีงานรื้อถอน');
        // a row without a note sends an empty string, never undefined
        const noteless = result.sections.flatMap(s => s.rows).find((r): r is BoqItemRow => r.type === 'item' && r.note === undefined);
        expect(noteless).toBeDefined();
        expect(byKey.get(noteless?.key ?? '')?.note).toBe('');
        expect(rows.every(r => typeof r.note === 'string')).toBe(true);
        // R45 tie wire has no net qty but a gross one
        expect(byKey.get('R45')?.qty).toBe(0);
        expect(byKey.get('R45')?.grossQty).toBeGreaterThan(0);
    });

    it('rounds wastePct to 2 decimals', () => {
        const r = toReviewRows(compute({ overrides: { R13: { waste: 0.123456 } } }), BOQ_TEMPLATE_V5);
        expect(r.find(x => x.key === 'R13')?.wastePct).toBe(12.35);
    });

    it('derived flags: calc qty (R13) is not derived', () => {
        expect(byKey.get('R13')?.derived).toEqual({ qty: false, mat: false, lab: false });
    });

    it('derived flags: a line rule row (ไม้คร่าวยึดแบบ R56) has a derived qty', () => {
        expect(byKey.get('R56')?.desc).toBe('- ไม้คร่าวยึดแบบ');
        expect(byKey.get('R56')?.derived).toEqual({ qty: true, mat: false, lab: false });
    });

    it('derived flags: a sumLines row (เสาเอ็นและคานทับหลัง R183) has a derived qty', () => {
        expect(byKey.get('R183')?.desc).toBe('เสาเอ็นและคานทับหลัง');
        expect(byKey.get('R183')?.derived).toEqual({ qty: true, mat: false, lab: false });
    });

    it('derived flags: the consumables row (R87) has a derived material price, linePrice rows (R180) both prices', () => {
        expect(byKey.get('R87')?.desc).toBe('- วัสดุอุปกรณ์และของใช้สิ้นเปลือง');
        expect(byKey.get('R87')?.derived).toEqual({ qty: false, mat: true, lab: false });
        expect(byKey.get('R180')?.derived).toEqual({ qty: false, mat: true, lab: true });
        expect(byKey.get('R45')?.derived).toEqual({ qty: true, mat: false, lab: false });
    });

    it('rows a calculator supplied for a slot use their own qty source and never a derived price', () => {
        const slotRows = rebarSlotRows({ RB6: 10, DB12: 20 }).map((r, i) => ({ ...r, excelRow: 43 + i }));
        const r = toReviewRows(compute({ slots: { 'footing.rebar': slotRows } }), BOQ_TEMPLATE_V5);
        const m = new Map(r.map(x => [x.key, x]));
        expect(m.has('R43')).toBe(false);
        expect(m.get('RB6')?.derived).toEqual({ qty: false, mat: false, lab: false });
        expect(m.get('RB6')?.section).toBe('งานฐานราก');
        expect(m.get('tie-wire')?.derived).toEqual({ qty: true, mat: false, lab: false });
    });

    it('helpers', () => {
        expect(isDerivedQty('input')).toBe(false);
        expect(isDerivedQty('calc')).toBe(false);
        expect(isDerivedQty('line')).toBe(true);
        expect(isDerivedQty('sumLines')).toBe(true);
        expect(isDerivedQty('none')).toBe(true);
        expect(isDerivedPrice(250)).toBe(false);
        expect(isDerivedPrice(0)).toBe(false);
        expect(isDerivedPrice({ kind: 'linePrice', ref: 'R1', factor: 2 })).toBe(true);
        expect(isDerivedPrice({ kind: 'consumables', refs: ['R1'], pct: 0.5 })).toBe(true);
        expect(formatNumber(2500)).toBe('2,500');
        expect(formatNumber(1234.5)).toBe('1,234.5');
        expect(formatNumber(0.1 + 0.2)).toBe('0.3');
        expect(formatNumber(1234567.891)).toBe('1,234,567.89');
    });
});

describe('reviewBoqRules on the untouched sample', () => {
    const findings = review();

    it('has no error-severity findings and only the warn kinds the sample legitimately triggers', () => {
        expect(findings.filter(f => f.severity === 'error')).toEqual([]);
        // The sample is, by definition, all Excel sample values: every multi-row section with calculators
        // is reported as untouched. Nothing else fires: prices equal the template, waste ≤ 30 %,
        // rebar/concrete ≈ 89 kg/m³, no section with value in Excel is empty.
        expect(new Set(findings.map(f => f.kind))).toEqual(new Set(['sample-values']));
        expect(findings.every(f => f.source === 'rule')).toBe(true);
    });

    it('flags site camp (section 3, 4 typed rows) and painting (section 23) as sample values, attached to the first row', () => {
        const f3 = findings.find(f => f.kind === 'sample-values' && f.key === 'R19');
        expect(f3?.message).toBe('หมวด งานเตรียมพื้นที่หน้างาน — ยังเป็นค่าตัวอย่างจาก Excel');
        expect(findings.some(f => f.kind === 'sample-values' && f.key === 'R223')).toBe(true);
    });

    it('does not flag sections without calculators (14), with fewer than 3 editable rows (2, 4, 5) or section 0', () => {
        const keys = new Set(ofKind(findings, 'sample-values').map(f => f.key));
        expect(keys.has('R148')).toBe(false);   // section 14, calculators: []
        expect(keys.has('R16')).toBe(false);    // section 2, 1 row
        expect(keys.has('R32')).toBe(false);    // section 4
        expect(keys.has('R35')).toBe(false);    // section 5
        expect(keys.has('R12')).toBe(false);    // section 1: only one row > 0
        expect(keys.has('R9')).toBe(false);     // section 0
    });
});

describe('price-zero', () => {
    it('flags a typed row with quantity but no price where Excel has one, as an error', () => {
        const findings = review({ overrides: { R181: { mat: 0, lab: 0 } } });
        const f = ofKind(findings, 'price-zero');
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ key: 'R181', severity: 'error', source: 'rule', message: 'ก่ออิฐอิฐมวลเบา (ครึ่งแผ่น ) — ไม่มีราคาวัสดุและค่าแรง' });
        // R182 = R181 × 2 is derived from R181 and is not reported on its own
        expect(findings.some(x => x.key === 'R182')).toBe(false);
    });

    it('ignores rows with no quantity, rows that still have one price, and rows Excel prices at 0 too', () => {
        expect(ofKind(review({ overrides: { R181: { mat: 0, lab: 0, qty: 0 } } }), 'price-zero')).toEqual([]);
        expect(ofKind(review({ overrides: { R181: { mat: 0 } } }), 'price-zero')).toEqual([]);
        // R23 โรงเก็บปูน is 0/0 in Excel
        expect(ofKind(review({ overrides: { R23: { qty: 2 } } }), 'price-zero')).toEqual([]);
    });
});

describe('price-outlier', () => {
    it('flags a material price more than 3× the template, naming the reference value', () => {
        const f = ofKind(review({ overrides: { R58: { mat: 9000 } } }), 'price-outlier');
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ key: 'R58', severity: 'warn' });
        expect(f[0]?.message).toBe('คอนกรีตโครงสร้าง (240 ksc cu) — ราคาวัสดุ 9,000 ต่างจากค่าอ้างอิง 2,500 เกิน 3 เท่า');
    });

    it('flags labour below a third of the template and merges both prices into one finding', () => {
        const f = ofKind(review({ overrides: { R58: { lab: 100 } } }), 'price-outlier');
        expect(f[0]?.message).toContain('ค่าแรง 100 ต่างจากค่าอ้างอิง 500');
        const both = ofKind(review({ overrides: { R58: { mat: 9000, lab: 100 } } }), 'price-outlier');
        expect(both).toHaveLength(1);
        expect(both[0]?.message).toContain('ราคาวัสดุ');
        expect(both[0]?.message).toContain('ค่าแรง');
    });

    it('accepts prices within ×3 and ignores zero prices (those are price-zero) and template zeros', () => {
        expect(ofKind(review({ overrides: { R58: { mat: 7000, lab: 200 } } }), 'price-outlier')).toEqual([]);
        expect(ofKind(review({ overrides: { R58: { mat: 0 } } }), 'price-outlier')).toEqual([]);
        // R38 ขุดดิน has mat 0 in Excel: a material price there is not an outlier
        expect(ofKind(review({ overrides: { R38: { mat: 5000 } } }), 'price-outlier')).toEqual([]);
    });
});

describe('waste-high', () => {
    it('flags waste raised above 30 % on a row Excel keeps at or below 30 %', () => {
        const f = ofKind(review({ overrides: { R55: { waste: 0.4 } } }), 'waste-high');
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ key: 'R55', severity: 'warn', message: '- ไม้แบบ — เผื่อเสีย 40% สูงผิดปกติ' });
    });

    it('accepts the template allowance (30 % sand) but flags anything above 50 %', () => {
        expect(ofKind(review(), 'waste-high')).toEqual([]);
        expect(ofKind(review({ overrides: { R40: { waste: 0.3 } } }), 'waste-high')).toEqual([]);
        expect(ofKind(review({ overrides: { R40: { waste: 0.6 } } }), 'waste-high').map(f => f.key)).toEqual(['R40']);
    });

    it('leaves tie-wire rows alone', () => {
        const f = ofKind(review({ overrides: { R45: { waste: 0.9 }, R44: { waste: 0.9 } } }), 'waste-high');
        expect(f.map(x => x.key)).toEqual(['R44']);
    });
});

describe('section-empty', () => {
    it('flags a costed section whose rows all have no value, attached to its first row', () => {
        const f = ofKind(review({ overrides: { R16: { qty: 0 } } }), 'section-empty');
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ key: 'R16', severity: 'warn', message: 'หมวด งานน้ำ-ไฟชั่วคราว — ยังไม่มีรายการใดมีมูลค่า' });
    });

    it('skips section 0 and sections Excel leaves empty at sample values (section 1)', () => {
        const f = ofKind(review({ overrides: { R9: { qty: 0 } } }), 'section-empty');
        expect(f).toEqual([]);
        expect(ofKind(review(), 'section-empty')).toEqual([]);
    });
});

describe('sample-values', () => {
    it('stops reporting a section once any editable quantity changes', () => {
        const f = ofKind(review({ overrides: { R19: { qty: 5 } } }), 'sample-values');
        expect(f.some(x => x.key === 'R19')).toBe(false);
        // other sections are still untouched
        expect(f.some(x => x.key === 'R223')).toBe(true);
    });

    it('treats a calculator-supplied value as touched even when it equals the sample', () => {
        const f = ofKind(review({ linked: { R19: { qty: 4 } } }), 'sample-values');
        expect(f.some(x => x.key === 'R19')).toBe(false);
    });

    it('treats a slot filled by a calculator as touched', () => {
        const slotRows = rebarSlotRows({ RB9: 50.2992, DB12: 335.664 }).map((r, i) => ({ ...r, excelRow: 43 + i }));
        const f = ofKind(review({ slots: { 'footing.rebar': slotRows } }), 'sample-values');
        expect(f.some(x => x.key === firstItemKey(compute(), 6))).toBe(false);
    });
});

describe('rebar-ratio', () => {
    it('is quiet on the sample (about 89 kg/m³)', () => {
        expect(ofKind(review(), 'rebar-ratio')).toEqual([]);
    });

    it('flags too little rebar per m³ of concrete on the first concrete row of the structure', () => {
        const f = ofKind(review({ overrides: { R58: { qty: 100 } } }), 'rebar-ratio');
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ key: 'R41', severity: 'warn' });
        expect(f[0]?.message).toContain('กก./ลบ.ม.');
        expect(f[0]?.message).toContain('น้อยผิดปกติ');
    });

    it('flags too much rebar', () => {
        const f = ofKind(review({ overrides: { R43: { qty: 50000 } } }), 'rebar-ratio');
        expect(f).toHaveLength(1);
        expect(f[0]?.message).toContain('มากผิดปกติ');
    });

    it('ignores quantities outside the structure sections and rows with no concrete', () => {
        // R148 is steel plate in section 14 (จุด), R231 skim coat; neither counts
        expect(ofKind(review({ overrides: { R148: { qty: 99999 } } }), 'rebar-ratio')).toEqual([]);
    });
});

describe('area-ratio', () => {
    it('does nothing without a usable area', () => {
        expect(ofKind(review(), 'area-ratio')).toEqual([]);
        expect(ofKind(review({}, {}), 'area-ratio')).toEqual([]);
    });

    it('accepts one coat of 688 m² on a 150 m² house (≈ 4.6×)', () => {
        expect(ofKind(review({}, { usableAreaSqm: 150 }), 'area-ratio')).toEqual([]);
    });

    it('flags paint area over 12× the usable area, attached to the first paint row', () => {
        const f = ofKind(review({}, { usableAreaSqm: 40 }), 'area-ratio');
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ key: 'R223', severity: 'warn' });
        expect(f[0]?.message).toContain('มากผิดปกติ');
        expect(f[0]?.message).toContain('40 ตร.ม.');
    });

    it('flags paint area under half the usable area', () => {
        const f = ofKind(review({}, { usableAreaSqm: 2000 }), 'area-ratio');
        expect(f).toHaveLength(1);
        expect(f[0]?.message).toContain('น้อยผิดปกติ');
    });
});

describe('ordering and uniqueness', () => {
    it('lists errors first, then follows section order; one finding per (key, kind)', () => {
        const findings = review({ overrides: { R181: { mat: 0, lab: 0 }, R55: { waste: 0.4 }, R16: { qty: 0 } } });
        expect(findings[0]).toMatchObject({ kind: 'price-zero', key: 'R181' });
        const warns = findings.slice(1);
        expect(warns.every(f => f.severity === 'warn')).toBe(true);
        const sectionOf = (key: string) => compute().sections.findIndex(s => s.rows.some(r => r.key === key));
        const order = warns.map(f => sectionOf(f.key));
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(order.indexOf(sectionOf('R16'))).toBeLessThan(order.indexOf(sectionOf('R55')));
        const ids = findings.map(f => `${f.key}|${f.kind}`);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('is deterministic', () => {
        const a = review({ overrides: { R58: { mat: 9000, qty: 100 } } });
        const b = review({ overrides: { R58: { mat: 9000, qty: 100 } } });
        expect(a).toEqual(b);
    });
});
