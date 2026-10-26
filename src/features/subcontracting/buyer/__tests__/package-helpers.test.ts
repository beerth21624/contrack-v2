import { describe, expect, it } from 'vitest';
import { manualBidRequestSchema, type BuyerPackageLineDto, type QuestionDto, type ScInvitationDto } from '@/shared/contract';
import {
    addendumBody, allowedBidModes, bidCount, initialManualBid, invitedEntryIds, inviteRoom, manualBidRequest, manualBidTotal, needsMoreBids,
    groupLines, penaltyText, primaryAction, sortQuestions, unpricedLines,
} from '../package/helpers';

const line = (idx: number, over: Partial<BuyerPackageLineDto> = {}): BuyerPackageLineDto => ({
    idx, section: 17, sectionTitle: 'งานก่ออิฐ', desc: `รายการ ${String(idx)}`, unit: 'ตร.ม.',
    qtyNet: 10, qtyGross: 11, qtyPriced: 10, qtyMaterial: 11, labourBasis: 'net', materialBy: 'buyer',
    lineKey: `k${String(idx)}`, estLabUnit: 100, estMatUnit: 50, estTotal: 1000, ...over,
});

type Inv = Pick<ScInvitationDto, 'id' | 'status' | 'latestBid'>;
const inv = (id: string, status: ScInvitationDto['status'], withBid = false): Inv => ({
    id, status,
    latestBid: withBid ? { id: `b-${id}`, version: 1, total: 1000, submittedAt: '2026-10-26T10:00:00Z', enteredByBuyer: false, outdated: false } : null,
});

describe('primaryAction', () => {
    it('draft → invite', () => {
        expect(primaryAction('draft', [])).toEqual({ kind: 'invite' });
    });
    it('open with a price → leveling', () => {
        expect(primaryAction('open', [inv('a', 'sent'), inv('b', 'submitted', true)])).toEqual({ kind: 'leveling' });
    });
    it('open without prices → resend to the unopened', () => {
        expect(primaryAction('open', [inv('a', 'sent'), inv('b', 'viewed'), inv('c', 'sent')])).toEqual({ kind: 'resend', ids: ['a', 'c'] });
    });
    it('open, everyone opened, no price → none', () => {
        expect(primaryAction('open', [inv('a', 'viewed')])).toEqual({ kind: 'none' });
    });
    it('awarded → contracts, cancelled → none', () => {
        expect(primaryAction('awarded', [])).toEqual({ kind: 'contracts' });
        expect(primaryAction('cancelled', [])).toEqual({ kind: 'none' });
    });
    it('a withdrawn invitation does not count as a price', () => {
        expect(bidCount([inv('a', 'withdrawn', true), inv('b', 'submitted', true)])).toBe(1);
    });
});

describe('needsMoreBids / inviteRoom', () => {
    const now = new Date('2026-10-30T12:00:00Z');
    it('rfq past the deadline with < 2 prices', () => {
        const pkg = { status: 'open' as const, sourcingMode: 'rfq' as const, bidDeadline: '2026-10-30T10:00:00Z' };
        expect(needsMoreBids(pkg, [inv('a', 'submitted', true)], now)).toBe(true);
        expect(needsMoreBids(pkg, [inv('a', 'submitted', true), inv('b', 'submitted', true)], now)).toBe(false);
        expect(needsMoreBids({ ...pkg, bidDeadline: '2026-10-31T10:00:00Z' }, [], now)).toBe(false);
        expect(needsMoreBids({ ...pkg, sourcingMode: 'direct' }, [], now)).toBe(false);
    });
    it('rfq allows 8 active invitees, direct 1', () => {
        expect(inviteRoom('rfq', [{ status: 'sent' }, { status: 'withdrawn' }])).toBe(7);
        expect(inviteRoom('direct', [{ status: 'sent' }])).toBe(0);
        expect(inviteRoom('direct', [])).toBe(1);
    });
    it('a declined or closed invitation frees its seat and its crew can be invited again', () => {
        expect(inviteRoom('direct', [{ status: 'declined' }])).toBe(1);
        expect(inviteRoom('rfq', [{ status: 'declined' }, { status: 'closed' }, { status: 'viewed' }])).toBe(7);
        const list = [
            { status: 'declined' as const, vendorListEntryId: 'a' },
            { status: 'withdrawn' as const, vendorListEntryId: 'b' },
            { status: 'submitted' as const, vendorListEntryId: 'c' },
            { status: 'sent' as const, vendorListEntryId: 'd' },
        ];
        expect([...invitedEntryIds(list)].sort()).toEqual(['c', 'd']);
    });
});

describe('addendumBody', () => {
    const lines = [line(0), line(1, { materialBy: 'vendor' }), line(2, { lineKey: null, section: null, desc: 'งานเพิ่ม', unit: 'จุด', qtyNet: 3, estLabUnit: 250 })];
    it('keeps BOQ keys and typed lines, drops the unticked ones', () => {
        const body = addendumBody({ lines, supplyMode: 'labour_only' }, new Set([0]), '  ปริมาณเปลี่ยน ');
        expect(body).toEqual({
            lineKeys: ['k1'],
            customLines: [{ desc: 'งานเพิ่ม', unit: 'จุด', qty: 3, estUnit: 250 }],
            materialByLine: {},
            note: 'ปริมาณเปลี่ยน',
        });
    });
    it('per-line supply keeps who supplies material', () => {
        const body = addendumBody({ lines, supplyMode: 'per_line' }, new Set(), 'x');
        expect(body.materialByLine).toEqual({ k0: 'buyer', k1: 'vendor' });
    });
});

describe('manual bid', () => {
    const lines = [line(0), line(1, { materialBy: 'vendor' })];
    const pkg = {
        lines, pricingMode: 'unit' as const, priceValidUntil: '2026-11-30',
        schedule: { start: '2026-11-02', finish: '2026-11-20', days: 19 },
        installments: [{ no: 1, pct: 0.5, condition: 'ครึ่งหนึ่ง' }, { no: 2, pct: 0.5, condition: 'เสร็จ' }],
        terms: {
            retentionPct: 0.05, warrantyMonths: 12, penalty: { kind: 'none' as const },
            provisions: { water: 'buyer' as const, power: 'buyer' as const, lodging: 'none' as const, scaffolding: 'vendor' as const },
            safetyNote: '', questions: ['มีวิศวกรไหม'],
        },
    };

    it('modes follow the package pricing mode', () => {
        expect(allowedBidModes('unit')).toEqual(['unit']);
        expect(allowedBidModes('lump')).toEqual(['lump']);
        expect(allowedBidModes('vendor_choice')).toEqual(['unit', 'lump']);
    });

    it('total: labour × qtyPriced + material × qtyMaterial where the vendor supplies it, + adjustment', () => {
        const form = initialManualBid(pkg);
        form.lines = [
            { idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false, reason: '' },
            { idx: 1, unitPrice: 80, matUnitPrice: 40, excluded: false, reason: '' },
        ];
        form.adjustment = -100;
        // 90×10 + 80×10 + 40×11 − 100
        expect(manualBidTotal(pkg, form)).toBe(2040);
        expect(unpricedLines(pkg, form)).toEqual([]);
    });

    it('excluded lines need no price and add nothing; missing material price is reported', () => {
        const form = initialManualBid(pkg);
        form.lines = [
            { idx: 0, unitPrice: null, matUnitPrice: null, excluded: true, reason: 'ไม่รับ' },
            { idx: 1, unitPrice: 80, matUnitPrice: null, excluded: false, reason: '' },
        ];
        expect(unpricedLines(pkg, form)).toEqual([1]);
        expect(manualBidTotal(pkg, form)).toBe(800);
    });

    it('lump mode: lump + adjustment, no lines sent', () => {
        const form = { ...initialManualBid({ ...pkg, pricingMode: 'lump' }), lumpTotal: 5000, adjustment: 200 };
        expect(form.mode).toBe('lump');
        expect(manualBidTotal(pkg, form)).toBe(5200);
        const body = manualBidRequest(form);
        expect(body.lines).toEqual([]);
        expect(body.lumpTotal).toBe(5000);
    });

    it('builds a request the contract accepts (defaults from the package)', () => {
        const form = initialManualBid(pkg);
        form.lines = form.lines.map(l => ({ ...l, unitPrice: 100, matUnitPrice: 10 }));
        const body = manualBidRequest(form);
        expect(body.validUntil).toBe('2026-11-30');
        expect(body.days).toBe(19);
        expect(body.installmentsProposal).toBeNull();
        expect(body.answers).toEqual(['']);
        expect(manualBidRequestSchema.safeParse(body).success).toBe(true);
        const proposal = manualBidRequest({ ...form, acceptInstallments: false });
        expect(proposal.installmentsProposal).toEqual(pkg.installments);
    });
});

describe('text and grouping', () => {
    it('penalty', () => {
        expect(penaltyText({ kind: 'none' })).toBe('ไม่มี');
        expect(penaltyText({ kind: 'per_day', amount: 500 })).toBe('500 บาท/วัน');
        expect(penaltyText({ kind: 'pct_per_day', rate: 0.001 })).toBe('0.1% ของมูลค่าสัญญา/วัน');
    });
    it('groups consecutive lines by section title', () => {
        const g = groupLines([line(0), line(1), line(2, { sectionTitle: 'ฉาบ' }), line(3)]);
        expect(g.map(x => [x.title, x.lines.length])).toEqual([['งานก่ออิฐ', 2], ['ฉาบ', 1], ['งานก่ออิฐ', 1]]);
    });
    it('questions: unanswered first (oldest first), then answered (newest first)', () => {
        const q = (id: string, at: string, answered: boolean): QuestionDto => ({
            id, question: id, answer: answered ? 'ok' : null, askedAt: at, answeredAt: answered ? at : null, askedBy: null, mine: false,
        });
        const sorted = sortQuestions([q('a', '2026-10-01T00:00:00Z', true), q('b', '2026-10-03T00:00:00Z', false),
            q('c', '2026-10-02T00:00:00Z', false), q('d', '2026-10-04T00:00:00Z', true)]);
        expect(sorted.map(x => x.id)).toEqual(['c', 'b', 'd', 'a']);
    });
});
