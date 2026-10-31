// ─── The printed quotation as plain data: header parties, table rows, totals, government forms ปร.4 / ปร.5 / ปร.6 ───
// Pure (no React). Text is picked in the document's language (`pickLocalized`, `unitEn`); numbers and dates are
// formatted by the component with the same language. Cost fields are used only when the caller may see them.
import { unitEn } from '@/domain/boq/units';
import { round2 } from '@/domain/money';
import type {
    BankAccount, CompanyProfileDto, CustomerDto, DocLanguage, MilestoneTemplateItem, QuotationCompanySnapshot, QuotationCustomerSnapshot,
    QuotationVersionDto,
} from '@/shared/contract';
import { pickLocalized } from '@/i18n/format';

export interface PrintCompany {
    name: string;
    taxId: string;
    /** `00000` is the head office. */
    branchCode: string;
    branchName: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    brandColor: string;
    logoUrl: string | null;
    stampUrl: string | null;
    signatureUrl: string | null;
    bankAccounts: BankAccount[];
    promptpayId: string;
    footer: string;
    yearStyle: 'ce' | 'be';
}

export interface PrintCustomer {
    name: string;
    taxId: string;
    branchCode: string;
    address: string;
    contactName: string;
    phone: string;
    email: string;
}

const DEFAULT_BRAND = '#F97316';
const validBrand = (c: string): string => (/^#[0-9A-Fa-f]{6}$/.test(c) ? c : DEFAULT_BRAND);

/** The company as it was when the version was issued. Files are not reachable by id here: pass the urls when known. */
export function companyFromSnapshot(s: QuotationCompanySnapshot, images: { logoUrl?: string | null; stampUrl?: string | null; signatureUrl?: string | null } = {}): PrintCompany {
    return {
        name: s.legalName, taxId: s.taxId, branchCode: s.branchCode, branchName: s.branchName, address: s.address, phone: s.phone,
        email: s.email, website: s.website, brandColor: validBrand(s.brandColor), logoUrl: images.logoUrl ?? null,
        stampUrl: images.stampUrl ?? null, signatureUrl: images.signatureUrl ?? null, bankAccounts: s.bankAccounts,
        promptpayId: s.promptpayId, footer: s.footer, yearStyle: s.yearStyle,
    };
}

/** The live company profile (preview of a draft). */
export function companyFromProfile(p: CompanyProfileDto, language: DocLanguage): PrintCompany {
    const name = pickLocalized(p.legalNameTh, p.legalNameEn, language);
    return {
        name: name === '' ? p.workspaceName : name,
        taxId: p.taxId, branchCode: p.branchCode, branchName: pickLocalized(p.branchNameTh, p.branchNameEn, language),
        address: pickLocalized(p.addressTh, p.addressEn, language), phone: p.phone, email: p.email, website: p.website,
        brandColor: validBrand(p.brandColor), logoUrl: p.logo?.url ?? null, stampUrl: p.stamp?.url ?? null,
        signatureUrl: p.signature?.url ?? null, bankAccounts: p.bankAccounts, promptpayId: p.promptpayId,
        footer: language === 'en' ? p.documentFooterEn : p.documentFooterTh, yearStyle: p.documentYearStyle,
    };
}

export function customerFromSnapshot(s: QuotationCustomerSnapshot): PrintCustomer {
    return { name: s.name, taxId: s.taxId, branchCode: s.branchCode, address: s.address, contactName: s.contactName, phone: s.phone, email: s.email };
}

export function customerFromDto(c: CustomerDto, language: DocLanguage): PrintCustomer {
    return {
        name: pickLocalized(c.nameTh, c.nameEn, language), taxId: c.taxId, branchCode: c.branchCode,
        address: pickLocalized(c.addressTh, c.addressEn, language), contactName: c.contactName, phone: c.phone, email: c.email,
    };
}

// ── rows ──

export type StandardMode = 'lump' | 'category' | 'lines' | 'split';

export type StandardRow =
    | { kind: 'lump'; no: string; text: string; amount: number }
    | { kind: 'section'; no: string; text: string; amount: number | null }
    | { kind: 'line'; no: string; text: string; qty: number; unit: string; matUnit: number; labUnit: number; unitPrice: number; amount: number }
    | { kind: 'note'; text: string }
    | { kind: 'subtotal'; text: string; amountOf: number };

export interface TotalRow {
    key: 'subtotal' | 'discount' | 'rounding' | 'beforeVat' | 'vat' | 'grand';
    /** Signed as shown (a discount is negative). */
    amount: number;
}

export interface PrintMilestone {
    label: string;
    pct: number;
    amount: number;
}

export interface Pr4Row {
    kind: 'section' | 'line' | 'note' | 'subtotal';
    no: string;
    text: string;
    qty: number | null;
    unit: string;
    matUnit: number | null;
    labUnit: number | null;
    amount: number | null;
}

export interface Pr5Row {
    no: string;
    text: string;
    amount: number;
}

export interface Pr5Form {
    key: string;
    title: string;
    rows: Pr5Row[];
    /** Σ direct cost (null when the caller may not see cost: rows then show the sell of each section). */
    costTotal: number | null;
    factorF: number;
    sell: number;
}

export interface Pr6Row {
    no: string;
    text: string;
    amount: number;
}

export interface GovernmentModel {
    pr4: Pr4Row[];
    pr5: Pr5Form[];
    /** Present when there is more than one part. */
    pr6: Pr6Row[] | null;
    /** The figures of ปร.4 are direct costs (true) or the sell of each line (false). */
    costBasis: boolean;
}

export interface QuotationPrintModel {
    language: DocLanguage;
    watermark: 'draft' | 'void' | null;
    number: string | null;
    title: string;
    issueDate: string | null;
    validUntil: string | null;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName: string | null;
    isGovernment: boolean;
    mode: StandardMode;
    rows: StandardRow[];
    government: GovernmentModel | null;
    totals: TotalRow[];
    grandTotal: number;
    vat: number;
    vatRate: number;
    /** How VAT reads under the totals. */
    vatNote: 'included' | 'none' | null;
    paymentTerms: PrintMilestone[];
    terms: string;
    note: string;
    acceptedByName: string;
}

const sortBy = <T,>(items: readonly T[], key: (t: T) => number): T[] => [...items].sort((a, b) => key(a) - key(b));

function watermarkOf(status: QuotationVersionDto['status']): 'draft' | 'void' | null {
    if (status === 'draft' || status === 'pending_approval') return 'draft';
    if (status === 'cancelled') return 'void';
    return null;
}

function milestones(items: readonly MilestoneTemplateItem[], total: number, language: DocLanguage): PrintMilestone[] {
    let used = 0;
    return items.map((m, i) => {
        const amount = i === items.length - 1 ? round2(total - used) : round2(total * m.pct);
        used = round2(used + amount);
        return { label: pickLocalized(m.labelTh, m.labelEn, language), pct: m.pct, amount };
    });
}

function totalRows(v: QuotationVersionDto): TotalRow[] {
    const t = v.totals;
    const rows: TotalRow[] = [{ key: 'subtotal', amount: t.sell }];
    if (t.discount > 0) rows.push({ key: 'discount', amount: -t.discount });
    if (t.roundingAdj !== 0) rows.push({ key: 'rounding', amount: t.roundingAdj });
    if (t.vat > 0) {
        if (t.discount > 0 || t.roundingAdj !== 0) rows.push({ key: 'beforeVat', amount: t.vatBase });
        rows.push({ key: 'vat', amount: t.vat });
    }
    rows.push({ key: 'grand', amount: t.grandTotal });
    return rows;
}

export function standardMode(v: Pick<QuotationVersionDto, 'format' | 'detailLevel'>): StandardMode {
    if (v.detailLevel === 'lump_sum') return 'lump';
    if (v.detailLevel === 'per_category') return 'category';
    return v.format === 'detailed' ? 'split' : 'lines';
}

function standardRows(v: QuotationVersionDto, mode: StandardMode, language: DocLanguage): StandardRow[] {
    const sections = sortBy(v.sections.filter(s => s.included), s => s.sort);
    const text = (th: string, en: string): string => pickLocalized(th, en, language);
    if (mode === 'lump') return [{ kind: 'lump', no: '1', text: '', amount: v.totals.sell }];
    const rows: StandardRow[] = [];
    sections.forEach((s, si) => {
        const no = String(si + 1);
        const title = text(s.titleTh, s.titleEn);
        if (mode === 'category') {
            rows.push({ kind: 'section', no, text: title, amount: s.sellTotal });
            return;
        }
        rows.push({ kind: 'section', no, text: title, amount: null });
        let n = 0;
        for (const l of sortBy(v.lines.filter(x => x.sectionNo === s.sectionNo), x => x.sort)) {
            if (l.kind === 'note') {
                rows.push({ kind: 'note', text: text(l.descTh, l.descEn) });
                continue;
            }
            n += 1;
            rows.push({
                kind: 'line', no: `${no}.${n}`, text: text(l.descTh, l.descEn), qty: l.qty, unit: language === 'en' ? unitEn(l.unit) : l.unit,
                matUnit: l.sellMatUnit, labUnit: l.sellLabUnit, unitPrice: l.sellUnit, amount: l.sellAmount,
            });
        }
        rows.push({ kind: 'subtotal', text: title, amountOf: s.sellTotal });
    });
    return rows;
}

function governmentModel(v: QuotationVersionDto, language: DocLanguage): GovernmentModel {
    const text = (th: string, en: string): string => pickLocalized(th, en, language);
    const costBasis = v.seesMargins;
    const sections = sortBy(v.sections.filter(s => s.included), s => s.sort);
    const sectionNo = new Map(sections.map((s, i) => [s.sectionNo, String(i + 1)] as const));
    const amountOf = (s: QuotationVersionDto['sections'][number]): number => (costBasis ? (s.costTotal ?? 0) : s.sellTotal);

    const pr4: Pr4Row[] = [];
    for (const s of sections) {
        const no = sectionNo.get(s.sectionNo) ?? '';
        const title = text(s.titleTh, s.titleEn);
        pr4.push({ kind: 'section', no, text: title, qty: null, unit: '', matUnit: null, labUnit: null, amount: null });
        let n = 0;
        for (const l of sortBy(v.lines.filter(x => x.sectionNo === s.sectionNo), x => x.sort)) {
            if (l.kind === 'note') {
                pr4.push({ kind: 'note', no: '', text: text(l.descTh, l.descEn), qty: null, unit: '', matUnit: null, labUnit: null, amount: null });
                continue;
            }
            n += 1;
            pr4.push({
                kind: 'line', no: `${no}.${n}`, text: text(l.descTh, l.descEn), qty: l.qty, unit: language === 'en' ? unitEn(l.unit) : l.unit,
                matUnit: costBasis ? (l.costMatUnit ?? 0) : l.sellMatUnit, labUnit: costBasis ? (l.costLabUnit ?? 0) : l.sellLabUnit,
                amount: costBasis ? (l.costAmount ?? 0) : l.sellAmount,
            });
        }
        pr4.push({ kind: 'subtotal', no: '', text: title, qty: null, unit: '', matUnit: null, labUnit: null, amount: amountOf(s) });
    }

    const byNo = new Map(sections.map(s => [s.sectionNo, s] as const));
    const pr5: Pr5Form[] = v.parts.map(p => {
        const inPart = sortBy(p.sectionNos.map(n => byNo.get(n)).filter((s): s is QuotationVersionDto['sections'][number] => s !== undefined), s => s.sort);
        return {
            key: p.key,
            title: text(p.titleTh, p.titleEn),
            rows: inPart.map(s => ({ no: sectionNo.get(s.sectionNo) ?? '', text: text(s.titleTh, s.titleEn), amount: amountOf(s) })),
            costTotal: costBasis ? (p.cost ?? 0) : null,
            factorF: p.factorF,
            sell: p.sell,
        };
    });
    const pr6: Pr6Row[] | null = v.parts.length > 1 ? v.parts.map((p, i) => ({ no: String(i + 1), text: text(p.titleTh, p.titleEn), amount: p.sell })) : null;
    return { pr4, pr5, pr6, costBasis };
}

export function buildQuotationPrintModel(input: {
    version: QuotationVersionDto;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName?: string | null;
}): QuotationPrintModel {
    const { version: v, company, customer } = input;
    const language = v.language;
    const isGovernment = v.format === 'government';
    const mode = standardMode(v);
    return {
        language,
        watermark: watermarkOf(v.status),
        number: v.number,
        title: v.title,
        issueDate: v.issueDate,
        validUntil: v.validUntil,
        company,
        customer,
        projectName: input.projectName ?? null,
        isGovernment,
        mode,
        rows: isGovernment ? [] : standardRows(v, mode, language),
        government: isGovernment ? governmentModel(v, language) : null,
        totals: totalRows(v),
        grandTotal: v.totals.grandTotal,
        vat: v.totals.vat,
        vatRate: v.pricing.vatRate,
        vatNote: v.pricing.vatMode === 'none' ? 'none' : v.pricing.vatMode === 'included_in_factor' && v.totals.vat > 0 ? 'included' : null,
        paymentTerms: milestones(v.paymentTerms, v.totals.grandTotal, language),
        terms: language === 'en' ? (v.termsEn !== '' ? v.termsEn : v.termsTh) : (v.termsTh !== '' ? v.termsTh : v.termsEn),
        note: v.note,
        acceptedByName: v.status === 'accepted' ? v.acceptedByName : '',
    };
}
