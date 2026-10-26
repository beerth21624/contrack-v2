// ─── Contract document of a subcontract: built-in Thai template, {{placeholder}} rendering, strict HTML sanitizer ───
// The text is HTML so the buyer can edit it (rich text) and the browser can print it (Sarabun). Whatever is stored or
// rendered passes `sanitizeContractHtml`: a small allowlist of formatting tags with every attribute removed, so a
// contract can never carry script, links, styles or event handlers into the other party's browser.
// Plan: docs/marketplace/01-module1-subcontracting-plan.md §4.6.
import type { Penalty, Provider } from '../../shared/contract/subcontracting/common';

export interface ContractLine {
    desc: string;
    unit: string;
    qty: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    total: number;
}

export interface ContractInstallment {
    no: number;
    pct: number;
    condition: string;
    amount: number;
}

export interface ContractTemplateData {
    contractNo: string;
    /** Date of the document, YYYY-MM-DD. */
    date: string;
    buyerName: string;
    vendorName: string;
    projectName: string;
    title: string;
    tradeLabel: string;
    location: { district: string; province: string; address: string };
    lines: readonly ContractLine[];
    total: number;
    installments: readonly ContractInstallment[];
    retentionPct: number;
    warrantyMonths: number;
    penalty: Penalty;
    provisions: { water: Provider; power: Provider; lodging: Provider; scaffolding: Provider };
    safetyNote: string;
    schedule: { start: string | null; finish: string | null; days: number | null };
    whtPct: number;
    vat: boolean;
}

/** Placeholders the template may use (anything else renders as nothing). */
export const CONTRACT_PLACEHOLDERS = [
    'contractNo', 'date', 'buyerName', 'vendorName', 'projectName', 'location', 'title', 'lines', 'total', 'totalText',
    'installments', 'start', 'finish', 'retentionPct', 'warrantyMonths', 'penalty', 'provisions', 'safetyNote',
    // extras of the built-in template
    'trade', 'tax', 'schedule',
] as const;
export type ContractPlaceholder = (typeof CONTRACT_PLACEHOLDERS)[number];

export const BUILT_IN_CONTRACT_TEMPLATE = `<h1>สัญญาจ้างเหมาช่วง</h1>
<p>เลขที่สัญญา {{contractNo}}<br>วันที่ {{date}}</p>
<p>สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>{{buyerName}}</strong> ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้ว่าจ้าง" ฝ่ายหนึ่ง กับ <strong>{{vendorName}}</strong> ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้รับจ้าง" อีกฝ่ายหนึ่ง คู่สัญญาทั้งสองฝ่ายตกลงกันดังต่อไปนี้</p>
<h2>ข้อ 1 งานที่จ้าง</h2>
<p>ผู้ว่าจ้างตกลงจ้างและผู้รับจ้างตกลงรับจ้างทำงาน {{title}} (ประเภทงาน {{trade}}) ของโครงการ {{projectName}} สถานที่ก่อสร้าง {{location}} ตามรายการและปริมาณดังต่อไปนี้</p>
{{lines}}
<h2>ข้อ 2 ค่าจ้าง</h2>
<p>ค่าจ้างรวมทั้งสิ้น {{total}} บาท ({{totalText}}) {{tax}}</p>
<h2>ข้อ 3 ระยะเวลาทำงาน</h2>
<p>{{schedule}}</p>
<h2>ข้อ 4 การจ่ายเงินเป็นงวด</h2>
<p>ผู้ว่าจ้างจะจ่ายค่าจ้างเป็นงวด เมื่อผู้รับจ้างทำงานของงวดนั้นแล้วเสร็จตามเงื่อนไขส่งมอบ และผู้ว่าจ้างได้ตรวจรับงานแล้ว ดังนี้</p>
{{installments}}
<h2>ข้อ 5 เงินประกันผลงาน</h2>
<p>ผู้ว่าจ้างจะหักเงินประกันผลงานไว้ร้อยละ {{retentionPct}} ของค่าจ้างแต่ละงวด และจะคืนให้ผู้รับจ้างครึ่งหนึ่งเมื่อส่งมอบงานทั้งหมด ส่วนที่เหลือคืนเมื่อพ้นระยะประกันผลงาน ผู้ว่าจ้างมีสิทธิหักค่าปรับหรือค่าแก้ไขงานจากเงินประกันผลงานได้ โดยแจ้งเหตุผลให้ผู้รับจ้างทราบ</p>
<h2>ข้อ 6 การรับประกันผลงาน</h2>
<p>ผู้รับจ้างรับประกันความชำรุดบกพร่องของงานเป็นเวลา {{warrantyMonths}} เดือน นับจากวันส่งมอบงาน หากเกิดความชำรุดบกพร่องอันเนื่องมาจากการทำงานของผู้รับจ้าง ผู้รับจ้างต้องแก้ไขให้เรียบร้อยโดยไม่คิดค่าใช้จ่ายภายในเวลาอันสมควร</p>
<h2>ข้อ 7 ค่าปรับ</h2>
<p>{{penalty}}</p>
<h2>ข้อ 8 สิ่งอำนวยความสะดวกหน้างาน</h2>
{{provisions}}
<h2>ข้อ 9 ความปลอดภัย</h2>
<p>ผู้รับจ้างต้องจัดให้คนงานใช้อุปกรณ์ป้องกันอันตรายส่วนบุคคล ปฏิบัติตามกฎหมายความปลอดภัยในการทำงาน และรับผิดชอบต่ออุบัติเหตุหรือความเสียหายที่เกิดจากการทำงานของผู้รับจ้าง {{safetyNote}}</p>
<h2>ข้อ 10 งานเพิ่ม-ลด</h2>
<p>การเพิ่มหรือลดงานจากที่ระบุในสัญญานี้ต้องได้รับความยินยอมจากทั้งสองฝ่าย ค่าจ้างจะเปลี่ยนตามงานเพิ่ม-ลดที่ตกลงกัน และปรับในงวดสุดท้าย</p>
<h2>ข้อ 11 การบอกเลิกสัญญา</h2>
<p>หากฝ่ายใดฝ่ายหนึ่งผิดสัญญาข้อใดข้อหนึ่ง และไม่แก้ไขภายใน 7 วันนับจากได้รับแจ้งเป็นหนังสือ อีกฝ่ายหนึ่งมีสิทธิบอกเลิกสัญญาได้ ค่าจ้างของงวดที่ตรวจรับแล้วก่อนบอกเลิกสัญญายังคงต้องชำระตามสัญญา</p>
<p>สัญญานี้ทำขึ้นเป็นสองฉบับมีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน</p>
<table><tbody>
<tr><td>ลงชื่อ ...................................... ผู้ว่าจ้าง<br>({{buyerName}})</td><td>ลงชื่อ ...................................... ผู้รับจ้าง<br>({{vendorName}})</td></tr>
<tr><td>ลงชื่อ ...................................... พยาน<br>(......................................)</td><td>ลงชื่อ ...................................... พยาน<br>(......................................)</td></tr>
</tbody></table>`;

// ── formatting (Thai readers; deterministic, no Intl) ──

const MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

/** 1234567.5 → "1,234,567.50". */
export function formatContractMoney(n: number): string {
    const fixed = Math.abs(n).toFixed(2);
    const [int = '0', dec = '00'] = fixed.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${n < 0 && Number(fixed) !== 0 ? '-' : ''}${grouped}.${dec}`;
}

function formatQty(n: number): string {
    const s = formatContractMoney(n);
    return s.endsWith('.00') ? s.slice(0, -3) : s;
}

/** "2026-10-26" → "26 ตุลาคม 2569" (Buddhist year). */
export function formatContractDate(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) return date;
    return `${d} ${MONTHS[m - 1] ?? ''} ${y + 543}`;
}

function pctText(fraction: number): string {
    return String(Math.round(fraction * 10000) / 100);
}

// ── Thai baht words (domain copy of the export helper; like Excel BAHTTEXT) ──

const DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

function wordsOfGroup(n: number, hasHigher: boolean): string {
    const digits = String(n).split('').map(Number);
    const len = digits.length;
    let out = '';
    digits.forEach((d, i) => {
        const p = len - 1 - i;
        if (d === 0) return;
        if (p === 1) out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : `${DIGITS[d] ?? ''}สิบ`;
        else if (p === 0) out += d === 1 && (len > 1 || hasHigher) ? 'เอ็ด' : DIGITS[d] ?? '';
        else out += `${DIGITS[d] ?? ''}${PLACES[p] ?? ''}`;
    });
    return out;
}

function wordsOfInteger(n: number): string {
    if (n === 0) return DIGITS[0] ?? '';
    const parts: number[] = [];
    let rest = n;
    while (rest > 0) {
        parts.unshift(rest % 1_000_000);
        rest = Math.floor(rest / 1_000_000);
    }
    return parts.map((p, i) => (p === 0 ? '' : wordsOfGroup(p, i > 0)) + (i < parts.length - 1 ? 'ล้าน' : '')).join('');
}

/** 1,850,317.34 → "หนึ่งล้านแปดแสนห้าหมื่นสามร้อยสิบเจ็ดบาทสามสิบสี่สตางค์"; 21 → "ยี่สิบเอ็ดบาทถ้วน". */
export function thaiBahtText(amount: number): string {
    if (!Number.isFinite(amount)) return '';
    const satangTotal = Math.round(Math.abs(amount) * 100);
    const baht = Math.floor(satangTotal / 100);
    const satang = satangTotal % 100;
    const sign = amount < 0 && satangTotal > 0 ? 'ลบ' : '';
    if (satang === 0) return `${sign}${wordsOfInteger(baht)}บาทถ้วน`;
    const bahtPart = baht > 0 ? `${wordsOfInteger(baht)}บาท` : '';
    return `${sign}${bahtPart}${wordsOfInteger(satang)}สตางค์`;
}

// ── rendering ──

/** Escapes text for HTML (every value put into the template goes through this). */
export function escapeContractText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function linesTable(lines: readonly ContractLine[]): string {
    const withMaterial = lines.some(l => l.matUnitPrice !== null);
    const head = `<tr><th>ลำดับ</th><th>รายการ</th><th>หน่วย</th><th>ปริมาณ</th><th>ค่าแรง/หน่วย</th>${withMaterial ? '<th>ค่าวัสดุ/หน่วย</th>' : ''}<th>รวม (บาท)</th></tr>`;
    const rows = lines.map((l, k) => `<tr><td>${k + 1}</td><td>${escapeContractText(l.desc)}</td><td>${escapeContractText(l.unit)}</td><td>${formatQty(l.qty)}</td>`
        + `<td>${l.unitPrice === null ? '-' : formatContractMoney(l.unitPrice)}</td>`
        + (withMaterial ? `<td>${l.matUnitPrice === null ? '-' : formatContractMoney(l.matUnitPrice)}</td>` : '')
        + `<td>${formatContractMoney(l.total)}</td></tr>`).join('');
    return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

function installmentsTable(list: readonly ContractInstallment[]): string {
    const rows = list.map(i => `<tr><td>${i.no}</td><td>${escapeContractText(i.condition)}</td><td>${pctText(i.pct)}%</td><td>${formatContractMoney(i.amount)}</td></tr>`).join('');
    return `<table><thead><tr><th>งวดที่</th><th>เงื่อนไขส่งมอบ</th><th>ร้อยละ</th><th>จำนวนเงิน (บาท)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function penaltyText(p: Penalty): string {
    switch (p.kind) {
        case 'none': return 'ไม่มีการคิดค่าปรับกรณีส่งมอบงานล่าช้า';
        case 'per_day': return `หากผู้รับจ้างส่งมอบงานล่าช้ากว่ากำหนด ผู้รับจ้างยินยอมให้ปรับเป็นรายวันในอัตราวันละ ${formatContractMoney(p.amount)} บาท จนกว่าจะส่งมอบงาน`;
        case 'pct_per_day': return `หากผู้รับจ้างส่งมอบงานล่าช้ากว่ากำหนด ผู้รับจ้างยินยอมให้ปรับเป็นรายวันในอัตราร้อยละ ${pctText(p.rate)} ของค่าจ้างต่อวัน จนกว่าจะส่งมอบงาน`;
    }
}

const PROVIDER_TEXT: Record<Provider, string> = { buyer: 'ผู้ว่าจ้างจัดหา', vendor: 'ผู้รับจ้างจัดหา', none: 'ไม่มี' };

function provisionsList(p: ContractTemplateData['provisions']): string {
    const items: [string, Provider][] = [['น้ำใช้', p.water], ['ไฟฟ้า', p.power], ['ที่พักคนงาน', p.lodging], ['นั่งร้าน', p.scaffolding]];
    return `<ul>${items.map(([what, who]) => `<li>${what}: ${PROVIDER_TEXT[who]}</li>`).join('')}</ul>`;
}

function scheduleText(s: ContractTemplateData['schedule']): string {
    const parts: string[] = [];
    if (s.start !== null) parts.push(`เริ่มงานวันที่ ${formatContractDate(s.start)}`);
    if (s.finish !== null) parts.push(`แล้วเสร็จภายในวันที่ ${formatContractDate(s.finish)}`);
    if (s.days !== null) parts.push(`รวมระยะเวลาทำงาน ${s.days} วัน`);
    return parts.length === 0 ? 'ตามที่คู่สัญญาตกลงกันหน้างาน' : parts.join(' ');
}

function locationText(l: ContractTemplateData['location']): string {
    const parts = [l.address, l.district, l.province].map(s => s.trim()).filter(s => s !== '');
    return parts.length === 0 ? '-' : parts.join(' ');
}

function taxText(d: ContractTemplateData): string {
    const parts: string[] = [];
    if (d.vat) parts.push('ไม่รวมภาษีมูลค่าเพิ่มร้อยละ 7 ซึ่งผู้ว่าจ้างจะชำระเพิ่มตามใบเบิกแต่ละงวด');
    if (d.whtPct > 0) parts.push(`ผู้ว่าจ้างจะหักภาษี ณ ที่จ่ายร้อยละ ${pctText(d.whtPct)} ของค่าจ้างแต่ละงวด`);
    return parts.join(' ');
}

/** Values of every placeholder (HTML, already escaped). */
export function contractPlaceholderValues(d: ContractTemplateData): Record<ContractPlaceholder, string> {
    return {
        contractNo: escapeContractText(d.contractNo),
        date: escapeContractText(formatContractDate(d.date)),
        buyerName: escapeContractText(d.buyerName),
        vendorName: escapeContractText(d.vendorName),
        projectName: escapeContractText(d.projectName),
        title: escapeContractText(d.title),
        trade: escapeContractText(d.tradeLabel),
        location: escapeContractText(locationText(d.location)),
        lines: linesTable(d.lines),
        total: formatContractMoney(d.total),
        totalText: escapeContractText(thaiBahtText(d.total)),
        tax: escapeContractText(taxText(d)),
        schedule: escapeContractText(scheduleText(d.schedule)),
        installments: installmentsTable(d.installments),
        start: d.schedule.start === null ? '-' : escapeContractText(formatContractDate(d.schedule.start)),
        finish: d.schedule.finish === null ? '-' : escapeContractText(formatContractDate(d.schedule.finish)),
        retentionPct: pctText(d.retentionPct),
        warrantyMonths: String(d.warrantyMonths),
        penalty: escapeContractText(penaltyText(d.penalty)),
        provisions: provisionsList(d.provisions),
        safetyNote: escapeContractText(d.safetyNote),
    };
}

const PLACEHOLDER = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

/** Fills `{{placeholder}}`s (unknown ones render as nothing) and sanitizes the result. '' template = built-in. */
export function renderContract(template: string, data: ContractTemplateData): string {
    const values: Record<string, string> = contractPlaceholderValues(data);
    const source = template.trim() === '' ? BUILT_IN_CONTRACT_TEMPLATE : template;
    return sanitizeContractHtml(source.replace(PLACEHOLDER, (_m, name: string) => values[name] ?? ''));
}

// ── sanitizer ──

const ALLOWED_TAGS = new Set([
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span',
]);
const VOID_TAGS = new Set(['br', 'hr']);
/** Tags whose CONTENT is dropped too (code, styles, embedded documents, raw text). */
const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'noembed', 'noframes', 'textarea', 'title',
    'xmp', 'plaintext', 'svg', 'math', 'select', 'head', 'frameset', 'applet',
]);
const TAG_START = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)/;

/** Index of the `>` that ends the tag starting before `from` (quotes respected), or -1. */
function tagEnd(html: string, from: number): number {
    let quote: string | null = null;
    for (let k = from; k < html.length; k++) {
        const c = html[k];
        if (quote !== null) {
            if (c === quote) quote = null;
        } else if (c === '"' || c === '\'') {
            quote = c;
        } else if (c === '>') {
            return k;
        }
    }
    return -1;
}

/**
 * Keeps only p, br, h1–h3, strong, b, em, i, u, ul, ol, li, table, thead, tbody, tr, th, td, hr, span — WITHOUT any
 * attribute. Other tags are removed (script-like ones with their content), comments and declarations dropped, a stray
 * `<` becomes `&lt;` and `>` in text becomes `&gt;`. Every `<` of the output is one of the allowed bare tags.
 */
export function sanitizeContractHtml(html: string): string {
    let out = '';
    let i = 0;
    const n = html.length;
    while (i < n) {
        const c = html.charAt(i);
        if (c !== '<') {
            out += c === '>' ? '&gt;' : c === '\u0000' ? '' : c;
            i += 1;
            continue;
        }
        if (html.startsWith('<!--', i)) {
            const end = html.indexOf('-->', i + 4);
            i = end < 0 ? n : end + 3;
            continue;
        }
        const next = html.charAt(i + 1);
        if (next === '!' || next === '?') {
            const end = html.indexOf('>', i);
            i = end < 0 ? n : end + 1;
            continue;
        }
        const m = TAG_START.exec(html.slice(i, i + 64));
        const end = m === null ? -1 : tagEnd(html, i + m[0].length);
        if (m === null || end < 0) {
            out += '&lt;';
            i += 1;
            continue;
        }
        const closing = m[1] === '/';
        const name = (m[2] ?? '').toLowerCase();
        i = end + 1;
        if (DROP_WITH_CONTENT.has(name)) {
            if (!closing) {
                const closer = new RegExp(`</${name}`, 'gi');
                closer.lastIndex = i;
                const close = closer.exec(html);
                const closeEnd = close === null ? -1 : html.indexOf('>', close.index);
                i = closeEnd < 0 ? n : closeEnd + 1;
            }
            continue;
        }
        if (!ALLOWED_TAGS.has(name)) continue;
        if (VOID_TAGS.has(name)) {
            if (!closing) out += `<${name}>`;
            continue;
        }
        out += closing ? `</${name}>` : `<${name}>`;
    }
    return out;
}
