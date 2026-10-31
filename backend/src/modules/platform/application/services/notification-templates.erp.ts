// ─── Thai and English text of the ERP notification templates (docs/erp/01-architecture.md §7) ───
// Payloads carry raw values; this file formats them in the recipient's language (notification-format.ts). A missing
// key renders as ''. Keys per template (all optional strings unless noted; `href` / `url` are the link as for sc.*):
//   approval.requested         subject (ApprovalSubject), title, amount (number), requesterName
//   approval.decided           subject, title, decision ('approved' | 'rejected'), deciderName, note
//   quotation.viewed           docNumber, customerName, projectName
//   quotation.accepted         docNumber, customerName, amount
//   quotation.change_requested docNumber, customerName, note
//   variation.accepted         docNumber, title, customerName, amount
//   variation.rejected         docNumber, title, customerName, note
//   invoice.due_soon           docNumber, customerName, amount, date (due date)
//   invoice.overdue            docNumber, customerName, amount, date (due date), days (number, days overdue)
//   retention.release_due      projectName, title, amount, date
//   guarantee.expiring         title (guarantee), projectName, date
//   purchase_order.issued      docNumber, supplierName, amount, projectName
//   goods.short_delivery       docNumber, supplierName, projectName
//   cost.overrun               projectName, title (cost code), amount (over budget by)
//   cash.negative_forecast     projectName, date (first negative day), amount (lowest balance)
//   warranty.claim_opened      projectName, title
//   warranty.expiring          projectName, date
//   trial.expiring             module (ModuleId), date (last day of the trial)
//   pay_period.ready           projectName, title (period), amount
//   supplier_bill.due_soon     docNumber, supplierName, amount, date (due date)
import { APPROVAL_SUBJECTS, type ApprovalSubject, MODULE_IDS, MODULE_LABEL, type ModuleId, type UserLocale } from '@contrack/contract';
import type { ErpNotificationTemplate } from '../../../../shared/application/ports';
import { formatNotificationCount, formatNotificationDate, formatNotificationMoney } from './notification-format';

export type ErpPayload = Readonly<Record<string, string | number>>;

const SUBJECT_LABEL: Record<UserLocale, Record<ApprovalSubject, string>> = {
    th: {
        'quotation.issue': 'ออกใบเสนอราคา',
        'claim.submit': 'ส่งใบเบิกงวด',
        'variation.submit': 'ส่งงานเพิ่ม-ลด (VO)',
        'purchase_request.approve': 'ใบขอซื้อ (PR)',
        'purchase_order.issue': 'ออกใบสั่งซื้อ (PO)',
        'supplier_bill.approve': 'บิลผู้ขาย',
        'payment_run.approve': 'รอบจ่ายเงิน',
        'timesheet.approve': 'ใบลงเวลา',
        'pay_period.approve': 'งวดค่าแรง',
    },
    en: {
        'quotation.issue': 'Issue quotation',
        'claim.submit': 'Submit progress claim',
        'variation.submit': 'Submit variation order',
        'purchase_request.approve': 'Purchase request',
        'purchase_order.issue': 'Issue purchase order',
        'supplier_bill.approve': 'Supplier bill',
        'payment_run.approve': 'Payment run',
        'timesheet.approve': 'Timesheet',
        'pay_period.approve': 'Pay period',
    },
};

const MODULE_LABEL_EN: Record<ModuleId, string> = {
    subcontracting: 'Subcontracting (find subcontractors)',
    materials: 'Material price requests',
    'owner-leads': 'Owners looking for contractors',
    'ai-assist': 'AI assistant (BOQ review, item matching)',
    workforce: 'Crews and staffing',
    'project-hub': 'Project hub',
    portal: 'Role-based home',
    'boq-control': 'BOQ history and baseline',
    quotations: 'Quotations',
    contracts: 'Main contracts and milestones',
    billing: 'Billing and receipts',
    variations: 'Variation orders',
    procurement: 'Procurement',
    'site-diary': 'Daily site reports',
    labour: 'Daily labour',
    'job-cost': 'Job costing',
    payables: 'Payables and payments',
    handover: 'Handover and warranty',
};

const SUBJECTS = new Set<string>(APPROVAL_SUBJECTS);
const MODULES = new Set<string>(MODULE_IDS);

/** Payload reader in one language. */
class ErpValues {
    constructor(private readonly payload: ErpPayload, readonly locale: UserLocale) {}

    get(key: string): string {
        const raw = this.payload[key];
        if (raw === undefined) return '';
        return String(raw).replace(/\s+/g, ' ').trim();
    }

    money(key = 'amount'): string {
        return formatNotificationMoney(this.payload[key], this.locale);
    }

    date(key = 'date'): string {
        return formatNotificationDate(this.payload[key], this.locale);
    }

    count(key: string): string {
        return formatNotificationCount(this.payload[key]);
    }

    subject(): string {
        const raw = this.get('subject');
        return SUBJECTS.has(raw) ? SUBJECT_LABEL[this.locale][raw as ApprovalSubject] : raw;
    }

    module(): string {
        const raw = this.get('module');
        if (!MODULES.has(raw)) return raw;
        return this.locale === 'th' ? MODULE_LABEL[raw as ModuleId] : MODULE_LABEL_EN[raw as ModuleId];
    }

    /** `prefix + value + suffix` when the value is not empty, else ''. */
    opt(value: string, prefix: string, suffix = ''): string {
        return value === '' ? '' : `${prefix}${value}${suffix}`;
    }
}

interface ErpText {
    title(v: ErpValues): string;
    body(v: ErpValues): string;
}

type ErpTemplate = Record<UserLocale, ErpText>;

const TEMPLATES: Record<ErpNotificationTemplate, ErpTemplate> = {
    'approval.requested': {
        th: {
            title: v => `รออนุมัติ: ${v.subject()} ${v.get('title')}`,
            body: v => `${v.opt(v.get('requesterName'), '', ' ')}ขออนุมัติ${v.subject()} "${v.get('title')}"${v.opt(v.money(), ' มูลค่า ')} รอคุณพิจารณา`,
        },
        en: {
            title: v => `Approval needed: ${v.subject()} ${v.get('title')}`,
            body: v => `${v.get('requesterName') === '' ? 'Someone' : v.get('requesterName')} asked for approval: ${v.subject()} "${v.get('title')}"${v.opt(v.money(), ', ')}. Waiting for your decision.`,
        },
    },
    'approval.decided': {
        th: {
            title: v => `${v.get('decision') === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'}: ${v.subject()} ${v.get('title')}`,
            body: v => `${v.opt(v.get('deciderName'), '', ' ')}${v.get('decision') === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'}${v.subject()} "${v.get('title')}"${v.opt(v.get('note'), ' หมายเหตุ: ')}`,
        },
        en: {
            title: v => `${v.get('decision') === 'approved' ? 'Approved' : 'Rejected'}: ${v.subject()} ${v.get('title')}`,
            body: v => `${v.get('deciderName') === '' ? 'An approver' : v.get('deciderName')} ${v.get('decision') === 'approved' ? 'approved' : 'rejected'} ${v.subject()} "${v.get('title')}"${v.opt(v.get('note'), '. Note: ')}`,
        },
    },
    'quotation.viewed': {
        th: {
            title: v => `ลูกค้าเปิดดูใบเสนอราคา ${v.get('docNumber')}`,
            body: v => `${v.get('customerName') === '' ? 'ลูกค้า' : v.get('customerName')} เปิดดูใบเสนอราคา ${v.get('docNumber')}${v.opt(v.get('projectName'), ' โครงการ ')}`,
        },
        en: {
            title: v => `Quotation ${v.get('docNumber')} was viewed`,
            body: v => `${v.get('customerName') === '' ? 'The customer' : v.get('customerName')} opened quotation ${v.get('docNumber')}${v.opt(v.get('projectName'), ' for ')}`,
        },
    },
    'quotation.accepted': {
        th: {
            title: v => `ลูกค้ายอมรับใบเสนอราคา ${v.get('docNumber')}`,
            body: v => `${v.get('customerName') === '' ? 'ลูกค้า' : v.get('customerName')} ยอมรับใบเสนอราคา ${v.get('docNumber')}${v.opt(v.money(), ' มูลค่า ')}`,
        },
        en: {
            title: v => `Quotation ${v.get('docNumber')} accepted`,
            body: v => `${v.get('customerName') === '' ? 'The customer' : v.get('customerName')} accepted quotation ${v.get('docNumber')}${v.opt(v.money(), ' (', ')')}`,
        },
    },
    'quotation.change_requested': {
        th: {
            title: v => `ลูกค้าขอแก้ไขใบเสนอราคา ${v.get('docNumber')}`,
            body: v => `${v.get('customerName') === '' ? 'ลูกค้า' : v.get('customerName')} ขอแก้ไขใบเสนอราคา ${v.get('docNumber')}${v.opt(v.get('note'), ': ')}`,
        },
        en: {
            title: v => `Changes requested on quotation ${v.get('docNumber')}`,
            body: v => `${v.get('customerName') === '' ? 'The customer' : v.get('customerName')} asked for changes to quotation ${v.get('docNumber')}${v.opt(v.get('note'), ': ')}`,
        },
    },
    'variation.accepted': {
        th: {
            title: v => `ลูกค้าอนุมัติงานเพิ่ม-ลด ${v.get('docNumber')}`,
            body: v => `${v.get('customerName') === '' ? 'ลูกค้า' : v.get('customerName')} อนุมัติงานเพิ่ม-ลด ${v.get('docNumber')}${v.opt(v.get('title'), ' "', '"')}${v.opt(v.money(), ' มูลค่า ')}`,
        },
        en: {
            title: v => `Variation ${v.get('docNumber')} accepted`,
            body: v => `${v.get('customerName') === '' ? 'The customer' : v.get('customerName')} accepted variation ${v.get('docNumber')}${v.opt(v.get('title'), ' "', '"')}${v.opt(v.money(), ' (', ')')}`,
        },
    },
    'variation.rejected': {
        th: {
            title: v => `ลูกค้าไม่อนุมัติงานเพิ่ม-ลด ${v.get('docNumber')}`,
            body: v => `${v.get('customerName') === '' ? 'ลูกค้า' : v.get('customerName')} ไม่อนุมัติงานเพิ่ม-ลด ${v.get('docNumber')}${v.opt(v.get('title'), ' "', '"')}${v.opt(v.get('note'), ' เหตุผล: ')}`,
        },
        en: {
            title: v => `Variation ${v.get('docNumber')} rejected`,
            body: v => `${v.get('customerName') === '' ? 'The customer' : v.get('customerName')} rejected variation ${v.get('docNumber')}${v.opt(v.get('title'), ' "', '"')}${v.opt(v.get('note'), '. Reason: ')}`,
        },
    },
    'invoice.due_soon': {
        th: {
            title: v => `ใบแจ้งหนี้ใกล้ครบกำหนด: ${v.get('docNumber')}`,
            body: v => `ใบแจ้งหนี้ ${v.get('docNumber')}${v.opt(v.get('customerName'), ' ของ ')}${v.opt(v.money(), ' ยอด ')} ครบกำหนดชำระ ${v.date()}`,
        },
        en: {
            title: v => `Invoice due soon: ${v.get('docNumber')}`,
            body: v => `Invoice ${v.get('docNumber')}${v.opt(v.get('customerName'), ' to ')}${v.opt(v.money(), ' for ')} is due on ${v.date()}`,
        },
    },
    'invoice.overdue': {
        th: {
            title: v => `ใบแจ้งหนี้เกินกำหนด: ${v.get('docNumber')}`,
            body: v => `ใบแจ้งหนี้ ${v.get('docNumber')}${v.opt(v.get('customerName'), ' ของ ')}${v.opt(v.money(), ' ยอด ')} เกินกำหนดชำระ${v.opt(v.count('days'), ' ', ' วัน')} (ครบกำหนด ${v.date()})`,
        },
        en: {
            title: v => `Invoice overdue: ${v.get('docNumber')}`,
            body: v => `Invoice ${v.get('docNumber')}${v.opt(v.get('customerName'), ' to ')}${v.opt(v.money(), ' for ')} is overdue${v.opt(v.count('days'), ' by ', ' days')} (due ${v.date()})`,
        },
    },
    'retention.release_due': {
        th: {
            title: v => `ครบกำหนดคืนเงินประกันผลงาน: ${v.get('projectName')}`,
            body: v => `เงินประกันผลงาน${v.opt(v.get('title'), ' ')}${v.opt(v.get('projectName'), ' โครงการ ')}${v.opt(v.money(), ' จำนวน ')} ครบกำหนดคืน ${v.date()}`,
        },
        en: {
            title: v => `Retention release due: ${v.get('projectName')}`,
            body: v => `Retention${v.opt(v.get('title'), ' ')}${v.opt(v.get('projectName'), ' on ')}${v.opt(v.money(), ' of ')} is due for release on ${v.date()}`,
        },
    },
    'guarantee.expiring': {
        th: {
            title: v => `หนังสือค้ำประกันใกล้หมดอายุ: ${v.get('title')}`,
            body: v => `หนังสือค้ำประกัน ${v.get('title')}${v.opt(v.get('projectName'), ' โครงการ ')} หมดอายุ ${v.date()}`,
        },
        en: {
            title: v => `Guarantee expiring: ${v.get('title')}`,
            body: v => `Guarantee ${v.get('title')}${v.opt(v.get('projectName'), ' on ')} expires on ${v.date()}`,
        },
    },
    'purchase_order.issued': {
        th: {
            title: v => `ออกใบสั่งซื้อแล้ว: ${v.get('docNumber')}`,
            body: v => `ออกใบสั่งซื้อ ${v.get('docNumber')}${v.opt(v.get('supplierName'), ' ถึง ')}${v.opt(v.money(), ' มูลค่า ')}${v.opt(v.get('projectName'), ' โครงการ ')}`,
        },
        en: {
            title: v => `Purchase order issued: ${v.get('docNumber')}`,
            body: v => `Purchase order ${v.get('docNumber')} was issued${v.opt(v.get('supplierName'), ' to ')}${v.opt(v.money(), ' for ')}${v.opt(v.get('projectName'), ' on ')}`,
        },
    },
    'goods.short_delivery': {
        th: {
            title: v => `ของส่งไม่ครบ: ${v.get('docNumber')}`,
            body: v => `รับของตามใบสั่งซื้อ ${v.get('docNumber')}${v.opt(v.get('supplierName'), ' จาก ')} ได้ไม่ครบ${v.opt(v.get('projectName'), ' โครงการ ')}`,
        },
        en: {
            title: v => `Short delivery: ${v.get('docNumber')}`,
            body: v => `Goods received for purchase order ${v.get('docNumber')}${v.opt(v.get('supplierName'), ' from ')} are short${v.opt(v.get('projectName'), ' on ')}`,
        },
    },
    'cost.overrun': {
        th: {
            title: v => `ต้นทุนเกินงบ: ${v.get('projectName')}`,
            body: v => `ต้นทุน${v.opt(v.get('title'), ' ')}${v.opt(v.get('projectName'), ' โครงการ ')} เกินงบ${v.opt(v.money(), ' ')}`,
        },
        en: {
            title: v => `Cost over budget: ${v.get('projectName')}`,
            body: v => `Cost${v.opt(v.get('title'), ' of ')}${v.opt(v.get('projectName'), ' on ')} is over budget${v.opt(v.money(), ' by ')}`,
        },
    },
    'cash.negative_forecast': {
        th: {
            title: v => `คาดว่าเงินสดติดลบ: ${v.get('projectName')}`,
            body: v => `กระแสเงินสด${v.opt(v.get('projectName'), 'โครงการ ')} คาดว่าจะติดลบตั้งแต่ ${v.date()}${v.opt(v.money(), ' ต่ำสุด ')}`,
        },
        en: {
            title: v => `Cash forecast turns negative: ${v.get('projectName')}`,
            body: v => `The cash forecast${v.opt(v.get('projectName'), ' of ')} turns negative from ${v.date()}${v.opt(v.money(), ', lowest ')}`,
        },
    },
    'warranty.claim_opened': {
        th: {
            title: v => `แจ้งซ่อมในประกัน: ${v.get('projectName')}`,
            body: v => `มีการแจ้งซ่อมในระยะประกัน${v.opt(v.get('projectName'), ' โครงการ ')}${v.opt(v.get('title'), ': ')}`,
        },
        en: {
            title: v => `Warranty claim opened: ${v.get('projectName')}`,
            body: v => `A warranty claim was opened${v.opt(v.get('projectName'), ' on ')}${v.opt(v.get('title'), ': ')}`,
        },
    },
    'warranty.expiring': {
        th: {
            title: v => `ระยะประกันใกล้หมด: ${v.get('projectName')}`,
            body: v => `ระยะประกันผลงาน${v.opt(v.get('projectName'), 'โครงการ ')} สิ้นสุด ${v.date()}`,
        },
        en: {
            title: v => `Warranty ending: ${v.get('projectName')}`,
            body: v => `The warranty period${v.opt(v.get('projectName'), ' of ')} ends on ${v.date()}`,
        },
    },
    'trial.expiring': {
        th: {
            title: v => `ทดลองใช้ใกล้หมด: ${v.module()}`,
            body: v => `การทดลองใช้โมดูล ${v.module()} จะสิ้นสุดวันที่ ${v.date()} ติดต่อเราเพื่อใช้งานต่อ`,
        },
        en: {
            title: v => `Trial ending soon: ${v.module()}`,
            body: v => `Your trial of ${v.module()} ends on ${v.date()}. Contact us to keep using it.`,
        },
    },
    'pay_period.ready': {
        th: {
            title: v => `งวดค่าแรงพร้อมจ่าย: ${v.get('title')}`,
            body: v => `งวดค่าแรง ${v.get('title')}${v.opt(v.get('projectName'), ' โครงการ ')} พร้อมจ่าย${v.opt(v.money(), ' ยอด ')}`,
        },
        en: {
            title: v => `Pay period ready: ${v.get('title')}`,
            body: v => `Pay period ${v.get('title')}${v.opt(v.get('projectName'), ' on ')} is ready to pay${v.opt(v.money(), ': ')}`,
        },
    },
    'supplier_bill.due_soon': {
        th: {
            title: v => `บิลผู้ขายใกล้ครบกำหนด: ${v.get('docNumber')}`,
            body: v => `บิล ${v.get('docNumber')}${v.opt(v.get('supplierName'), ' ของ ')}${v.opt(v.money(), ' ยอด ')} ครบกำหนดจ่าย ${v.date()}`,
        },
        en: {
            title: v => `Supplier bill due soon: ${v.get('docNumber')}`,
            body: v => `Bill ${v.get('docNumber')}${v.opt(v.get('supplierName'), ' from ')}${v.opt(v.money(), ' for ')} is due on ${v.date()}`,
        },
    },
};

export const ERP_NOTIFICATION_TEMPLATES = Object.keys(TEMPLATES) as ErpNotificationTemplate[];

export function isErpTemplate(template: string): template is ErpNotificationTemplate {
    return Object.hasOwn(TEMPLATES, template);
}

/** Title and body of an ERP template in `locale` (whitespace collapsed). */
export function renderErpText(template: ErpNotificationTemplate, payload: ErpPayload, locale: UserLocale): { title: string; body: string } {
    const text = TEMPLATES[template][locale];
    const values = new ErpValues(payload, locale);
    const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();
    return { title: clean(text.title(values)), body: clean(text.body(values)) };
}
