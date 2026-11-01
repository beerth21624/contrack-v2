// ─── Text of every notification template: in-app title/body and a short SMS / LINE text, in the recipient's language ───
// sc.*: Thai and English (TEMPLATES / TEMPLATES_EN). Payload keys per template: docs/marketplace/API-module1.md
// "Notifications". Values arrive already formatted for Thai readers (money `125,000 บาท`, dates `30 ต.ค. 69 17:00`);
// English readers get them converted (`THB 125,000`, `30 Oct 2026 17:00`); a missing key renders as an empty string.
// ERP templates (Thai + English, raw payload values): ./notification-templates.erp.ts.
import type { UserLocale } from '@contrack/contract';
import type { NotificationTemplate, ScNotificationTemplate } from '../../../../shared/application/ports';
import { ERP_NOTIFICATION_TEMPLATES, isErpTemplate, renderErpText } from './notification-templates.erp';

export type NotificationPayload = Readonly<Record<string, string | number>>;

/** Two concatenated UCS-2 SMS segments (Thai text): 2 × 67 characters. */
export const SMS_MAX_CHARS = 134;
/** A shortened value keeps at least this many characters (plus '…'). */
const MIN_FLEX_CHARS = 6;

/** Templates that also go by SMS to recipients with a phone (an explicit `toPhone` always gets one). */
export const SMS_WORTHY_TEMPLATES: ReadonlySet<NotificationTemplate> = new Set<NotificationTemplate>([
    'sc.invitation', 'sc.addendum', 'sc.outcome_won', 'sc.contract_to_accept', 'sc.claim_paid',
]);

export interface RenderedNotification {
    title: string;
    body: string;
    /** Short text for SMS / LINE (≤ SMS_MAX_CHARS), ending with the link when there is one. */
    short: string;
}

/** A piece of the SMS: fixed wording, or a value that may be shortened (names, titles) to fit two segments. */
type SmsPart = string | { flex: string };

interface TemplateText {
    title(v: Values): string;
    body(v: Values): string;
    sms(v: Values): SmsPart[];
}

/** Payload reader: every value as a single-line string ('' when missing). */
class Values {
    constructor(private readonly payload: NotificationPayload, private readonly locale: UserLocale = 'th') {}

    get(key: string): string {
        const raw = this.payload[key];
        if (raw === undefined) return '';
        const text = String(raw).replace(/\s+/g, ' ').trim();
        return this.locale === 'en' ? englishValue(text) : text;
    }

    /** ` เหตุผล: …` (English ` Reason: …`) when a reason was given. */
    reason(): string {
        const reason = this.get('reason');
        if (reason === '') return '';
        return this.locale === 'en' ? ` Reason: ${reason}` : ` เหตุผล: ${reason}`;
    }
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const ENGLISH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A payload value formatted for Thai readers, for English readers: `125,000 บาท` → `THB 125,000`, `30 ต.ค. 69` → `30 Oct 2026`. */
function englishValue(text: string): string {
    const money = /^(-?[\d,]+(?:\.\d+)?) บาท$/.exec(text);
    if (money !== null) return `THB ${money[1] ?? ''}`;
    return text.replace(/^(\d{1,2}) (\S+?) (\d{2})(?= |$)/, (whole: string, day: string, month: string, year: string) => {
        const at = THAI_MONTHS.indexOf(month);
        // Two-digit Buddhist year: 69 is 2569 BE, 2026 CE.
        return at < 0 ? whole : `${day} ${ENGLISH_MONTHS[at] ?? month} ${String(1957 + Number(year))}`;
    });
}

const flex = (text: string): SmsPart => ({ flex: text });

const ANSWER_YES = ['true', '1', 'yes'];
const ANSWER_NO = ['false', '0', 'no'];

const INSPECTION_RESULT: Record<string, string> = {
    pass: 'ผ่าน',
    pass_with_fixes: 'ผ่าน มีจุดต้องแก้ไข',
    fail: 'ไม่ผ่าน',
};

function inspectionResult(v: Values): string {
    const raw = v.get('result');
    return INSPECTION_RESULT[raw] ?? raw;
}

function answered(v: Values): string {
    const raw = v.get('accepted').toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'yes') return 'ได้รับการอนุมัติ';
    if (raw === 'false' || raw === '0' || raw === 'no') return 'ไม่ได้รับการอนุมัติ';
    return v.get('accepted');
}

const TEMPLATES: Record<ScNotificationTemplate, TemplateText> = {
    'sc.invitation': {
        title: v => `เชิญเสนอราคา: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} เชิญทีมของคุณเสนอราคางาน "${v.get('title')}" ปิดรับราคา ${v.get('deadline')}`,
        sms: v => [flex(v.get('buyerName')), ' เชิญเสนอราคา ', flex(v.get('title')), ` ปิดรับ ${v.get('deadline')}`],
    },
    'sc.addendum': {
        title: v => `มีการแก้ไขรายละเอียดงาน: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} แก้ไขรายละเอียดงาน "${v.get('title')}" กรุณาตรวจสอบก่อนเสนอราคา`,
        sms: v => [flex(v.get('buyerName')), ' แก้ไขรายละเอียดงาน ', flex(v.get('title')), ' โปรดตรวจสอบ'],
    },
    'sc.question_asked': {
        title: v => `มีคำถามใหม่: ${v.get('title')}`,
        body: v => `ผู้เสนอราคาส่งคำถามเกี่ยวกับงาน "${v.get('title')}" รอคุณตอบ`,
        sms: v => ['มีคำถามใหม่ งาน ', flex(v.get('title'))],
    },
    'sc.question_answered': {
        title: v => `ตอบคำถามแล้ว: ${v.get('title')}`,
        body: v => `ผู้ว่าจ้างตอบคำถามเกี่ยวกับงาน "${v.get('title')}" แล้ว`,
        sms: v => ['ผู้ว่าจ้างตอบคำถาม งาน ', flex(v.get('title'))],
    },
    'sc.deadline_soon': {
        title: v => `ใกล้ปิดรับราคา: ${v.get('title')}`,
        body: v => `งาน "${v.get('title')}" จะปิดรับราคา ${v.get('deadline')} คุณยังไม่ได้ส่งราคา`,
        sms: v => ['งาน ', flex(v.get('title')), ` ปิดรับราคา ${v.get('deadline')} ยังไม่ได้ส่งราคา`],
    },
    'sc.outcome_won': {
        title: v => `คุณได้รับงาน: ${v.get('title')}`,
        body: v => `ยินดีด้วย ${v.get('buyerName')} เลือกใบเสนอราคาของคุณสำหรับงาน "${v.get('title')}"`,
        sms: v => ['ยินดีด้วย ', flex(v.get('buyerName')), ' เลือกคุณทำงาน ', flex(v.get('title'))],
    },
    'sc.outcome_lost': {
        title: v => `ผลการเสนอราคา: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} เลือกผู้เสนอราคารายอื่นสำหรับงาน "${v.get('title')}" ขอบคุณที่ร่วมเสนอราคา`,
        sms: v => [flex(v.get('buyerName')), ' เลือกผู้เสนอราคารายอื่น งาน ', flex(v.get('title')), ' ขอบคุณที่ร่วมเสนอราคา'],
    },
    'sc.package_cancelled': {
        title: v => `ยกเลิกงาน: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} ยกเลิกการหาผู้รับเหมาช่วงงาน "${v.get('title')}"${v.reason()}`,
        sms: v => [flex(v.get('buyerName')), ' ยกเลิกงาน ', flex(v.get('title'))],
    },
    'sc.contract_to_accept': {
        title: v => `สัญญารอคุณยืนยัน: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} ส่งสัญญางาน "${v.get('title')}" มูลค่า ${v.get('total')} กรุณาตรวจสอบและยืนยัน`,
        sms: v => [flex(v.get('buyerName')), ' ส่งสัญญางาน ', flex(v.get('title')), ` ${v.get('total')} รอคุณยืนยัน`],
    },
    'sc.inspection_result': {
        title: v => `ผลตรวจงานงวดที่ ${v.get('installmentNo')}: ${v.get('title')}`,
        body: v => `ผลตรวจงานงวดที่ ${v.get('installmentNo')} ของงาน "${v.get('title')}": ${inspectionResult(v)}`,
        sms: v => [`ผลตรวจงวด ${v.get('installmentNo')} งาน `, flex(v.get('title')), `: ${inspectionResult(v)}`],
    },
    'sc.claim_paid': {
        title: v => `ได้รับเงินงวดที่ ${v.get('installmentNo')}: ${v.get('title')}`,
        body: v => `ผู้ว่าจ้างจ่ายเงินงวดที่ ${v.get('installmentNo')} ของงาน "${v.get('title')}" จำนวน ${v.get('amount')} แล้ว`,
        sms: v => [`จ่ายเงินงวด ${v.get('installmentNo')} งาน `, flex(v.get('title')), ` ${v.get('amount')} แล้ว`],
    },
    'sc.retention_due': {
        title: v => `ครบกำหนดคืนเงินประกันผลงาน: ${v.get('title')}`,
        body: v => `เงินประกันผลงานของงาน "${v.get('title')}" จำนวน ${v.get('amount')} ครบกำหนดคืน ${v.get('dueAt')}`,
        sms: v => ['เงินประกันผลงาน งาน ', flex(v.get('title')), ` ${v.get('amount')} ครบกำหนดคืน ${v.get('dueAt')}`],
    },
    'sc.variation_proposed': {
        title: v => `เสนองานเพิ่ม-ลด: ${v.get('title')}`,
        body: v => `มีการเสนองานเพิ่ม-ลดของงาน "${v.get('title')}" มูลค่า ${v.get('amount')} รอคุณพิจารณา`,
        sms: v => ['เสนองานเพิ่ม-ลด งาน ', flex(v.get('title')), ` ${v.get('amount')} รอพิจารณา`],
    },
    'sc.variation_answered': {
        title: v => `ผลงานเพิ่ม-ลด: ${v.get('title')}`,
        body: v => `งานเพิ่ม-ลดของงาน "${v.get('title')}" มูลค่า ${v.get('amount')} ${answered(v)}`,
        sms: v => ['งานเพิ่ม-ลด งาน ', flex(v.get('title')), ` ${v.get('amount')} ${answered(v)}`],
    },
    'sc.message': {
        title: v => `ข้อความใหม่จาก ${v.get('fromName')}`,
        body: v => `${v.get('fromName')} ส่งข้อความถึงคุณเรื่องงาน "${v.get('title')}"`,
        sms: v => ['ข้อความใหม่จาก ', flex(v.get('fromName')), ' งาน ', flex(v.get('title'))],
    },
    'sc.bid_received': {
        title: v => `ได้รับใบเสนอราคา: ${v.get('title')}`,
        // No amount (a `total` in the payload is ignored): bid prices belong on the leveling screen, not in the bell /
        // SMS / LINE, which other members and lock screens see.
        body: v => `${v.get('vendorName')} ส่งราคางาน "${v.get('title')}" แล้ว`,
        sms: v => [flex(v.get('vendorName')), ' ส่งราคางาน ', flex(v.get('title')), ' แล้ว'],
    },
    'sc.declined': {
        title: v => `ไม่ร่วมเสนอราคา: ${v.get('title')}`,
        body: v => `${v.get('vendorName')} ไม่ร่วมเสนอราคางาน "${v.get('title')}"${v.reason()}`,
        sms: v => [flex(v.get('vendorName')), ' ไม่ร่วมเสนอราคางาน ', flex(v.get('title'))],
    },
    'sc.contract_accepted': {
        title: v => `ยืนยันสัญญาแล้ว: ${v.get('title')}`,
        body: v => `${v.get('vendorName')} ยืนยันสัญญางาน "${v.get('title')}" แล้ว เริ่มงานได้ตามสัญญา`,
        sms: v => [flex(v.get('vendorName')), ' ยืนยันสัญญางาน ', flex(v.get('title')), ' แล้ว'],
    },
    'sc.change_requested': {
        title: v => `ขอแก้ไขสัญญา: ${v.get('title')}`,
        body: v => `${v.get('vendorName')} ขอแก้ไขสัญญางาน "${v.get('title')}" กรุณาตรวจสอบ`,
        sms: v => [flex(v.get('vendorName')), ' ขอแก้ไขสัญญางาน ', flex(v.get('title'))],
    },
    'sc.claim_requested': {
        title: v => `ขอเบิกเงินงวดที่ ${v.get('installmentNo')}: ${v.get('title')}`,
        body: v => `${v.get('vendorName')} ขอเบิกเงินงวดที่ ${v.get('installmentNo')} ของงาน "${v.get('title')}" กรุณานัดตรวจงาน`,
        sms: v => [flex(v.get('vendorName')), ` ขอเบิกงวด ${v.get('installmentNo')} งาน `, flex(v.get('title'))],
    },
};

const INSPECTION_RESULT_EN: Record<string, string> = {
    pass: 'Passed',
    pass_with_fixes: 'Passed with items to fix',
    fail: 'Failed',
};

const TEMPLATES_EN: Record<ScNotificationTemplate, TemplateText> = {
    'sc.invitation': {
        title: v => `Invitation to bid: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} invites your team to bid on "${v.get('title')}". Bids close ${v.get('deadline')}`,
        sms: v => [flex(v.get('buyerName')), ' invites you to bid on ', flex(v.get('title')), `. Closes ${v.get('deadline')}`],
    },
    'sc.addendum': {
        title: v => `Job details changed: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} changed the details of "${v.get('title')}". Please review before bidding`,
        sms: v => [flex(v.get('buyerName')), ' changed the details of ', flex(v.get('title')), '. Please review'],
    },
    'sc.question_asked': {
        title: v => `New question: ${v.get('title')}`,
        body: v => `A bidder asked a question about "${v.get('title')}". It is waiting for your answer`,
        sms: v => ['New question on ', flex(v.get('title'))],
    },
    'sc.question_answered': {
        title: v => `Question answered: ${v.get('title')}`,
        body: v => `The buyer answered a question about "${v.get('title')}"`,
        sms: v => ['Buyer answered a question on ', flex(v.get('title'))],
    },
    'sc.deadline_soon': {
        title: v => `Bids closing soon: ${v.get('title')}`,
        body: v => `Bids for "${v.get('title')}" close ${v.get('deadline')}. You have not sent a price yet`,
        sms: v => ['Bids for ', flex(v.get('title')), ` close ${v.get('deadline')}. No price sent yet`],
    },
    'sc.outcome_won': {
        title: v => `You won the job: ${v.get('title')}`,
        body: v => `Congratulations, ${v.get('buyerName')} chose your bid for "${v.get('title')}"`,
        sms: v => ['Congratulations, ', flex(v.get('buyerName')), ' chose you for ', flex(v.get('title'))],
    },
    'sc.outcome_lost': {
        title: v => `Bid result: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} chose another bidder for "${v.get('title')}". Thank you for bidding`,
        sms: v => [flex(v.get('buyerName')), ' chose another bidder for ', flex(v.get('title')), '. Thank you for bidding'],
    },
    'sc.package_cancelled': {
        title: v => `Job cancelled: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} cancelled the search for a subcontractor for "${v.get('title')}".${v.reason()}`,
        sms: v => [flex(v.get('buyerName')), ' cancelled ', flex(v.get('title'))],
    },
    'sc.contract_to_accept': {
        title: v => `Contract waiting for you: ${v.get('title')}`,
        body: v => `${v.get('buyerName')} sent the contract for "${v.get('title')}" worth ${v.get('total')}. Please review and accept`,
        sms: v => [flex(v.get('buyerName')), ' sent the contract for ', flex(v.get('title')), ` ${v.get('total')}. Please accept`],
    },
    'sc.inspection_result': {
        title: v => `Inspection result, installment ${v.get('installmentNo')}: ${v.get('title')}`,
        body: v => `Inspection result of installment ${v.get('installmentNo')} for "${v.get('title')}": ${inspectionResultEn(v)}`,
        sms: v => [`Installment ${v.get('installmentNo')} inspection, `, flex(v.get('title')), `: ${inspectionResultEn(v)}`],
    },
    'sc.claim_paid': {
        title: v => `Installment ${v.get('installmentNo')} paid: ${v.get('title')}`,
        body: v => `The buyer paid installment ${v.get('installmentNo')} of "${v.get('title')}", ${v.get('amount')}`,
        sms: v => [`Installment ${v.get('installmentNo')} paid, `, flex(v.get('title')), ` ${v.get('amount')}`],
    },
    'sc.retention_due': {
        title: v => `Retention due for release: ${v.get('title')}`,
        body: v => `Retention of ${v.get('amount')} on "${v.get('title')}" is due for release on ${v.get('dueAt')}`,
        sms: v => ['Retention on ', flex(v.get('title')), ` ${v.get('amount')} due ${v.get('dueAt')}`],
    },
    'sc.variation_proposed': {
        title: v => `Variation proposed: ${v.get('title')}`,
        body: v => `A variation of ${v.get('amount')} was proposed on "${v.get('title')}" and is waiting for your decision`,
        sms: v => ['Variation on ', flex(v.get('title')), ` ${v.get('amount')} awaits your decision`],
    },
    'sc.variation_answered': {
        title: v => `Variation result: ${v.get('title')}`,
        body: v => `The variation of ${v.get('amount')} on "${v.get('title')}" was ${answeredEn(v)}`,
        sms: v => ['Variation on ', flex(v.get('title')), ` ${v.get('amount')} ${answeredEn(v)}`],
    },
    'sc.message': {
        title: v => `New message from ${v.get('fromName')}`,
        body: v => `${v.get('fromName')} sent you a message about "${v.get('title')}"`,
        sms: v => ['New message from ', flex(v.get('fromName')), ' about ', flex(v.get('title'))],
    },
    'sc.bid_received': {
        title: v => `Bid received: ${v.get('title')}`,
        // No amount (see the Thai text above).
        body: v => `${v.get('vendorName')} sent a price for "${v.get('title')}"`,
        sms: v => [flex(v.get('vendorName')), ' sent a price for ', flex(v.get('title'))],
    },
    'sc.declined': {
        title: v => `Declined to bid: ${v.get('title')}`,
        body: v => `${v.get('vendorName')} will not bid on "${v.get('title')}".${v.reason()}`,
        sms: v => [flex(v.get('vendorName')), ' will not bid on ', flex(v.get('title'))],
    },
    'sc.contract_accepted': {
        title: v => `Contract accepted: ${v.get('title')}`,
        body: v => `${v.get('vendorName')} accepted the contract for "${v.get('title')}". Work can start as agreed`,
        sms: v => [flex(v.get('vendorName')), ' accepted the contract for ', flex(v.get('title'))],
    },
    'sc.change_requested': {
        title: v => `Contract change requested: ${v.get('title')}`,
        body: v => `${v.get('vendorName')} asked for changes to the contract for "${v.get('title')}". Please review`,
        sms: v => [flex(v.get('vendorName')), ' asked to change the contract for ', flex(v.get('title'))],
    },
    'sc.claim_requested': {
        title: v => `Claim for installment ${v.get('installmentNo')}: ${v.get('title')}`,
        body: v => `${v.get('vendorName')} claimed installment ${v.get('installmentNo')} of "${v.get('title')}". Please arrange an inspection`,
        sms: v => [flex(v.get('vendorName')), ` claimed installment ${v.get('installmentNo')} of `, flex(v.get('title'))],
    },
};

function inspectionResultEn(v: Values): string {
    const raw = v.get('result');
    return INSPECTION_RESULT_EN[raw] ?? raw;
}

function answeredEn(v: Values): string {
    const raw = v.get('accepted').toLowerCase();
    if (ANSWER_YES.includes(raw)) return 'approved';
    if (ANSWER_NO.includes(raw)) return 'not approved';
    return v.get('accepted');
}

function shorten(text: string, length: number): string {
    return text.length <= length ? text : `${text.slice(0, Math.max(0, length - 1))}…`;
}

/** Joins the parts, shortening the longest flexible value first, until the text (with the link) fits `max`. */
export function fitSms(parts: readonly SmsPart[], url: string | undefined, max = SMS_MAX_CHARS): string {
    const tail = url === undefined || url === '' ? '' : ` ${url}`;
    const texts = parts.map(p => (typeof p === 'string' ? p : p.flex));
    const flexible = parts.map(p => typeof p !== 'string');
    const total = (): number => texts.reduce((n, t) => n + t.length, 0) + tail.length;
    for (;;) {
        const overflow = total() - max;
        if (overflow <= 0) break;
        let longest = -1;
        for (let i = 0; i < texts.length; i += 1) {
            const len = texts[i]?.length ?? 0;
            if (flexible[i] === true && len > MIN_FLEX_CHARS + 1 && (longest < 0 || len > (texts[longest]?.length ?? 0))) longest = i;
        }
        if (longest < 0) break;
        const current = texts[longest] ?? '';
        texts[longest] = shorten(current, Math.max(MIN_FLEX_CHARS + 1, current.length - overflow));
    }
    const text = texts.join('').replace(/\s+/g, ' ').trim();
    // Last resort (a very long link or fixed wording): cut the words, keep the link whole.
    const room = max - tail.length;
    return `${room > 0 && text.length > room ? shorten(text, room) : text}${tail}`;
}

/**
 * Title, body and short text of a template in `locale` (sc.* in Thai or English). `url` (absolute) ends
 * the short text when given.
 */
export function renderNotification(
    template: NotificationTemplate, payload: NotificationPayload, url?: string, locale: UserLocale = 'th',
): RenderedNotification {
    if (isErpTemplate(template)) {
        const { title, body } = renderErpText(template, payload, locale);
        return { title, body, short: fitSms([flex(title)], url) };
    }
    const values = new Values(payload, locale);
    const text = (locale === 'en' ? TEMPLATES_EN : TEMPLATES)[template];
    return {
        title: text.title(values).trim(),
        body: text.body(values).trim(),
        short: fitSms(text.sms(values), url),
    };
}

export const SC_NOTIFICATION_TEMPLATES = Object.keys(TEMPLATES) as ScNotificationTemplate[];
export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [...SC_NOTIFICATION_TEMPLATES, ...ERP_NOTIFICATION_TEMPLATES];
