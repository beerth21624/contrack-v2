import { NOTIFICATION_TEMPLATES, SC_NOTIFICATION_TEMPLATES, SMS_MAX_CHARS, SMS_WORTHY_TEMPLATES, fitSms, renderNotification } from './notification-templates';

const LONG = 'งานติดตั้งระบบไฟฟ้าและสุขาภิบาลอาคารสำนักงานสูงแปดชั้นพร้อมชั้นใต้ดินสองชั้น โครงการเดอะริเวอร์ไซด์';
const URL = 'https://app.contrack.co.th/s/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg';

const FULL_PAYLOAD = {
    buyerName: 'บริษัท สมชายก่อสร้างและพัฒนาที่ดิน จำกัด (มหาชน)',
    vendorName: 'ทีมช่างสมศักดิ์และเพื่อนช่างไฟฟ้า',
    fromName: 'สมศักดิ์ ใจดี',
    title: LONG,
    deadline: '30 ต.ค. 69 17:00',
    dueAt: '30 ต.ค. 70',
    total: '1,250,000 บาท',
    amount: '40,000 บาท',
    installmentNo: 2,
    result: 'pass_with_fixes',
    accepted: 'true',
    reason: 'ติดงานอื่น',
    url: URL,
    href: '/x',
};

describe('notification templates', () => {
    it('covers 20 subcontracting templates (40 with the ERP ones)', () => {
        expect(SC_NOTIFICATION_TEMPLATES).toHaveLength(20);
        expect(NOTIFICATION_TEMPLATES).toHaveLength(40);
    });

    it.each(SC_NOTIFICATION_TEMPLATES)('%s renders Thai title, body and a short text within 2 SMS segments ending with the link', template => {
        const out = renderNotification(template, FULL_PAYLOAD, URL);
        // English readers get the same Thai text in this phase.
        expect(renderNotification(template, FULL_PAYLOAD, URL, 'en')).toEqual(out);
        expect(out.title).not.toBe('');
        expect(out.body).not.toBe('');
        for (const text of [out.title, out.body, out.short]) {
            expect(text).toMatch(/[฀-๿]/);
            expect(text).not.toMatch(/undefined|null|\{\{/);
        }
        expect(out.short.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
        expect(out.short.endsWith(` ${URL}`)).toBe(true);
    });

    it.each(NOTIFICATION_TEMPLATES)('%s copes with an empty payload', template => {
        const out = renderNotification(template, {});
        expect(out.short).not.toMatch(/undefined/);
        expect(out.short.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
    });

    it('the SMS-worthy set is the five money / invitation messages', () => {
        expect([...SMS_WORTHY_TEMPLATES].sort()).toEqual(['sc.addendum', 'sc.claim_paid', 'sc.contract_to_accept', 'sc.invitation', 'sc.outcome_won']);
    });

    it('invitation wording', () => {
        const out = renderNotification('sc.invitation', { buyerName: 'บ. ก', title: 'งานฉาบ', deadline: '30 ต.ค. 69 17:00' }, 'https://a.b/s/t');
        expect(out.title).toBe('เชิญเสนอราคา: งานฉาบ');
        expect(out.body).toBe('บ. ก เชิญทีมของคุณเสนอราคางาน "งานฉาบ" ปิดรับราคา 30 ต.ค. 69 17:00');
        expect(out.short).toBe('บ. ก เชิญเสนอราคา งานฉาบ ปิดรับ 30 ต.ค. 69 17:00 https://a.b/s/t');
    });

    it('a decline / cancel reason is added when given', () => {
        expect(renderNotification('sc.declined', { vendorName: 'ก', title: 'ข', reason: 'ไม่ว่าง' }).body).toBe('ก ไม่ร่วมเสนอราคางาน "ข" เหตุผล: ไม่ว่าง');
        expect(renderNotification('sc.declined', { vendorName: 'ก', title: 'ข' }).body).toBe('ก ไม่ร่วมเสนอราคางาน "ข"');
    });

    it('inspection results and variation answers read in Thai', () => {
        expect(renderNotification('sc.inspection_result', { title: 'ก', installmentNo: 1, result: 'fail' }).body).toContain(': ไม่ผ่าน');
        expect(renderNotification('sc.variation_answered', { title: 'ก', amount: '1 บาท', accepted: 'false' }).body).toContain('ไม่ได้รับการอนุมัติ');
        expect(renderNotification('sc.variation_answered', { title: 'ก', amount: '1 บาท', accepted: 1 }).body).toContain('ได้รับการอนุมัติ');
    });

    it('line breaks in values do not reach the text', () => {
        expect(renderNotification('sc.message', { fromName: 'ก\nข', title: 'ค' }).title).toBe('ข้อความใหม่จาก ก ข');
    });

    describe('fitSms', () => {
        it('leaves a short text as it is', () => {
            expect(fitSms(['ก ', { flex: 'ข' }], 'https://x')).toBe('ก ข https://x');
        });

        it('shortens the longest value first, with an ellipsis', () => {
            const text = fitSms([{ flex: 'a'.repeat(100) }, ' - ', { flex: 'b'.repeat(20) }], undefined, 50);
            expect(text.length).toBe(50);
            expect(text).toMatch(/^a+… - b{20}$/);
        });

        it('keeps the link whole even when the fixed words are too long', () => {
            const text = fitSms(['x'.repeat(200)], 'https://link', 40);
            expect(text.length).toBeLessThanOrEqual(40);
            expect(text.endsWith(' https://link')).toBe(true);
        });
    });
});

describe('sc.bid_received', () => {
    it('names the vendor and the job but never the bid total', () => {
        const out = renderNotification('sc.bid_received', { vendorName: 'ทีมช่างสมศักดิ์', title: 'งานฉาบปูน', total: '125,000 บาท' }, 'https://a.b/p');
        expect(out.title).toBe('ได้รับใบเสนอราคา: งานฉาบปูน');
        expect(out.body).toBe('ทีมช่างสมศักดิ์ ส่งราคางาน "งานฉาบปูน" แล้ว');
        expect(out.short).toBe('ทีมช่างสมศักดิ์ ส่งราคางาน งานฉาบปูน แล้ว https://a.b/p');
        for (const text of [out.title, out.body, out.short]) expect(text).not.toMatch(/125,000|บาท/);
    });
});
