import { LINES, unitBid } from '../../testing/bidding-test-kit';
import { checkBidShape, checkSubmission, priceBid } from './bid-pricing.policy';

const reasonOf = (r: ReturnType<typeof checkSubmission>): unknown => (r.ok ? 'ok' : (r.error.details as { reason: string }).reason);

describe('bid pricing policy', () => {
    it('prices a unit bid (line totals, total, normalized) and drops material prices on buyer-material lines', () => {
        const c = priceBid(LINES, unitBid({ lines: [
            { idx: 1, unitPrice: 60, matUnitPrice: 999, excluded: false, reason: '' },
            { idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false, reason: 'ignored' },
        ], adjustment: -100 }));
        expect(c.lines.map(l => [l.idx, l.total, l.matUnitPrice, l.reason])).toEqual([[0, 900, null, ''], [1, 1200, null, '']]);
        expect(c.total).toBe(2000);
        expect(c.normalizedTotal).toBe(4000); // + estimate 2 000 of the unpriced line
    });

    it('prices a lump bid at lumpTotal + adjustment, line totals 0', () => {
        const c = priceBid(LINES, unitBid({ mode: 'lump', lumpTotal: 5000, adjustment: -500 }));
        expect(c.total).toBe(4500);
        expect(c.normalizedTotal).toBe(4500);
        expect(c.lines.every(l => l.total === 0)).toBe(true);
    });

    it('accepts a complete unit bid', () => {
        expect(checkSubmission(LINES, 'unit', 1, unitBid()).ok).toBe(true);
    });

    it('refuses a mode the package does not allow', () => {
        expect(reasonOf(checkSubmission(LINES, 'lump', 1, unitBid()))).toBe('mode_not_allowed');
        expect(reasonOf(checkSubmission(LINES, 'unit', 1, unitBid({ mode: 'lump', lumpTotal: 1 })))).toBe('mode_not_allowed');
        expect(checkSubmission(LINES, 'vendor_choice', 1, unitBid({ mode: 'lump', lumpTotal: 1 })).ok).toBe(true);
    });

    it('needs every non-excluded line priced, material too for vendor-material lines', () => {
        const missing = unitBid({ lines: unitBid().lines.slice(0, 2) });
        expect(reasonOf(checkSubmission(LINES, 'unit', 1, missing))).toBe('line_not_priced');
        const noMat = unitBid({ lines: unitBid().lines.map(l => (l.idx === 2 ? { ...l, matUnitPrice: null } : l)) });
        expect(reasonOf(checkSubmission(LINES, 'unit', 1, noMat))).toBe('line_not_priced');
        const nullPrice = unitBid({ lines: unitBid().lines.map(l => (l.idx === 0 ? { ...l, unitPrice: null } : l)) });
        expect(reasonOf(checkSubmission(LINES, 'unit', 1, nullPrice))).toBe('line_not_priced');
    });

    it('excluded lines need a reason; excluding everything is refused', () => {
        const noReason = unitBid({ lines: unitBid().lines.map(l => (l.idx === 2 ? { ...l, excluded: true, reason: ' ' } : l)) });
        expect(reasonOf(checkSubmission(LINES, 'unit', 1, noReason))).toBe('excluded_needs_reason');
        const withReason = unitBid({ lines: unitBid().lines.map(l => (l.idx === 2 ? { ...l, excluded: true, reason: 'ไม่มีเหล็ก' } : l)) });
        expect(checkSubmission(LINES, 'unit', 1, withReason).ok).toBe(true);
        const all = unitBid({ lines: LINES.map(l => ({ idx: l.idx, unitPrice: null, matUnitPrice: null, excluded: true, reason: 'x' })) });
        expect(reasonOf(checkSubmission(LINES, 'unit', 1, all))).toBe('nothing_priced');
    });

    it('lump mode needs the amount', () => {
        expect(reasonOf(checkSubmission(LINES, 'lump', 1, unitBid({ mode: 'lump', lumpTotal: null })))).toBe('lump_total_missing');
    });

    it('needs one answer per question', () => {
        expect(reasonOf(checkSubmission(LINES, 'unit', 2, unitBid()))).toBe('answers_mismatch');
        expect(reasonOf(checkSubmission(LINES, 'unit', 0, unitBid()))).toBe('answers_mismatch');
    });

    it('refuses a negative total', () => {
        expect(reasonOf(checkSubmission(LINES, 'unit', 1, unitBid({ adjustment: -5000 })))).toBe('negative_total');
    });

    it('refuses unknown and duplicate lines', () => {
        expect(reasonOf(checkBidShape(LINES, 'unit', { mode: 'unit', lines: [{ idx: 9, unitPrice: 1, matUnitPrice: null, excluded: false, reason: '' }] })))
            .toBe('unknown_line');
        const dup = { idx: 0, unitPrice: 1, matUnitPrice: null, excluded: false, reason: '' };
        expect(reasonOf(checkBidShape(LINES, 'unit', { mode: 'unit', lines: [dup, dup] }))).toBe('duplicate_line');
    });
});
