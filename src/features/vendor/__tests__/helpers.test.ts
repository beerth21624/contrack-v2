import { describe, expect, it } from 'vitest';
import type { ClaimDto, InboxInvitationDto, SubcontractDto, SubcontractSummaryDto } from '@/shared/contract';
import { claimableInstallment, expectedNet, latestClaims } from '../contract-math';
import {
    deadlineInfo, formatBaht, formatDay, locationText, maskPhone, maskedPhoneTail, nextMonths, penaltyText,
    phoneMatchesMasked, scheduleText,
} from '../format';
import { fitWithin, jpegName } from '../images';
import { contractAction, groupInbox, invitationAction, invitationTab } from '../inbox';
import { profileMissing } from '../profile-rules';
import { PROVINCES_BY_REGION, THAI_PROVINCES } from '../provinces';
import { UUID } from './fixtures';

const NOW = Date.parse('2026-10-26T10:00:00.000Z');

describe('format', () => {
    it('money and dates in Thai', () => {
        expect(formatBaht(125000)).toBe('125,000 บาท');
        expect(formatBaht(1234.567)).toBe('1,234.57 บาท');
        expect(formatDay('2026-10-30')).toBe('30 ต.ค. 69');
        expect(formatDay(null)).toBe('');
        expect(formatDay('nope')).toBe('');
    });

    it('countdown to the deadline', () => {
        expect(deadlineInfo('2026-10-28T12:00:00.000Z', NOW)).toEqual({ passed: false, soon: false, left: 'เหลือ 2 วัน' });
        expect(deadlineInfo('2026-10-26T15:30:00.000Z', NOW)).toEqual({ passed: false, soon: true, left: 'เหลือ 5 ชม.' });
        expect(deadlineInfo('2026-10-26T10:12:00.000Z', NOW)).toEqual({ passed: false, soon: true, left: 'เหลือ 12 นาที' });
        expect(deadlineInfo('2026-10-26T10:00:20.000Z', NOW).left).toBe('เหลือ 1 นาที');
        expect(deadlineInfo('2026-10-26T09:00:00.000Z', NOW)).toEqual({ passed: true, soon: false, left: 'ปิดรับแล้ว' });
        expect(deadlineInfo('garbage', NOW).passed).toBe(true);
    });

    it('phone masking and the invited-phone hint', () => {
        expect(maskPhone('+66812345678')).toBe('081-xxx-5678');
        expect(maskedPhoneTail('08x-xxx-5678')).toBe('5678');
        expect(maskedPhoneTail('••••••5678')).toBe('5678');
        expect(maskedPhoneTail('+66•••••••78')).toBe('');
        expect(maskedPhoneTail('')).toBe('');
        expect(phoneMatchesMasked('081-234-5678', '08x-xxx-5678')).toBe(true);
        expect(phoneMatchesMasked('0812340000', '08x-xxx-5678')).toBe(false);
        expect(phoneMatchesMasked('0812340000', '')).toBe(true);
    });

    it('plain words for schedule, place and penalty', () => {
        expect(scheduleText({ start: '2026-11-01', finish: null, days: 30 })).toBe('เริ่ม 1 พ.ย. 69 · 30 วัน');
        expect(scheduleText({ start: null, finish: null, days: null })).toBe('');
        expect(locationText({ district: 'เมือง', province: 'ขอนแก่น' })).toBe('อ.เมือง จ.ขอนแก่น');
        expect(locationText({ district: '', province: 'ขอนแก่น' })).toBe('จ.ขอนแก่น');
        expect(penaltyText({ kind: 'per_day', amount: 500 })).toBe('ปรับวันละ 500 บาท เมื่อเสร็จช้า');
        expect(penaltyText({ kind: 'pct_per_day', rate: 0.001 })).toBe('ปรับวันละ 0.1% ของค่างาน เมื่อเสร็จช้า');
    });

    it('next months start with the current one', () => {
        expect(nextMonths(new Date(2026, 10, 15), 3)).toEqual(['2026-11', '2026-12', '2027-01']);
    });
});

describe('provinces', () => {
    it('has the 77 provinces, each once', () => {
        expect(THAI_PROVINCES).toHaveLength(77);
        expect(new Set(THAI_PROVINCES).size).toBe(77);
        expect(PROVINCES_BY_REGION.flatMap(r => r.provinces)).toEqual(THAI_PROVINCES);
        expect(THAI_PROVINCES).toContain('บึงกาฬ');
    });
});

describe('images', () => {
    it('fits photos inside 1600 px without enlarging', () => {
        expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
        expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
        expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
        expect(fitWithin(0, 600, 1600)).toEqual({ width: 0, height: 0 });
        expect(jpegName('IMG_0012.HEIC')).toBe('IMG_0012.jpg');
        expect(jpegName('.png')).toBe('photo.jpg');
    });
});

function inv(patch: Partial<InboxInvitationDto> = {}): InboxInvitationDto {
    return {
        invitationId: UUID(1), packageId: UUID(2), buyerName: 'ผู้ว่าจ้าง', title: 'งาน', trade: 'masonry', province: 'ขอนแก่น',
        bidDeadline: '2026-10-30T10:00:00.000Z', status: 'viewed', packageStatus: 'open', hasDraft: false, latestBidTotal: null,
        outcome: 'pending', unreadMessages: 0, receivedAt: '2026-10-20T10:00:00.000Z', ...patch,
    };
}

function sum(patch: Partial<SubcontractSummaryDto> = {}): SubcontractSummaryDto {
    return {
        id: UUID(5), contractNo: 'SC-001', projectId: UUID(6), projectName: 'บ้าน', packageId: UUID(2), buyerWorkspaceId: UUID(7),
        buyerName: 'ผู้ว่าจ้าง', vendorWorkspaceId: UUID(8), vendorName: 'ทีม', title: 'งาน', trade: 'masonry', status: 'active',
        total: 100000, paidTotal: 0, retentionBalance: 0, nextInstallment: 1, pendingAction: 'none', createdAt: '2026-10-21T10:00:00.000Z', ...patch,
    };
}

describe('inbox', () => {
    it('puts each invitation in one tab', () => {
        expect(invitationTab(inv(), NOW)).toBe('todo');
        expect(invitationTab(inv({ status: 'sent' }), NOW)).toBe('todo');
        expect(invitationTab(inv({ status: 'submitted' }), NOW)).toBe('submitted');
        expect(invitationTab(inv({ status: 'submitted', packageStatus: 'reviewing' }), NOW)).toBe('submitted');
        expect(invitationTab(inv({ bidDeadline: '2026-10-25T10:00:00.000Z' }), NOW)).toBe('history');
        expect(invitationTab(inv({ status: 'declined' }), NOW)).toBe('history');
        expect(invitationTab(inv({ outcome: 'won', status: 'won' }), NOW)).toBe('history');
        expect(invitationTab(inv({ packageStatus: 'cancelled' }), NOW)).toBe('history');
    });

    it('sorts to-do by deadline, contracts by what needs me, history newest first', () => {
        const g = groupInbox(
            [
                inv({ invitationId: UUID(11), bidDeadline: '2026-11-05T10:00:00.000Z' }),
                inv({ invitationId: UUID(12), bidDeadline: '2026-10-27T10:00:00.000Z' }),
                inv({ invitationId: UUID(13), status: 'lost', outcome: 'lost', receivedAt: '2026-10-01T10:00:00.000Z' }),
            ],
            [sum({ id: UUID(21) }), sum({ id: UUID(22), status: 'pending_acceptance' }), sum({ id: UUID(23), status: 'closed', createdAt: '2026-10-25T10:00:00.000Z' })],
            NOW,
        );
        const ids = (xs: typeof g.todo) => xs.map(x => (x.kind === 'invitation' ? x.item.invitationId : x.item.id));
        expect(ids(g.todo)).toEqual([UUID(12), UUID(11)]);
        expect(ids(g.contracts)).toEqual([UUID(22), UUID(21)]);
        expect(ids(g.history)).toEqual([UUID(23), UUID(13)]);
    });

    it('gives each card one action', () => {
        expect(invitationAction(inv(), 'todo')).toMatchObject({ label: 'เสนอราคา', primary: true });
        expect(invitationAction(inv({ hasDraft: true }), 'todo').label).toBe('ทำใบเสนอราคาต่อ');
        expect(invitationAction(inv({ unreadMessages: 2 }), 'submitted')).toMatchObject({ label: 'อ่านข้อความ', primary: true });
        expect(contractAction(sum({ status: 'pending_acceptance', pendingAction: 'vendor_accept' })).primary).toBe(true);
        expect(contractAction(sum({ nextInstallment: 2 })).label).toBe('ดูงวด 2');
    });
});

function claim(patch: Partial<ClaimDto>): ClaimDto {
    return {
        id: UUID(30), subcontractId: UUID(5), installmentNo: 1, condition: '', status: 'requested', requestedBy: 'vendor',
        requestedAt: '2026-10-22T10:00:00.000Z', note: '', photos: [], inspection: null,
        amounts: { gross: 40000, adjustments: [], retention: 2000, wht: 1200, vat: 0, net: 36800 },
        approvedAt: null, paidAt: null, paidAmount: null, paidChannel: null, paidRef: null, rejectedReason: null, ...patch,
    };
}

type Inst = SubcontractDto['installments'][number];
const inst = (no: number, state: Inst['state']): Inst => ({ no, pct: 0.5, condition: 'x', amount: 50000, claimId: null, state });

describe('contract math', () => {
    it('expected net = gross − retention − WHT + VAT', () => {
        expect(expectedNet(40000, { retentionPct: 0.05, whtPct: 0.03, vat: false })).toEqual({ gross: 40000, retention: 2000, wht: 1200, vat: 0, net: 36800 });
        expect(expectedNet(10000, { retentionPct: 0, whtPct: 0.03, vat: true }).net).toBe(10000 - 300 + 700);
        expect(expectedNet(333.33, { retentionPct: 0.05, whtPct: 0, vat: false }).retention).toBe(16.67);
    });

    it('withholding only on the labour share when the crew supplies material (domain rule)', () => {
        const lines = [
            { idx: 0, desc: '', unit: '', qty: 10, unitPrice: 100, matUnitPrice: 50, total: 1500 },
            { idx: 1, desc: '', unit: '', qty: 1, unitPrice: 500, matUnitPrice: null, total: 500 },
        ];
        expect(expectedNet(10000, { retentionPct: 0, whtPct: 0.03, vat: false }, lines).wht).toBe(225);
    });

    it('the claimable installment is the first one without a live claim', () => {
        const sc = { status: 'active' as const, installments: [inst(1, 'paid'), inst(2, 'not_started'), inst(3, 'not_started')] };
        expect(claimableInstallment(sc, [])).toBe(2);
        expect(claimableInstallment({ ...sc, installments: [inst(1, 'requested'), inst(2, 'not_started')] }, [claim({})])).toBeNull();
        const failed = claim({ status: 'inspected', inspection: { result: 'fail', checklist: [], fixes: [], note: '', byName: 'a', at: '2026-10-23T10:00:00.000Z' } });
        expect(claimableInstallment({ ...sc, installments: [inst(1, 'inspected'), inst(2, 'not_started')] }, [failed])).toBe(1);
        expect(claimableInstallment({ ...sc, installments: [inst(1, 'not_started')] }, [claim({ status: 'rejected' })])).toBe(1);
        expect(claimableInstallment({ ...sc, status: 'completed' }, [])).toBeNull();
    });

    it('keeps the latest claim per installment', () => {
        const old = claim({ id: UUID(31), status: 'rejected', requestedAt: '2026-10-01T10:00:00.000Z' });
        const fresh = claim({ id: UUID(32), requestedAt: '2026-10-10T10:00:00.000Z' });
        expect(latestClaims([fresh, old]).get(1)?.id).toBe(UUID(32));
    });
});

describe('profile completeness (L1)', () => {
    it('lists what is missing', () => {
        const empty = { trades: [], provinces: [], crewSkilled: null, crewLabourers: null, portfolio: [] };
        expect(profileMissing(empty)).toEqual(['ประเภทงานที่รับ', 'จังหวัดที่รับงาน', 'จำนวนช่างและคนงาน', 'ผลงานอีก 3 รายการ']);
        const item = { id: UUID(40), title: 'บ้าน', trade: 'masonry' as const, year: 2025, district: '', province: '', photos: [], note: '', createdAt: '2026-10-01T10:00:00.000Z' };
        expect(profileMissing({ trades: ['masonry'], provinces: ['ขอนแก่น'], crewSkilled: 2, crewLabourers: null, portfolio: [item, item, item] })).toEqual([]);
        expect(profileMissing({ trades: ['masonry'], provinces: ['ขอนแก่น'], crewSkilled: null, crewLabourers: 0, portfolio: [item] })).toEqual(['ผลงานอีก 2 รายการ']);
    });
});
