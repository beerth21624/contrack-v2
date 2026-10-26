import { describe, expect, it } from 'vitest';
import {
    BUILT_IN_CONTRACT_TEMPLATE, type ContractTemplateData, formatContractMoney, renderContract, sanitizeContractHtml, thaiBahtText,
} from '../contract-template';

const data: ContractTemplateData = {
    contractNo: 'SC-2026-0001',
    date: '2026-10-26',
    buyerName: 'บริษัท ก่อสร้างดี จำกัด',
    vendorName: 'ทีมช่างสมชาย <script>alert(1)</script>',
    projectName: 'บ้านคุณสมศรี',
    title: 'งานก่ออิฐฉาบปูน',
    tradeLabel: 'ก่ออิฐ-ฉาบปูน',
    location: { district: 'บางกรวย', province: 'นนทบุรี', address: '' },
    lines: [
        { desc: 'ก่ออิฐมอญครึ่งแผ่น', unit: 'ตร.ม.', qty: 120.5, unitPrice: 150, matUnitPrice: null, total: 18_075 },
        { desc: 'ฉาบปูนเรียบ', unit: 'ตร.ม.', qty: 241, unitPrice: 120, matUnitPrice: 30, total: 36_150 },
    ],
    total: 54_225,
    installments: [{ no: 1, pct: 0.5, condition: 'ก่ออิฐเสร็จ', amount: 27_112.5 }, { no: 2, pct: 0.5, condition: 'ฉาบเสร็จ', amount: 27_112.5 }],
    retentionPct: 0.05,
    warrantyMonths: 12,
    penalty: { kind: 'per_day', amount: 500 },
    provisions: { water: 'buyer', power: 'buyer', lodging: 'none', scaffolding: 'vendor' },
    safetyNote: 'สวมหมวกนิรภัยทุกครั้ง',
    schedule: { start: '2026-11-01', finish: '2026-11-30', days: 30 },
    whtPct: 0.03,
    vat: false,
};

describe('renderContract', () => {
    it('fills the built-in template (parties, lines, total in words, terms, signatures)', () => {
        const html = renderContract('', data);
        expect(html).toContain('SC-2026-0001');
        expect(html).toContain('26 ตุลาคม 2569');
        expect(html).toContain('บริษัท ก่อสร้างดี จำกัด');
        expect(html).toContain('ก่ออิฐมอญครึ่งแผ่น');
        expect(html).toContain('54,225.00');
        expect(html).toContain('ห้าหมื่นสี่พันสองร้อยยี่สิบห้าบาทถ้วน');
        expect(html).toContain('ร้อยละ 5 ของค่าจ้างแต่ละงวด');
        expect(html).toContain('12 เดือน');
        expect(html).toContain('วันละ 500.00 บาท');
        expect(html).toContain('นั่งร้าน: ผู้รับจ้างจัดหา');
        expect(html).toContain('หักภาษี ณ ที่จ่ายร้อยละ 3');
        expect(html).toContain('ผู้รับจ้าง<br>');
        expect(html).not.toMatch(/\{\{/);
    });

    it('escapes every value (a crew name cannot inject markup)', () => {
        const html = renderContract('', data);
        expect(html).not.toContain('<script');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('uses a custom template, unknown placeholders render empty, and the result is sanitized', () => {
        const html = renderContract('<p onclick="x()">{{ contractNo }} / {{nope}} / {{total}}</p><img src=x onerror=alert(1)>', data);
        expect(html).toBe('<p>SC-2026-0001 /  / 54,225.00</p>');
    });

    it('the built-in template only uses allowed tags', () => {
        expect(sanitizeContractHtml(BUILT_IN_CONTRACT_TEMPLATE)).toBe(BUILT_IN_CONTRACT_TEMPLATE);
    });
});

describe('sanitizeContractHtml', () => {
    it.each([
        ['<p>a<script>alert(1)</script>b</p>', '<p>ab</p>'],
        ['<SCRIPT src="x"></SCRIPT>ok', 'ok'],
        ['<img src=x onerror="alert(1)">', ''],
        ['<a href="javascript:alert(1)">click</a>', 'click'],
        ['<p style="background:url(javascript:alert(1))" onmouseover=alert(1)>t</p>', '<p>t</p>'],
        ['<svg><script>alert(1)</script></svg>x', 'x'],
        ['<iframe srcdoc="<script>alert(1)</script>"></iframe>y', 'y'],
        ['<!-- <script>alert(1)</script> -->z', 'z'],
        ['<p title=">" onclick="evil()">q</p>', '<p>q</p>'],
        ['<img src=x onerror=alert(1)', '&lt;img src=x onerror=alert(1)'],
        ['1 < 2 > 0', '1 &lt; 2 &gt; 0'],
        ['<br/><hr class="x"></br>', '<br><hr>'],
        ['<style>p{}</style><b>bold</b>', '<b>bold</b>'],
        ['<!DOCTYPE html><span id="s">s</span>', '<span>s</span>'],
        ['<table border=1><tr><td colspan=2>c</td></tr></table>', '<table><tr><td>c</td></tr></table>'],
        ['<scr<script>ipt>alert(1)</script>', 'ipt&gt;alert(1)'],
    ])('%s → %s', (input, expected) => {
        expect(sanitizeContractHtml(input)).toBe(expected);
    });

    it('never outputs a tag outside the allowlist or any attribute', () => {
        const nasty = '<div><p class=a>x</p><math><mi xlink:href="javascript:1">m</mi></math><object data=x></object><u>u</u></div>';
        const out = sanitizeContractHtml(nasty);
        expect(out).toBe('<p>x</p><u>u</u>');
        for (const tag of out.match(/<[^>]*>/g) ?? []) expect(tag).toMatch(/^<\/?[a-z0-9]+>$/);
    });
});

describe('formatting', () => {
    it('money and Thai baht words', () => {
        expect(formatContractMoney(1_234_567.5)).toBe('1,234,567.50');
        expect(formatContractMoney(0)).toBe('0.00');
        expect(thaiBahtText(21)).toBe('ยี่สิบเอ็ดบาทถ้วน');
        expect(thaiBahtText(1_850_317.34)).toBe('หนึ่งล้านแปดแสนห้าหมื่นสามร้อยสิบเจ็ดบาทสามสิบสี่สตางค์');
        expect(thaiBahtText(1_000_001)).toBe('หนึ่งล้านเอ็ดบาทถ้วน');
        expect(thaiBahtText(0.5)).toBe('ห้าสิบสตางค์');
    });
});
