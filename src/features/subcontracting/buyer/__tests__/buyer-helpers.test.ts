import { describe, expect, it } from 'vitest';
import { installmentsSchema, type ProcurementOverviewDto } from '@/shared/contract';
import {
    countdown, daysBetween, defaultBidDeadline, defaultInstallments, defaultPriceValidUntil, installmentsValid,
    invitationMessage, lineShareUrl, money, money0, pct, renumber, toDay,
} from '../format';
import { tradeRowsView } from '../overview-model';
import { normalizeProvince, provinceInAddress, THAI_PROVINCES } from '../provinces';
import { parseCsv, parseTrades, phoneFromCell, rowsFromTable } from '../vendor-import';

describe('format', () => {
    it('formats money and percentages the Thai way', () => {
        expect(money(125000)).toBe('125,000.00');
        expect(money0(125000.4)).toBe('125,000');
        expect(money(Number.NaN)).toBe('0.00');
        expect(pct(0.125, true)).toBe('+12.5%');
        expect(pct(-0.3, true)).toBe('-30%');
        expect(pct(0.05)).toBe('5%');
        expect(pct(null)).toBe('–');
    });

    it('defaults the bid deadline to +5 days 17:00 and the price validity to +30 days', () => {
        const now = new Date(2026, 9, 26, 9, 30);
        const deadline = new Date(defaultBidDeadline(now));
        expect(toDay(deadline)).toBe('2026-10-31');
        expect(deadline.getHours()).toBe(17);
        expect(deadline.getMinutes()).toBe(0);
        expect(defaultPriceValidUntil(now)).toBe('2026-11-25');
    });

    it('counts down to the deadline', () => {
        const now = new Date('2026-10-26T10:00:00Z');
        expect(countdown('2026-10-28T13:00:00Z', now)).toEqual({ text: 'เหลือ 2 วัน 3 ชม.', passed: false, soon: false });
        expect(countdown('2026-10-26T10:45:00Z', now)).toEqual({ text: 'เหลือ 45 นาที', passed: false, soon: true });
        expect(countdown('2026-10-26T09:00:00Z', now).passed).toBe(true);
    });

    it('counts days inclusive', () => {
        expect(daysBetween('2026-11-01', '2026-11-14')).toBe(14);
        expect(daysBetween('2026-11-05', '2026-11-01')).toBeNull();
        expect(daysBetween(null, '2026-11-01')).toBeNull();
    });

    it('proposes 2 × 50 % for short jobs and 30/40/30 for long ones, both valid for the contract', () => {
        for (const days of [null, 7, 14, 15, 60]) {
            const list = defaultInstallments(days);
            expect(installmentsSchema.safeParse(list).success).toBe(true);
            expect(installmentsValid(list)).toBe(true);
        }
        expect(defaultInstallments(14).map(i => i.pct)).toEqual([0.5, 0.5]);
        expect(defaultInstallments(15).map(i => i.pct)).toEqual([0.3, 0.4, 0.3]);
        expect(installmentsValid([{ no: 1, pct: 0.6, condition: 'a' }, { no: 2, pct: 0.3, condition: 'b' }])).toBe(false);
        expect(renumber([{ no: 3, pct: 1, condition: 'x' }])[0]?.no).toBe(1);
    });

    it('builds the message and the LINE share link', () => {
        const text = invitationMessage({ buyerName: 'บริษัท ก', title: 'งานไฟฟ้า', deadline: '2026-10-31T10:00:00Z', url: 'https://x.test/s/abc' });
        expect(text).toContain('บริษัท ก');
        expect(text).toContain('https://x.test/s/abc');
        expect(lineShareUrl('a b&c')).toBe('https://line.me/R/msg/text/?a%20b%26c');
    });
});

describe('provinces', () => {
    it('has the 77 provinces once each', () => {
        expect(THAI_PROVINCES).toHaveLength(77);
        expect(new Set(THAI_PROVINCES).size).toBe(77);
    });

    it('normalizes and finds provinces', () => {
        expect(normalizeProvince('จ.เชียงใหม่')).toBe('เชียงใหม่');
        expect(normalizeProvince('กทม.')).toBe('กรุงเทพมหานคร');
        expect(provinceInAddress('99 ม.2 ต.บ้านใหม่ อ.เมือง จ.นครปฐม')).toBe('นครปฐม');
        expect(provinceInAddress('เขตบางนา กรุงเทพฯ')).toBe('กรุงเทพมหานคร');
        expect(provinceInAddress('')).toBe('');
    });
});

describe('overview rows', () => {
    const trade = (t: Partial<ProcurementOverviewDto['trades'][number]> & Pick<ProcurementOverviewDto['trades'][number], 'trade'>) => ({
        estimate: 0, contracted: 0, status: 'not_sourced' as const, problem: null, packages: [], subcontracts: [], ...t,
    });

    it('puts problems first, drops empty trades and computes the difference', () => {
        const rows = tradeRowsView({
            projectId: '00000000-0000-4000-8000-000000000000', estimateTotal: 0, contractedTotal: 0, coverage: 0, todo: [],
            trades: [
                trade({ trade: 'piling' }),
                trade({ trade: 'structure', estimate: 100_000, contracted: 110_000, status: 'contracted' }),
                trade({ trade: 'electrical', estimate: 30_000, status: 'problem', problem: 'เลยกำหนด' }),
                trade({ trade: 'masonry', estimate: 50_000 }),
            ],
        });
        expect(rows.map(r => r.trade)).toEqual(['electrical', 'structure', 'masonry']);
        expect(rows[1]?.diffPct).toBeCloseTo(0.1);
        expect(rows[0]?.diffPct).toBeNull();
    });
});

describe('vendor import', () => {
    it('reads CSV with quotes, BOM and CRLF', () => {
        expect(parseCsv('﻿ชื่อ,เบอร์\r\n"ทีม ""ก""",0812345678\r\nข,"09-1, 2"\r\n')).toEqual([
            ['ชื่อ', 'เบอร์'], ['ทีม "ก"', '0812345678'], ['ข', '09-1, 2'],
        ]);
    });

    it('matches trades from free text', () => {
        expect(parseTrades('ไฟฟ้า, ประปา')).toEqual(['electrical', 'plumbing']);
        expect(parseTrades('โครงหลังคา / มุงหลังคา')).toEqual(['roof-structure', 'roofing']);
        expect(parseTrades('ก่ออิฐ-ฉาบปูน')).toEqual(['masonry']);
        expect(parseTrades('electrical;tiling')).toEqual(['electrical', 'tiling']);
        expect(parseTrades('ทำสวน')).toEqual([]);
    });

    it('puts back the leading 0 Excel drops from phones', () => {
        expect(phoneFromCell('812345678')).toBe('+66812345678');
        expect(phoneFromCell('081-234-5678')).toBe('+66812345678');
        expect(phoneFromCell('12')).toBe('12');
    });

    it('maps columns by header, skips empty and incomplete rows', () => {
        const parsed = rowsFromTable([
            ['', '', ''],
            ['จังหวัด', 'ชื่อทีม', 'เบอร์โทร', 'ประเภทงาน'],
            ['จ.ขอนแก่น', 'ทีมช่างเอ', '0812345678', 'ไฟฟ้า'],
            ['', '', '', ''],
            ['', 'ไม่มีเบอร์', '', ''],
            ['', 'ทีมบี', '0891112222', ''],
        ]);
        expect(parsed.rows).toEqual([
            { displayName: 'ทีมช่างเอ', phone: '+66812345678', trades: ['electrical'], province: 'ขอนแก่น', lineId: '' },
            { displayName: 'ทีมบี', phone: '+66891112222', trades: [], province: '', lineId: '' },
        ]);
        expect(parsed.sourceRows).toEqual([3, 6]);
        expect(parsed.incomplete).toEqual([5]);
    });

    it('reads a table without a header in the order name, phone, trades, province', () => {
        const parsed = rowsFromTable([['ทีมซี', '0812345678', 'ทาสี', 'ระยอง']]);
        expect(parsed.rows[0]).toEqual({ displayName: 'ทีมซี', phone: '+66812345678', trades: ['painting'], province: 'ระยอง', lineId: '' });
    });
});
