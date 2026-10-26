import { describe, expect, it } from 'vitest';
import {
    type BidPricing, type PricedLine, bidLineTotals, bidTotal, diffFromEstimate, estimateUnitOf, flagOf, isLinePriced,
    EMPTY_LEVELING_CELL, type VersionedLine, levelBid, levelOutdatedBid, normalizedTotal, priceAward, remapBidLines, spreadByEstimate,
    unchangedLines,
} from '../leveling';

// Two labour lines and one line where the vendor supplies material.
const L0: PricedLine = { idx: 0, qtyPriced: 10, qtyMaterial: 10, materialBy: 'buyer', estLabUnit: 100, estMatUnit: 50, estTotal: 1000 };
const L2: PricedLine = { idx: 2, qtyPriced: 5, qtyMaterial: 6, materialBy: 'vendor', estLabUnit: 100, estMatUnit: 250, estTotal: 2000 };
const lines: PricedLine[] = [
    L0,
    { idx: 1, qtyPriced: 20, qtyMaterial: 22, materialBy: 'buyer', estLabUnit: 50, estMatUnit: 0, estTotal: 1000 },
    L2,
];

const unitBid = (over: Partial<BidPricing> = {}): BidPricing => ({
    mode: 'unit',
    lines: [
        { idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false },
        { idx: 1, unitPrice: 60, matUnitPrice: null, excluded: false },
        { idx: 2, unitPrice: 100, matUnitPrice: 200, excluded: false },
    ],
    lumpTotal: null,
    adjustment: 0,
    ...over,
});

const lumpBid = (lumpTotal: number, adjustment = 0): BidPricing => ({ mode: 'lump', lines: [], lumpTotal, adjustment });

describe('bid totals', () => {
    it('unit bid: Σ price × qtyPriced (+ material × qtyMaterial for vendor material) + adjustment', () => {
        // 900 + 1200 + (500 + 1200) = 3800
        expect(bidTotal(lines, unitBid())).toBe(3800);
        expect(bidTotal(lines, unitBid({ adjustment: -300 }))).toBe(3500);
        expect([...bidLineTotals(lines, unitBid()).values()]).toEqual([900, 1200, 1700]);
    });

    it('lump bid: lumpTotal + adjustment', () => {
        expect(bidTotal(lines, lumpBid(4000, -100))).toBe(3900);
        expect(bidTotal(lines, { ...lumpBid(0), lumpTotal: null })).toBe(0);
    });

    it('excluded and missing lines count 0 in the total; a missing price counts 0 (drafts)', () => {
        const bid = unitBid({ lines: [{ idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false }, { idx: 1, unitPrice: 60, matUnitPrice: null, excluded: true }] });
        expect(bidTotal(lines, bid)).toBe(900);
    });

    it('a vendor-material line needs both prices to count as priced', () => {
        expect(isLinePriced(L2, { idx: 2, unitPrice: 100, matUnitPrice: null, excluded: false })).toBe(false);
        expect(isLinePriced(L0, { idx: 0, unitPrice: 100, matUnitPrice: null, excluded: false })).toBe(true);
        expect(isLinePriced(L0, { idx: 0, unitPrice: 100, matUnitPrice: null, excluded: true })).toBe(false);
        expect(isLinePriced(L0, undefined)).toBe(false);
    });
});

describe('normalized total', () => {
    it('fills excluded and unpriced lines with the line estimate', () => {
        const bid = unitBid({
            lines: [
                { idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false },
                { idx: 1, unitPrice: null, matUnitPrice: null, excluded: true },
            ],
            adjustment: -100,
        });
        // 900 + est 1000 + est 2000 − 100
        expect(normalizedTotal(lines, bid)).toBe(3800);
    });

    it('equals the total for a fully priced unit bid and for a lump bid', () => {
        expect(normalizedTotal(lines, unitBid({ adjustment: 50 }))).toBe(3850);
        expect(normalizedTotal(lines, lumpBid(4100, -100))).toBe(4000);
    });
});

describe('diff and flags', () => {
    it('diff is relative to the estimate, null when the estimate is 0', () => {
        expect(diffFromEstimate(1200, 1000)).toBe(0.2);
        expect(diffFromEstimate(1, 0)).toBeNull();
        expect(diffFromEstimate(1000 / 3, 1000)).toBe(-0.6667);
    });

    it('high above +threshold, low below −threshold, very_low below −30 %', () => {
        expect(flagOf(0.21, 0.2)).toBe('high');
        expect(flagOf(0.2, 0.2)).toBeNull();
        expect(flagOf(-0.25, 0.2)).toBe('low');
        expect(flagOf(-0.31, 0.2)).toBe('very_low');
        expect(flagOf(-0.15, 0.1)).toBe('low');
        expect(flagOf(0.15, 0.1)).toBe('high');
        expect(flagOf(null, 0.2)).toBeNull();
    });
});

describe('levelBid', () => {
    it('unit bid: one cell per line with unit price (labour + material), total, diff and flag', () => {
        const view = levelBid(lines, unitBid(), 0.2);
        expect(view.total).toBe(3800);
        expect(view.normalizedTotal).toBe(3800);
        expect(view.diffPct).toBe(-0.05);
        expect(view.flag).toBeNull();
        expect(view.cells.map(c => c.unitPrice)).toEqual([90, 60, 300]);
        expect(view.cells.map(c => c.total)).toEqual([900, 1200, 1700]);
        expect(view.cells.map(c => c.diffPct)).toEqual([-0.1, 0.2, -0.15]);
        expect(view.cells.map(c => c.flag)).toEqual([null, null, null]);
        expect(view.cells.every(c => !c.filled)).toBe(true);
    });

    it('marks excluded / unpriced cells as filled from the estimate', () => {
        const view = levelBid(lines, unitBid({
            lines: [
                { idx: 0, unitPrice: 50, matUnitPrice: null, excluded: false },
                { idx: 1, unitPrice: null, matUnitPrice: null, excluded: true },
                { idx: 2, unitPrice: 200, matUnitPrice: null, excluded: false },
            ],
        }), 0.2);
        expect(view.cells[0]).toMatchObject({ total: 500, diffPct: -0.5, flag: 'very_low', filled: false });
        expect(view.cells[1]).toMatchObject({ total: 1000, excluded: true, filled: true, flag: null, unitPrice: null });
        expect(view.cells[2]).toMatchObject({ total: 2000, excluded: false, filled: true });
        // the half-priced line still counts its labour in the raw total (as in a draft), but fills from the estimate
        expect(view.total).toBe(1500);
        expect(view.normalizedTotal).toBe(3500);
    });

    it('lump bid: spread over lines by estimate share for display, normalized = total', () => {
        const view = levelBid(lines, lumpBid(4800), 0.2);
        expect(view.cells.map(c => c.total)).toEqual([1200, 1200, 2400]);
        expect(view.cells.every(c => c.filled && c.unitPrice === null)).toBe(true);
        expect(view.normalizedTotal).toBe(4800);
        expect(view.diffPct).toBe(0.2);
        expect(view.flag).toBeNull();
        expect(levelBid(lines, lumpBid(5000), 0.2).flag).toBe('high');
    });
});

describe('spreadByEstimate', () => {
    it('adds up to the amount exactly (remainder on the last line)', () => {
        const parts = spreadByEstimate([{ estTotal: 1 }, { estTotal: 1 }, { estTotal: 1 }], 100);
        expect(parts).toEqual([33.33, 33.33, 33.34]);
        expect(spreadByEstimate([{ estTotal: 0 }, { estTotal: 0 }], 10)).toEqual([5, 5]);
        expect(spreadByEstimate([], 10)).toEqual([]);
    });
});

describe('estimateUnitOf', () => {
    it('is labour, plus material when the vendor supplies it', () => {
        expect(estimateUnitOf(L0)).toBe(100);
        expect(estimateUnitOf(L2)).toBe(350);
    });
});

describe('remapBidLines', () => {
    it('matches BOQ lines by key and typed lines by description + unit', () => {
        const from = [
            { idx: 0, lineKey: 'a', desc: 'A', unit: 'm' },
            { idx: 1, lineKey: 'b', desc: 'B', unit: 'm' },
            { idx: 2, lineKey: null, desc: 'Extra', unit: 'job' },
        ];
        const to = [
            { idx: 0, lineKey: 'b', desc: 'B', unit: 'm' },
            { idx: 1, lineKey: 'c', desc: 'C', unit: 'm' },
            { idx: 2, lineKey: null, desc: 'Extra', unit: 'job' },
        ];
        const prices = [0, 1, 2].map(idx => ({ idx, unitPrice: (idx + 1) * 10, matUnitPrice: null, excluded: false }));
        expect(remapBidLines(prices, from, to)).toEqual([
            { idx: 0, unitPrice: 20, matUnitPrice: null, excluded: false },
            { idx: 2, unitPrice: 30, matUnitPrice: null, excluded: false },
        ]);
    });
});

describe('priceAward', () => {
    it('whole unit bid: total incl. the whole adjustment, spread over the lines', () => {
        const r = priceAward(lines, unitBid({ adjustment: -380 }), [0, 1, 2]);
        if (!r.ok) throw new Error(r.reason);
        expect(r.total).toBe(3420);
        expect(r.lines.reduce((s, l) => s + l.total, 0)).toBeCloseTo(3420, 6);
        expect(r.lines.map(l => l.total)).toEqual([810, 1080, 1530]);
        expect(r.lines[2]).toMatchObject({ unitPrice: 100, matUnitPrice: 200 });
        expect(r.lines[0]?.matUnitPrice).toBeNull();
    });

    it('partial unit award: chosen totals + adjustment × chosen / all priced', () => {
        // chosen 900 + 1200 = 2100 of 3800; adjustment −380 × 2100/3800 = −210
        const r = priceAward(lines, unitBid({ adjustment: -380 }), [1, 0]);
        if (!r.ok) throw new Error(r.reason);
        expect(r.total).toBe(1890);
        expect(r.lines.map(l => l.idx)).toEqual([0, 1]);
        expect(r.lines.map(l => l.total)).toEqual([810, 1080]);
    });

    it('a unit bid with an excluded line: the share is of the priced lines only, and the excluded line cannot be awarded', () => {
        const bid = unitBid({
            lines: [
                { idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false },
                { idx: 1, unitPrice: 60, matUnitPrice: null, excluded: false },
                { idx: 2, unitPrice: null, matUnitPrice: null, excluded: true },
            ],
            adjustment: 210,
        });
        const whole = priceAward(lines, bid, [0, 1]);
        expect(whole.ok && whole.total).toBe(2310);
        const bad = priceAward(lines, bid, [2]);
        expect(!bad.ok && bad.reason).toBe('line_not_priced');
    });

    it('lump bid: only the whole package, at its total', () => {
        const part = priceAward(lines, lumpBid(4000, -400), [0, 1]);
        expect(!part.ok && part.reason).toBe('lump_needs_all_lines');
        const r = priceAward(lines, lumpBid(4000, -400), [0, 1, 2]);
        if (!r.ok) throw new Error(r.reason);
        expect(r.total).toBe(3600);
        expect(r.lines.map(l => l.total)).toEqual([900, 900, 1800]);
        expect(r.lines.every(l => l.unitPrice === null)).toBe(true);
    });

    it('refuses no lines, unknown and duplicate lines', () => {
        expect(priceAward(lines, unitBid(), [])).toEqual({ ok: false, reason: 'no_lines' });
        expect(priceAward(lines, unitBid(), [7])).toEqual({ ok: false, reason: 'unknown_line', idx: 7 });
        expect(priceAward(lines, unitBid(), [0, 0])).toEqual({ ok: false, reason: 'duplicate_line', idx: 0 });
    });
});

describe('priceAward refuses a negative part', () => {
    it('lump bid whose adjustment takes it below 0', () => {
        expect(priceAward(lines, lumpBid(1000, -1500), [0, 1, 2])).toEqual({ ok: false, reason: 'negative_total' });
    });

    it('unit bid whose adjustment takes the part below 0 (share against the bid\'s own priced total)', () => {
        // priced 3 800; adjustment −7 600 → whole −3 800; lines 0–1 (2 100 / 3 800) → 2 100 − 4 200 = −2 100
        expect(priceAward(lines, unitBid({ adjustment: -7600 }), [0, 1])).toEqual({ ok: false, reason: 'negative_total' });
        expect(priceAward(lines, unitBid({ adjustment: -3800 }), [0, 1, 2])).toMatchObject({ ok: true, total: 0 });
    });
});

describe('outdated bids (made for an older package version)', () => {
    const a: VersionedLine = { ...L0, lineKey: 'a', desc: 'A', unit: 'm' };
    const b: VersionedLine = { idx: 1, qtyPriced: 20, qtyMaterial: 22, materialBy: 'buyer', estLabUnit: 50, estMatUnit: 0, estTotal: 1000, lineKey: 'b', desc: 'B', unit: 'm' };
    const post: VersionedLine = { ...L2, lineKey: null, desc: 'Post', unit: 'm' };
    const v1 = [a, b, post];
    // v2: line a unchanged (moved to idx 1, new estimate), line b doubled, typed line unchanged, a new line
    const v2: VersionedLine[] = [
        { ...b, idx: 0, qtyPriced: 40, estTotal: 2000 },
        { ...a, idx: 1, estTotal: 1200 },
        { ...post, idx: 2 },
        { idx: 3, qtyPriced: 1, qtyMaterial: 1, materialBy: 'buyer', estLabUnit: 500, estMatUnit: 0, estTotal: 500, lineKey: 'n', desc: 'New', unit: 'job' },
    ];

    it('unchangedLines: same key (or typed desc + unit) and same quantities / supply only', () => {
        expect([...unchangedLines(v1, v2)]).toEqual([[1, 0], [2, 2]]);
        expect(unchangedLines(v1, [{ ...post, materialBy: 'buyer' }]).size).toBe(0);
        expect(unchangedLines(v1, [{ ...a, desc: 'A renamed' }]).size).toBe(0);
    });

    it('levelOutdatedBid: own stored total, no diff / flag, prices on unchanged lines only, empty elsewhere', () => {
        const view = levelOutdatedBid(v2, v1, unitBid({ adjustment: -100 }), 3700, 0.2);
        expect(view).toMatchObject({ total: 3700, normalizedTotal: 3700, diffPct: null, flag: null });
        expect(view.cells[0]).toEqual(EMPTY_LEVELING_CELL);
        expect(view.cells[1]).toMatchObject({ unitPrice: 90, total: 900, diffPct: -0.25, flag: 'low', filled: false });
        expect(view.cells[2]).toMatchObject({ unitPrice: 300, total: 1700, filled: false });
        expect(view.cells[3]).toEqual(EMPTY_LEVELING_CELL);
    });

    it('an excluded unchanged line stays excluded (not filled); a lump bid has only empty cells', () => {
        const bid = unitBid({ lines: [{ idx: 0, unitPrice: null, matUnitPrice: null, excluded: true }] });
        expect(levelOutdatedBid(v2, v1, bid, 0, 0.2).cells[1]).toEqual({ ...EMPTY_LEVELING_CELL, excluded: true });
        const lump = levelOutdatedBid(v2, v1, lumpBid(4000), 4000, 0.2);
        expect(lump.cells).toEqual(v2.map(() => EMPTY_LEVELING_CELL));
        expect(lump.normalizedTotal).toBe(4000);
    });
});
