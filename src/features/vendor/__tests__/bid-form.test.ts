import { describe, expect, it } from 'vitest';
import { saveBidDraftRequestSchema, submitBidRequestSchema } from '@/shared/contract';
import {
    bidFormReducer, bidTotal, checkBid, initBidForm, installmentsPctSum, lineTotal, parseAmount, parseCount,
    toDraftRequest, toSubmitRequest, type BidFormAction, type BidFormState,
} from '../bid-form';
import { UUID, bid, line, pkg } from './fixtures';

const apply = (s: BidFormState, ...actions: BidFormAction[]) => actions.reduce(bidFormReducer, s);
const price = (idx: number, unitPrice: string, matUnitPrice = ''): BidFormAction => ({ type: 'line', idx, patch: { unitPrice, matUnitPrice } });

describe('parseAmount / parseCount', () => {
    it('reads what people type', () => {
        expect(parseAmount('1,250.50')).toBe(1250.5);
        expect(parseAmount(' 120 ')).toBe(120);
        expect(parseAmount('0')).toBe(0);
        expect(parseAmount('12.')).toBe(12);
        expect(parseAmount('')).toBeNull();
        expect(parseAmount('.')).toBeNull();
        expect(parseAmount('-5')).toBeNull();
        expect(parseAmount('12a')).toBeNull();
        expect(parseCount('3')).toBe(3);
        expect(parseCount('2.5')).toBeNull();
    });
});

describe('initBidForm', () => {
    it('starts empty from the package (validUntil from the package, buyer installments accepted)', () => {
        const s = initBidForm(pkg(), null);
        expect(s.mode).toBe('unit');
        expect(s.lines.map(l => l.idx)).toEqual([0, 1, 2]);
        expect(s.lines.every(l => l.unitPrice === '' && !l.excluded)).toBe(true);
        expect(s.validUntil).toBe('2026-12-31');
        expect(s.installmentsMode).toBe('accept');
        expect(s.installments).toEqual([{ pct: '40', condition: 'ก่อเสร็จ' }, { pct: '60', condition: 'ฉาบเสร็จ' }]);
        expect(s.answers).toEqual(['']);
        expect(s.rev).toBe(0);
    });

    it('restores a saved draft', () => {
        const s = initBidForm(pkg(), bid());
        expect(s.lines[0]?.unitPrice).toBe('100');
        expect(s.lines[1]?.matUnitPrice).toBe('20');
        expect(s.lines[2]?.excluded).toBe(true);
        expect(s.discount).toBe('40');
        expect(s.days).toBe('20');
        expect(s.answers).toEqual(['มี']);
    });

    it('lump packages start in lump mode; vendor_choice follows the draft', () => {
        expect(initBidForm(pkg({ pricingMode: 'lump' }), null).mode).toBe('lump');
        expect(initBidForm(pkg({ pricingMode: 'vendor_choice' }), null).mode).toBe('unit');
        expect(initBidForm(pkg({ pricingMode: 'vendor_choice' }), bid({ mode: 'lump', lumpTotal: 5000 })).mode).toBe('lump');
    });
});

describe('reducer', () => {
    it('bumps rev on each change (drives autosave), not on a no-op', () => {
        const s0 = initBidForm(pkg(), null);
        const s1 = apply(s0, price(0, '10'));
        expect(s1.rev).toBe(1);
        expect(s1.lines[0]?.unitPrice).toBe('10');
        // removing the only installment is refused: same state, same rev
        const one = { ...s0, installments: [{ pct: '100', condition: 'เสร็จ' }] };
        expect(bidFormReducer(one, { type: 'removeInstallment', index: 0 })).toBe(one);
    });

    it('adds a line the draft did not know (addendum) when it is edited', () => {
        const s = apply(initBidForm(pkg(), null), price(7, '5'));
        expect(s.lines.find(l => l.idx === 7)?.unitPrice).toBe('5');
    });

    it('caps photos at 10 and ignores duplicates', () => {
        let s = initBidForm(pkg(), null);
        const file = (n: number) => ({ id: UUID(100 + n), name: `${String(n)}.jpg`, contentType: 'image/jpeg', size: 1, url: '/x', createdAt: '2026-10-26T10:00:00.000Z' });
        for (let n = 0; n < 12; n += 1) s = bidFormReducer(s, { type: 'addPhoto', file: file(n) });
        s = bidFormReducer(s, { type: 'addPhoto', file: file(0) });
        expect(s.photos).toHaveLength(10);
    });
});

describe('totals', () => {
    it('line total = labour × priced qty + material × material qty (vendor material only)', () => {
        const p = pkg();
        const s = apply(initBidForm(p, null), price(0, '100', '999'), price(1, '50', '20'));
        const [d0, d1] = s.lines;
        const l1 = p.lines[1];
        if (d0 === undefined || d1 === undefined || l1 === undefined) throw new Error('fixture');
        expect(lineTotal(line(0), d0)).toBe(1000); // buyer supplies material: a material price is ignored
        expect(lineTotal(l1, d1)).toBe(50 * 10 + 20 * 12);
        expect(lineTotal(line(0), { ...d0, excluded: true })).toBe(0);
    });

    it('bid total = Σ lines − discount, excluded lines count 0, never below 0', () => {
        const p = pkg();
        let s = apply(initBidForm(p, null), price(0, '100'), price(1, '50', '20'), price(2, '10'));
        expect(bidTotal(p, s)).toBe(1000 + 740 + 100);
        s = apply(s, { type: 'line', idx: 2, patch: { excluded: true } }, { type: 'field', field: 'discount', value: '40' });
        expect(bidTotal(p, s)).toBe(1700);
        s = apply(s, { type: 'field', field: 'discount', value: '99999' });
        expect(bidTotal(p, s)).toBe(0);
    });

    it('lump total ignores lines and discount', () => {
        const p = pkg({ pricingMode: 'lump' });
        const s = apply(initBidForm(p, null), { type: 'field', field: 'lumpTotal', value: '85,000' }, { type: 'field', field: 'discount', value: '500' });
        expect(bidTotal(p, s)).toBe(85000);
    });

    it('installment percentages add up', () => {
        const s = apply(initBidForm(pkg(), null), { type: 'installmentsMode', mode: 'propose' }, { type: 'installment', index: 1, patch: { pct: '50' } });
        expect(installmentsPctSum(s)).toBe(90);
    });
});

describe('checkBid', () => {
    it('blocks unpriced lines and excluded lines without a reason; warns (not blocks) on 0', () => {
        const p = pkg();
        let s = apply(initBidForm(p, null), price(0, '0'), { type: 'line', idx: 2, patch: { excluded: true } });
        let c = checkBid(p, s);
        expect(c.errors).toHaveLength(2);
        expect(c.warnings).toHaveLength(1);
        expect(c.lineIdx.sort()).toEqual([0, 1, 2]);
        s = apply(s, price(1, '50', '20'), { type: 'line', idx: 2, patch: { reason: 'ผู้ว่าจ้างทำเอง' } });
        c = checkBid(p, s);
        expect(c.errors).toEqual([]);
        expect(c.warnings).toHaveLength(1);
        expect(c.lineIdx).toEqual([0]);
    });

    it('blocks a crew-material line with a labour price but no material price (the server refuses it)', () => {
        const p = pkg();
        const s = apply(initBidForm(p, null), price(0, '10'), price(1, '50'), price(2, '10'));
        const c = checkBid(p, s);
        expect(c.errors).toHaveLength(1);
        expect(c.errors[0]).toContain('ค่าวัสดุ');
        expect(c.lineIdx).toEqual([1]);
        expect(checkBid(p, apply(s, price(1, '50', '0'))).errors).toEqual([]);
    });

    it('a line with 0 labour but a material price is not a 0-price line', () => {
        const p = pkg();
        const s = apply(initBidForm(p, null), price(0, '10'), price(1, '0', '20'), price(2, '10'));
        expect(checkBid(p, s).warnings).toEqual([]);
    });

    it('needs at least one priced line, a lump sum, proposals summing to 100 %', () => {
        const p = pkg();
        const all = apply(initBidForm(p, null), ...[0, 1, 2].map((idx): BidFormAction => ({ type: 'line', idx, patch: { excluded: true, reason: 'x' } })));
        expect(checkBid(p, all).errors).toContain('ต้องเสนอราคาอย่างน้อย 1 รายการ');
        const lp = pkg({ pricingMode: 'lump' });
        expect(checkBid(lp, initBidForm(lp, null)).errors).toContain('ใส่ราคาเหมารวม');
        const prop = apply(initBidForm(lp, null), { type: 'field', field: 'lumpTotal', value: '100' }, { type: 'installmentsMode', mode: 'propose' },
            { type: 'installment', index: 0, patch: { pct: '30' } });
        expect(checkBid(lp, prop).errors.some(e => e.includes('100%'))).toBe(true);
    });
});

describe('requests', () => {
    it('submit body matches the contract and sends fractions, a negative adjustment, nulls for blanks', () => {
        const p = pkg();
        const s = apply(initBidForm(p, null),
            price(0, '100', '7'), price(1, '50', '20'),
            { type: 'line', idx: 2, patch: { excluded: true, reason: '  ผู้ว่าจ้างทำเอง ' } },
            { type: 'field', field: 'discount', value: '40' },
            { type: 'field', field: 'days', value: '20' },
            { type: 'installmentsMode', mode: 'propose' },
            { type: 'installment', index: 0, patch: { pct: '33.33' } },
            { type: 'installment', index: 1, patch: { pct: '66.67' } },
            { type: 'answer', index: 0, value: ' มี ' });
        const body = toSubmitRequest(p, s);
        expect(submitBidRequestSchema.safeParse(body).success).toBe(true);
        expect(body.lines).toEqual([
            { idx: 0, unitPrice: 100, matUnitPrice: null, excluded: false, reason: '' },
            { idx: 1, unitPrice: 50, matUnitPrice: 20, excluded: false, reason: '' },
            { idx: 2, unitPrice: null, matUnitPrice: null, excluded: true, reason: 'ผู้ว่าจ้างทำเอง' },
        ]);
        expect(body.adjustment).toBe(-40);
        expect(body.days).toBe(20);
        expect(body.installmentsProposal?.map(i => i.pct)).toEqual([0.3333, 0.6667]);
        expect(body.answers).toEqual(['มี']);
        expect(body.crewSkilled).toBeNull();
        expect(body.earliestStart).toBeNull();
    });

    it('lump body has no lines and the lump sum', () => {
        const p = pkg({ pricingMode: 'lump' });
        const s = apply(initBidForm(p, null), { type: 'field', field: 'lumpTotal', value: '85000' }, { type: 'field', field: 'inclusions', value: 'รวมนั่งร้าน' });
        const body = toSubmitRequest(p, s);
        expect(body.lines).toEqual([]);
        expect(body.lumpTotal).toBe(85000);
        expect(body.adjustment).toBe(0);
        expect(body.inclusions).toBe('รวมนั่งร้าน');
    });

    it('a draft with a half-typed installment proposal still saves (without the proposal)', () => {
        const p = pkg();
        const s = apply(initBidForm(p, null), price(0, '12'), { type: 'installmentsMode', mode: 'propose' }, { type: 'installment', index: 0, patch: { pct: '10' } });
        const draft = toDraftRequest(p, s);
        expect(saveBidDraftRequestSchema.safeParse(draft).success).toBe(true);
        expect('installmentsProposal' in draft).toBe(false);
        expect(draft.lines?.[0]?.unitPrice).toBe(12);
    });

    it('round-trips: a draft restored and sent again gives the same body', () => {
        const p = pkg();
        const first = toSubmitRequest(p, initBidForm(p, bid()));
        expect(first.lines[0]).toEqual({ idx: 0, unitPrice: 100, matUnitPrice: null, excluded: false, reason: '' });
        expect(first.adjustment).toBe(-40);
        expect(first.validUntil).toBe('2026-12-15');
    });
});
