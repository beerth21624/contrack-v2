import { describe, expect, it } from 'vitest';
import {
    addMonthsToDate, claimAmounts, contractClaimAmounts, installmentAmounts, labourShareOf, retentionSummary, retentionTotals,
} from '../claims';

describe('installmentAmounts', () => {
    it('is pct × total for each installment and adds up exactly', () => {
        const list = installmentAmounts([{ no: 1, pct: 0.3, condition: 'a' }, { no: 2, pct: 0.4, condition: 'b' }, { no: 3, pct: 0.3, condition: 'c' }], 500_000);
        expect(list.map(i => i.amount)).toEqual([150_000, 200_000, 150_000]);
    });

    it('lets the last installment absorb rounding', () => {
        const list = installmentAmounts([1, 2, 3].map(no => ({ no, pct: 1 / 3, condition: 'x' })), 100);
        expect(list.map(i => i.amount)).toEqual([33.33, 33.33, 33.34]);
        expect(list.reduce((s, i) => s + i.amount, 0)).toBeCloseTo(100, 10);
    });

    it('puts accepted variations on the last installment only', () => {
        const list = installmentAmounts([{ no: 1, pct: 0.5, condition: 'a' }, { no: 2, pct: 0.5, condition: 'b' }], 10_000, -1_250.5);
        expect(list.map(i => i.amount)).toEqual([5_000, 3_749.5]);
    });

    it('sorts by number', () => {
        const list = installmentAmounts([{ no: 2, pct: 0.6, condition: 'b' }, { no: 1, pct: 0.4, condition: 'a' }], 1000);
        expect(list.map(i => [i.no, i.amount])).toEqual([[1, 400], [2, 600]]);
    });
});

describe('claimAmounts', () => {
    it('plan acceptance: 40 % of 500,000, retention 5 %, WHT 3 %, no VAT → net 184,000', () => {
        const [first] = installmentAmounts([{ no: 1, pct: 0.4, condition: 'a' }, { no: 2, pct: 0.6, condition: 'b' }], 500_000);
        const a = claimAmounts({ gross: first?.amount ?? 0, adjustments: [], retentionPct: 0.05, whtPct: 0.03, vat: false });
        expect(a).toEqual({ gross: 200_000, adjustments: [], retention: 10_000, wht: 6_000, vat: 0, net: 184_000 });
    });

    it('VAT and withholding are on gross + adjustments; retention stays on gross', () => {
        const a = claimAmounts({
            gross: 100_000, adjustments: [{ label: 'งานเพิ่ม', amount: 5_000 }, { label: 'ค่าปรับ', amount: -2_000 }],
            retentionPct: 0.1, whtPct: 0.03, vat: true,
        });
        expect(a.retention).toBe(10_000);
        expect(a.wht).toBe(3_090);
        expect(a.vat).toBe(7_210);
        expect(a.net).toBe(100_000 + 3_000 - 10_000 - 3_090 + 7_210);
    });

    it('withholds only on the labour share when the vendor supplies material', () => {
        const a = claimAmounts({ gross: 100_000, adjustments: [], retentionPct: 0, whtPct: 0.03, vat: false, labourShare: 0.4 });
        expect(a.wht).toBe(1_200);
        expect(a.net).toBe(98_800);
    });

    it('rounds every figure to satang', () => {
        const a = claimAmounts({ gross: 3333.33, adjustments: [], retentionPct: 0.05, whtPct: 0.03, vat: true });
        expect(a.gross).toBe(3333.33);
        expect(a.retention).toBe(166.67);
        expect(a.wht).toBe(100);
        expect(a.vat).toBe(233.33);
        expect(a.net).toBe(3299.99);
    });
});

describe('retention', () => {
    it('balance = withheld − released − forfeited', () => {
        expect(retentionTotals([
            { kind: 'withheld', amount: 10_000 }, { kind: 'withheld', amount: 5_000.5 },
            { kind: 'released', amount: 3_000 }, { kind: 'forfeited', amount: 1_000 },
        ])).toEqual({ withheld: 15_000.5, released: 3_000, forfeited: 1_000, balance: 11_000.5 });
    });

    it('plans half at completion and the rest when the warranty ends', () => {
        const s = retentionSummary([{ kind: 'withheld', amount: 25_000 }], { completedAt: '2026-11-30', warrantyMonths: 12 });
        expect(s.schedule).toEqual([
            { amount: 12_500, dueAt: '2026-11-30', label: 'คืนครึ่งแรกเมื่อส่งมอบงาน' },
            { amount: 12_500, dueAt: '2027-11-30', label: 'คืนส่วนที่เหลือเมื่อพ้นระยะประกันผลงาน 12 เดือน' },
        ]);
    });

    it('has no dates before completion and takes releases off the first stage first', () => {
        const before = retentionSummary([{ kind: 'withheld', amount: 1_000 }], { completedAt: null, warrantyMonths: 6 });
        expect(before.schedule.map(x => x.dueAt)).toEqual([null, null]);
        const partly = retentionSummary(
            [{ kind: 'withheld', amount: 1_000 }, { kind: 'released', amount: 700 }],
            { completedAt: '2026-01-31', warrantyMonths: 1 },
        );
        expect(partly.schedule).toHaveLength(1);
        expect(partly.schedule[0]).toMatchObject({ amount: 300, dueAt: '2026-02-28' });
        expect(partly.balance).toBe(300);
    });

    it('forfeits reduce what is planned; nothing left → empty schedule', () => {
        const s = retentionSummary(
            [{ kind: 'withheld', amount: 1_000 }, { kind: 'forfeited', amount: 400 }],
            { completedAt: '2026-05-01', warrantyMonths: 0 },
        );
        expect(s.schedule.map(x => x.amount)).toEqual([300, 300]);
        expect(retentionSummary([{ kind: 'withheld', amount: 10 }, { kind: 'released', amount: 10 }], { completedAt: '2026-05-01', warrantyMonths: 3 }).schedule).toEqual([]);
    });

    it('adds months, clamping the day', () => {
        expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28');
        expect(addMonthsToDate('2028-01-31', 1)).toBe('2028-02-29');
        expect(addMonthsToDate('2026-11-15', 14)).toBe('2028-01-15');
    });
});

describe('labourShareOf / contractClaimAmounts', () => {
    const terms = { retentionPct: 0.05, whtPct: 0.03, vat: false };

    it('is 1 for a labour-only contract (no material price on any line)', () => {
        expect(labourShareOf([{ qty: 10, unitPrice: 100, matUnitPrice: null, total: 1_000 }])).toBe(1);
    });

    it('is Σ labour / Σ total when the vendor supplies material on some lines', () => {
        const lines = [
            { qty: 10, unitPrice: 100, matUnitPrice: null, total: 1_000 },
            { qty: 10, unitPrice: 100, matUnitPrice: 200, total: 3_000 },
        ];
        expect(labourShareOf(lines)).toBe(0.5);
        const a = contractClaimAmounts({ terms, lines }, 2_000, [{ label: 'งานเพิ่ม', amount: 200 }]);
        expect(a).toMatchObject({ retention: 100, wht: 33, vat: 0, net: 2_067 });
    });

    it('is 1 when the split is unknown (material price without a labour unit price)', () => {
        expect(labourShareOf([{ qty: 1, unitPrice: null, matUnitPrice: 50, total: 100 }])).toBe(1);
        expect(labourShareOf([{ qty: 1, unitPrice: 10, matUnitPrice: 50, total: 0 }])).toBe(1);
    });

    it('keeps the plan example for a labour-only contract', () => {
        const a = contractClaimAmounts({ terms, lines: [{ qty: 1, unitPrice: 500_000, matUnitPrice: null, total: 500_000 }] }, 200_000, []);
        expect(a).toEqual({ gross: 200_000, adjustments: [], retention: 10_000, wht: 6_000, vat: 0, net: 184_000 });
    });
});
