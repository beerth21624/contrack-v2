// ─── Main contract document (with the project owner): built-in Thai / English templates and {{placeholder}} rendering ───
// The contract keeps its body as sanitized HTML with placeholders (`mc_contracts.body_th` / `body_en`, editable while
// draft); printing fills the placeholders from the contract (number, dates, value, milestones, terms). Pure.
import { amountInWordsEn } from '../money/amount-in-words';
import { formatContractDate, formatContractMoney, thaiBahtText } from '../subcontracting/contract-template';
import { escapeHtmlText, sanitizeDocumentHtml } from './html-sanitize';

export type MainContractLanguage = 'th' | 'en';

export interface MainContractTemplateMilestone {
    no: number;
    label: string;
    kind: 'advance' | 'work' | 'final';
    pct: number;
    amount: number;
}

export interface MainContractTemplateData {
    language: MainContractLanguage;
    contractNo: string;
    /** YYYY-MM-DD or null (not signed yet). */
    signDate: string | null;
    companyName: string;
    customerName: string;
    projectName: string;
    siteAddress: string;
    title: string;
    /** Contract value without VAT. */
    value: number;
    vatRate: number;
    startDate: string | null;
    finishDate: string | null;
    durationDays: number | null;
    milestones: readonly MainContractTemplateMilestone[];
    advancePct: number;
    retentionPct: number;
    penaltyRatePerDay: number;
    penaltyCapPct: number;
    warrantyMonths: number;
    guaranteePct: number;
    paymentTermDays: number;
}

export const MAIN_CONTRACT_PLACEHOLDERS = [
    'contractNo', 'date', 'companyName', 'customerName', 'projectName', 'siteAddress', 'title', 'value', 'valueText',
    'vat', 'start', 'finish', 'duration', 'milestones', 'advance', 'retention', 'penalty', 'warranty', 'guarantee', 'paymentTerm',
] as const;
export type MainContractPlaceholder = (typeof MAIN_CONTRACT_PLACEHOLDERS)[number];

export const MAIN_CONTRACT_TEMPLATE_TH = `<h1>สัญญาจ้างก่อสร้าง</h1>
<p>เลขที่สัญญา {{contractNo}}<br>วันที่ {{date}}</p>
<p>สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>{{customerName}}</strong> ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้ว่าจ้าง" ฝ่ายหนึ่ง กับ <strong>{{companyName}}</strong> ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้รับจ้าง" อีกฝ่ายหนึ่ง คู่สัญญาทั้งสองฝ่ายตกลงกันดังต่อไปนี้</p>
<h2>ข้อ 1 งานที่จ้าง</h2>
<p>ผู้ว่าจ้างตกลงจ้างและผู้รับจ้างตกลงรับจ้างทำงาน {{title}} ของโครงการ {{projectName}} สถานที่ก่อสร้าง {{siteAddress}} ตามแบบ รายการ และใบเสนอราคาที่แนบท้ายสัญญานี้</p>
<h2>ข้อ 2 ค่าจ้าง</h2>
<p>ค่าจ้างรวมเป็นเงิน {{value}} บาท ({{valueText}}) {{vat}}</p>
<h2>ข้อ 3 ระยะเวลา</h2>
<p>ผู้รับจ้างจะเริ่มทำงานวันที่ {{start}} และทำงานให้แล้วเสร็จภายในวันที่ {{finish}} {{duration}}</p>
<h2>ข้อ 4 การจ่ายเงิน</h2>
<p>ผู้ว่าจ้างจะจ่ายค่าจ้างเป็นงวดดังนี้ ภายใน {{paymentTerm}} นับจากวันที่ได้รับใบแจ้งหนี้</p>
{{milestones}}
<p>{{advance}} {{retention}}</p>
<h2>ข้อ 5 หลักประกันสัญญา</h2>
<p>{{guarantee}}</p>
<h2>ข้อ 6 ค่าปรับ</h2>
<p>{{penalty}}</p>
<h2>ข้อ 7 การรับประกันผลงาน</h2>
<p>{{warranty}}</p>
<p>คู่สัญญาได้อ่านและเข้าใจข้อความในสัญญานี้โดยตลอดแล้ว จึงได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน</p>
<table><tbody><tr><td>ลงชื่อ ........................................ ผู้ว่าจ้าง<br>({{customerName}})</td><td>ลงชื่อ ........................................ ผู้รับจ้าง<br>({{companyName}})</td></tr>
<tr><td>ลงชื่อ ........................................ พยาน</td><td>ลงชื่อ ........................................ พยาน</td></tr></tbody></table>`;

export const MAIN_CONTRACT_TEMPLATE_EN = `<h1>Construction Contract</h1>
<p>Contract No. {{contractNo}}<br>Date {{date}}</p>
<p>This contract is made between <strong>{{customerName}}</strong> (the "Employer") and <strong>{{companyName}}</strong> (the "Contractor"). The parties agree as follows.</p>
<h2>1. The works</h2>
<p>The Employer engages the Contractor to carry out {{title}} of the project {{projectName}} at {{siteAddress}}, according to the drawings, specifications and quotation attached to this contract.</p>
<h2>2. Contract price</h2>
<p>The contract price is THB {{value}} ({{valueText}}) {{vat}}</p>
<h2>3. Time for completion</h2>
<p>The Contractor shall start the works on {{start}} and complete them by {{finish}} {{duration}}</p>
<h2>4. Payment</h2>
<p>The Employer shall pay the contract price in the installments below, within {{paymentTerm}} of receiving each invoice.</p>
{{milestones}}
<p>{{advance}} {{retention}}</p>
<h2>5. Performance security</h2>
<p>{{guarantee}}</p>
<h2>6. Delay damages</h2>
<p>{{penalty}}</p>
<h2>7. Defects liability</h2>
<p>{{warranty}}</p>
<p>The parties have read and understood this contract and sign it in the presence of witnesses.</p>
<table><tbody><tr><td>Signed ........................................ Employer<br>({{customerName}})</td><td>Signed ........................................ Contractor<br>({{companyName}})</td></tr>
<tr><td>Signed ........................................ Witness</td><td>Signed ........................................ Witness</td></tr></tbody></table>`;

/** The built-in template of a language. */
export function mainContractTemplate(language: MainContractLanguage): string {
    return language === 'en' ? MAIN_CONTRACT_TEMPLATE_EN : MAIN_CONTRACT_TEMPLATE_TH;
}

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dateText(date: string | null, language: MainContractLanguage): string {
    if (date === null) return '-';
    if (language === 'th') return formatContractDate(date);
    const [y, m, d] = date.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) return date;
    return `${d} ${EN_MONTHS[m - 1] ?? ''} ${y}`;
}

const pct = (fraction: number): string => String(Math.round(fraction * 10000) / 100);

function milestonesTable(d: MainContractTemplateData): string {
    const th = d.language === 'th';
    const head = th
        ? '<tr><th>งวดที่</th><th>รายละเอียด</th><th>ร้อยละ</th><th>จำนวนเงิน (บาท)</th></tr>'
        : '<tr><th>No.</th><th>Description</th><th>%</th><th>Amount (THB)</th></tr>';
    const rows = d.milestones.map(m => `<tr><td>${m.kind === 'advance' ? '-' : m.no}</td><td>${escapeHtmlText(m.label)}</td>`
        + `<td>${pct(m.pct)}</td><td>${formatContractMoney(m.amount)}</td></tr>`).join('');
    return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

function texts(d: MainContractTemplateData): Record<'vat' | 'duration' | 'advance' | 'retention' | 'penalty' | 'warranty' | 'guarantee' | 'paymentTerm', string> {
    if (d.language === 'th') {
        return {
            vat: d.vatRate > 0 ? `ไม่รวมภาษีมูลค่าเพิ่มร้อยละ ${pct(d.vatRate)} ซึ่งผู้ว่าจ้างจะชำระเพิ่มตามใบแจ้งหนี้แต่ละงวด` : '',
            duration: d.durationDays === null ? '' : `รวมระยะเวลา ${d.durationDays} วัน`,
            advance: d.advancePct > 0 ? `ผู้ว่าจ้างจะจ่ายเงินล่วงหน้าร้อยละ ${pct(d.advancePct)} ของค่าจ้าง และหักคืนตามสัดส่วนจากค่าจ้างทุกงวด` : '',
            retention: d.retentionPct > 0 ? `ผู้ว่าจ้างจะหักเงินประกันผลงานร้อยละ ${pct(d.retentionPct)} ของค่าจ้างแต่ละงวด` : '',
            penalty: d.penaltyRatePerDay > 0
                ? `หากผู้รับจ้างทำงานแล้วเสร็จล่าช้ากว่ากำหนด ผู้รับจ้างยินยอมให้ปรับเป็นรายวันในอัตราร้อยละ ${pct(d.penaltyRatePerDay)} ของค่าจ้างต่อวัน รวมไม่เกินร้อยละ ${pct(d.penaltyCapPct)} ของค่าจ้าง`
                : 'ไม่มีการคิดค่าปรับกรณีทำงานแล้วเสร็จล่าช้า',
            warranty: d.warrantyMonths > 0
                ? `ผู้รับจ้างรับประกันความชำรุดบกพร่องของงานเป็นเวลา ${d.warrantyMonths} เดือน นับจากวันที่ผู้ว่าจ้างรับมอบงาน`
                : 'ไม่มีระยะเวลารับประกันผลงาน',
            guarantee: d.guaranteePct > 0
                ? `ผู้รับจ้างจะวางหลักประกันการปฏิบัติตามสัญญาร้อยละ ${pct(d.guaranteePct)} ของค่าจ้าง ในวันลงนามสัญญา`
                : 'ไม่มีหลักประกันสัญญา',
            paymentTerm: `${d.paymentTermDays} วัน`,
        };
    }
    return {
        vat: d.vatRate > 0 ? `excluding VAT at ${pct(d.vatRate)}%, which the Employer pays on top of each invoice.` : '',
        duration: d.durationDays === null ? '' : `(${d.durationDays} days in total).`,
        advance: d.advancePct > 0 ? `The Employer pays an advance of ${pct(d.advancePct)}% of the contract price, recovered pro rata from every installment.` : '',
        retention: d.retentionPct > 0 ? `The Employer retains ${pct(d.retentionPct)}% of each installment as retention.` : '',
        penalty: d.penaltyRatePerDay > 0
            ? `If the works are completed late, the Contractor pays delay damages of ${pct(d.penaltyRatePerDay)}% of the contract price per day, up to ${pct(d.penaltyCapPct)}% of the contract price.`
            : 'No delay damages apply.',
        warranty: d.warrantyMonths > 0
            ? `The Contractor remedies defects for ${d.warrantyMonths} months from the Employer's acceptance of the works.`
            : 'No defects liability period applies.',
        guarantee: d.guaranteePct > 0
            ? `The Contractor provides a performance security of ${pct(d.guaranteePct)}% of the contract price on signing.`
            : 'No performance security is required.',
        paymentTerm: `${d.paymentTermDays} days`,
    };
}

/** Values of every placeholder (HTML, already escaped). */
export function mainContractPlaceholderValues(d: MainContractTemplateData): Record<MainContractPlaceholder, string> {
    const t = texts(d);
    const e = escapeHtmlText;
    return {
        contractNo: e(d.contractNo === '' ? '-' : d.contractNo),
        date: e(dateText(d.signDate, d.language)),
        companyName: e(d.companyName),
        customerName: e(d.customerName),
        projectName: e(d.projectName),
        siteAddress: e(d.siteAddress.trim() === '' ? '-' : d.siteAddress),
        title: e(d.title),
        value: formatContractMoney(d.value),
        valueText: e(d.language === 'th' ? thaiBahtText(d.value) : amountInWordsEn(d.value)),
        vat: e(t.vat),
        start: e(dateText(d.startDate, d.language)),
        finish: e(dateText(d.finishDate, d.language)),
        duration: e(t.duration),
        milestones: milestonesTable(d),
        advance: e(t.advance),
        retention: e(t.retention),
        penalty: e(t.penalty),
        warranty: e(t.warranty),
        guarantee: e(t.guarantee),
        paymentTerm: e(t.paymentTerm),
    };
}

const PLACEHOLDER = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

/** Fills `{{placeholder}}`s (unknown ones render as nothing) and sanitizes the result. '' body = the built-in template. */
export function renderMainContract(body: string, data: MainContractTemplateData): string {
    const values: Record<string, string> = mainContractPlaceholderValues(data);
    const source = body.trim() === '' ? mainContractTemplate(data.language) : body;
    return sanitizeDocumentHtml(source.replace(PLACEHOLDER, (_m, name: string) => values[name] ?? ''));
}
