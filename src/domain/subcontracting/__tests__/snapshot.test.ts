import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '../../project';
import { TRADES, buildSnapshot, changedLines, indexBoq, priceLine, sectionsOfTrade, snapshotDrift, subcontractableRows, tradeOfRow } from '..';

const sample = createProject('sample');
const boq = computeProject(sample).boq;

describe('trades', () => {
    it('splits section 17 and 18 exactly like Man-Day (pipes / cables are electrical)', () => {
        expect(tradeOfRow(17, 179)).toBe('masonry');
        expect(tradeOfRow(17, 184)).toBe('electrical');
        expect(tradeOfRow(18, 189)).toBe('masonry');
        expect(tradeOfRow(18, 192)).toBe('electrical');
    });

    it('never subcontracts section 0 and puts section 1 in site preparation', () => {
        expect(tradeOfRow(0, 9)).toBeUndefined();
        expect(tradeOfRow(1, 12)).toBe('site-prep');
    });

    it('covers every BOQ section 1–31', () => {
        const covered = new Set(TRADES.flatMap(t => sectionsOfTrade(t.id)));
        for (let s = 1; s <= 31; s++) expect(covered.has(s)).toBe(true);
    });

    it('gives every sample row with labour a trade (except section 0)', () => {
        const rows = subcontractableRows(boq);
        const section0 = boq.sections.find(s => s.no === 0)?.rows.filter(r => r.type === 'item').length ?? 0;
        expect(rows.length).toBe(indexBoq(boq).size - section0);
    });
});

describe('snapshot', () => {
    const masonryKeys = subcontractableRows(boq).filter(r => r.trade === 'masonry').map(r => r.row.key);

    it('labour-only estimate equals the BOQ labour of the chosen rows', () => {
        const res = buildSnapshot(boq, { lineKeys: masonryKeys, customLines: [], supplyMode: 'labour_only', materialByLine: {} });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const boqLabour = masonryKeys.reduce((s, k) => s + (indexBoq(boq).get(k)?.row.labTotal ?? 0), 0);
        expect(res.snapshot.estimateTotal).toBeCloseTo(boqLabour, 1); // each line is rounded to satang
        expect(res.snapshot.lines.map(l => l.idx)).toEqual(res.snapshot.lines.map((_, i) => i));
    });

    it('with materials adds the BOQ material of the rows', () => {
        const res = buildSnapshot(boq, { lineKeys: masonryKeys, customLines: [], supplyMode: 'with_materials', materialByLine: {} });
        if (!res.ok) throw new Error('unexpected');
        const all = masonryKeys.reduce((s, k) => s + (indexBoq(boq).get(k)?.row.total ?? 0), 0);
        expect(res.snapshot.estimateTotal).toBeCloseTo(all, 1); // each line is rounded to satang
    });

    it('prices gross-basis rows (pipes, cables) on the gross quantity', () => {
        const pipe = [...indexBoq(boq).values()].find(r => r.row.labourBasis === 'gross' && r.row.grossQty !== null && r.row.qty > 0);
        expect(pipe).toBeDefined();
        if (pipe === undefined) return;
        const res = buildSnapshot(boq, { lineKeys: [pipe.row.key], customLines: [], supplyMode: 'labour_only', materialByLine: {} });
        if (!res.ok) throw new Error('unexpected');
        expect(res.snapshot.lines[0]?.qtyPriced).toBe(pipe.row.grossQty);
    });

    it('reports unknown keys instead of dropping them', () => {
        const res = buildSnapshot(boq, { lineKeys: ['no-such-row'], customLines: [], supplyMode: 'labour_only', materialByLine: {} });
        expect(res).toEqual({ ok: false, unknownKeys: ['no-such-row'] });
    });

    it('keeps custom lines after the BOQ rows', () => {
        const res = buildSnapshot(boq, {
            lineKeys: masonryKeys.slice(0, 1), customLines: [{ desc: 'รื้อผนังเดิม', unit: 'ตร.ม.', qty: 10, estUnit: 50 }],
            supplyMode: 'labour_only', materialByLine: {},
        });
        if (!res.ok) throw new Error('unexpected');
        expect(res.snapshot.lines[1]).toMatchObject({ lineKey: null, desc: 'รื้อผนังเดิม', estTotal: 500 });
    });

    it('detects quantity drift and changed lines', () => {
        const res = buildSnapshot(boq, { lineKeys: masonryKeys, customLines: [], supplyMode: 'labour_only', materialByLine: {} });
        if (!res.ok) throw new Error('unexpected');
        expect(snapshotDrift(res.snapshot.lines, boq)).toEqual([]);
        const first = res.snapshot.lines[0];
        if (first === undefined) throw new Error('no line');
        // Drift is on the priced quantity (what the bid multiplies), not the net quantity alone.
        const edited = [{ ...first, qtyPriced: first.qtyPriced + 1 }, ...res.snapshot.lines.slice(1)];
        expect(snapshotDrift(edited, boq).map(d => d.idx)).toEqual([0]);
        const next = [{ ...first, qtyPriced: first.qtyPriced + 1 }, ...res.snapshot.lines.slice(1)];
        expect(changedLines(res.snapshot.lines, next)).toEqual([0]);
    });

    it('prices a line with material only when the vendor supplies it', () => {
        expect(priceLine({ qtyPriced: 10, qtyMaterial: 11, materialBy: 'buyer' }, 100, 50)).toBe(1000);
        expect(priceLine({ qtyPriced: 10, qtyMaterial: 11, materialBy: 'vendor' }, 100, 50)).toBe(1550);
    });
});
