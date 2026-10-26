// ─── The bid form of a crew: state, reducer, totals and the requests it sends. Pure (tested). ───
// Number fields are kept as the text the user typed ("1,250.5") so a half-typed value is never rewritten;
// they are parsed when totals are computed and when the draft / bid is sent.
import type {
    BidDto, BidMode, FileDto, GuestPackageDto, InstallmentDto, PackageLineDto, SaveBidDraftRequest, SubmitBidRequest,
} from '@/shared/contract';
import { priceLine, round2 } from '@/domain/subcontracting/snapshot';

export interface LineDraft {
    idx: number;
    unitPrice: string;
    matUnitPrice: string;
    excluded: boolean;
    reason: string;
}

export interface InstallmentDraft {
    /** Percent as typed ("30"), not a fraction. */
    pct: string;
    condition: string;
}

export interface BidFormState {
    mode: BidMode;
    /** Same order as the package lines. */
    lines: LineDraft[];
    lumpTotal: string;
    /** Discount on the whole bid, typed as a positive amount (sent as a negative adjustment). */
    discount: string;
    adjustmentNote: string;
    inclusions: string;
    days: string;
    earliestStart: string;
    crewSkilled: string;
    crewLabourers: string;
    validUntil: string;
    installmentsMode: 'accept' | 'propose';
    installments: InstallmentDraft[];
    answers: string[];
    note: string;
    photos: FileDto[];
    /** Bumped by every change the user makes (0 = untouched since load): drives the autosave. */
    rev: number;
}

type TextField = 'lumpTotal' | 'discount' | 'adjustmentNote' | 'inclusions' | 'days' | 'earliestStart' | 'crewSkilled'
    | 'crewLabourers' | 'validUntil' | 'note';

export type BidFormAction =
    | { type: 'field'; field: TextField; value: string }
    | { type: 'mode'; mode: BidMode }
    | { type: 'line'; idx: number; patch: Partial<Omit<LineDraft, 'idx'>> }
    | { type: 'installmentsMode'; mode: 'accept' | 'propose' }
    | { type: 'installment'; index: number; patch: Partial<InstallmentDraft> }
    | { type: 'addInstallment' }
    | { type: 'removeInstallment'; index: number }
    | { type: 'answer'; index: number; value: string }
    | { type: 'addPhoto'; file: FileDto }
    | { type: 'removePhoto'; id: string };

export const MAX_BID_PHOTOS = 10;

/** "1,250.50" / " 1250,5 " → 1250.5; '' or garbage → null. Negative numbers are not prices: null. */
export function parseAmount(text: string): number | null {
    const t = text.trim().replace(/,/g, '').replace(/\s/g, '');
    if (t === '' || !/^\d*\.?\d*$/.test(t) || t === '.') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

/** Whole number (crew counts, days): null when empty or not an integer ≥ 0. */
export function parseCount(text: string): number | null {
    const n = parseAmount(text);
    return n !== null && Number.isInteger(n) ? n : null;
}

const numText = (n: number | null) => (n === null ? '' : String(n));
const pctText = (fraction: number) => String(Math.round(fraction * 10000) / 100);
const blankLine = (idx: number): LineDraft => ({ idx, unitPrice: '', matUnitPrice: '', excluded: false, reason: '' });

/** Mode the package lets the crew price in by default (vendor_choice starts with unit prices). */
export function defaultMode(pkg: Pick<GuestPackageDto, 'pricingMode'>): BidMode {
    return pkg.pricingMode === 'lump' ? 'lump' : 'unit';
}

function installmentDrafts(list: readonly InstallmentDto[]): InstallmentDraft[] {
    return list.map(i => ({ pct: pctText(i.pct), condition: i.condition }));
}

/** Form state from the saved draft (or the latest submitted bid, or nothing). Lines follow the package lines. */
export function initBidForm(pkg: GuestPackageDto, from: BidDto | null): BidFormState {
    const byIdx = new Map((from?.lines ?? []).map(l => [l.idx, l]));
    const mode: BidMode = pkg.pricingMode === 'vendor_choice' && from !== null ? from.mode : defaultMode(pkg);
    const proposal = from?.installmentsProposal ?? null;
    return {
        mode,
        lines: pkg.lines.map(line => {
            const saved = byIdx.get(line.idx);
            return {
                idx: line.idx,
                unitPrice: numText(saved?.unitPrice ?? null),
                matUnitPrice: numText(saved?.matUnitPrice ?? null),
                excluded: saved?.excluded ?? false,
                reason: saved?.reason ?? '',
            };
        }),
        lumpTotal: numText(from?.lumpTotal ?? null),
        discount: from !== null && from.adjustment < 0 ? String(-from.adjustment) : '',
        adjustmentNote: from?.adjustmentNote ?? '',
        inclusions: from?.inclusions ?? '',
        days: numText(from?.days ?? null),
        earliestStart: from?.earliestStart ?? '',
        crewSkilled: numText(from?.crewSkilled ?? null),
        crewLabourers: numText(from?.crewLabourers ?? null),
        validUntil: from?.validUntil ?? pkg.priceValidUntil,
        installmentsMode: proposal === null ? 'accept' : 'propose',
        installments: installmentDrafts(proposal ?? pkg.installments),
        answers: pkg.terms.questions.map((_q, i) => from?.answers[i] ?? ''),
        note: from?.note ?? '',
        photos: from?.photos ?? [],
        rev: 0,
    };
}

export function bidFormReducer(state: BidFormState, action: BidFormAction): BidFormState {
    const next = reduce(state, action);
    return next === state ? state : { ...next, rev: state.rev + 1 };
}

function reduce(s: BidFormState, a: BidFormAction): BidFormState {
    switch (a.type) {
        case 'field': return { ...s, [a.field]: a.value };
        case 'mode': return { ...s, mode: a.mode };
        case 'line': {
            const base = s.lines.some(l => l.idx === a.idx) ? s.lines : [...s.lines, blankLine(a.idx)];
            return { ...s, lines: base.map(l => (l.idx === a.idx ? { ...l, ...a.patch } : l)) };
        }
        case 'installmentsMode': return { ...s, installmentsMode: a.mode };
        case 'installment':
            return { ...s, installments: s.installments.map((i, k) => (k === a.index ? { ...i, ...a.patch } : i)) };
        case 'addInstallment': return { ...s, installments: [...s.installments, { pct: '', condition: '' }] };
        case 'removeInstallment':
            return s.installments.length <= 1 ? s : { ...s, installments: s.installments.filter((_i, k) => k !== a.index) };
        case 'answer': return { ...s, answers: s.answers.map((v, k) => (k === a.index ? a.value : v)) };
        case 'addPhoto':
            return s.photos.length >= MAX_BID_PHOTOS || s.photos.some(p => p.id === a.file.id) ? s : { ...s, photos: [...s.photos, a.file] };
        case 'removePhoto': return { ...s, photos: s.photos.filter(p => p.id !== a.id) };
    }
}

/** Total of one line (0 when excluded or not priced): labour × priced qty (+ material × material qty), as the server prices it. */
export function lineTotal(line: PackageLineDto, d: LineDraft): number {
    if (d.excluded) return 0;
    return priceLine(line, parseAmount(d.unitPrice), parseAmount(d.matUnitPrice));
}

export function discountOf(s: BidFormState): number {
    return parseAmount(s.discount) ?? 0;
}


/** Each package line with its draft, matched by idx (a line added by an addendum starts blank). */
export function pairLines(pkg: Pick<GuestPackageDto, 'lines'>, s: Pick<BidFormState, 'lines'>): { line: PackageLineDto; d: LineDraft }[] {
    const byIdx = new Map(s.lines.map(l => [l.idx, l]));
    return pkg.lines.map(line => ({ line, d: byIdx.get(line.idx) ?? blankLine(line.idx) }));
}

/** Σ line totals (or the lump sum) − discount, never below 0. */
export function bidTotal(pkg: GuestPackageDto, s: BidFormState): number {
    const base = s.mode === 'lump'
        ? parseAmount(s.lumpTotal) ?? 0
        : pairLines(pkg, s).reduce((sum, { line, d }) => sum + lineTotal(line, d), 0);
    return Math.max(0, round2(base - (s.mode === 'unit' ? discountOf(s) : 0)));
}

/** Σ of the proposed installments, in percent. */
export function installmentsPctSum(s: BidFormState): number {
    return round2(s.installments.reduce((sum, i) => sum + (parseAmount(i.pct) ?? 0), 0));
}

export interface BidCheck {
    /** Block the submit (the server would refuse). */
    errors: string[];
    /** Shown before submit, never blocking. */
    warnings: string[];
    /** Lines (idx) the errors / warnings are about, to highlight. */
    lineIdx: number[];
}

/** What stops (errors) or deserves a second look (warnings) before the bid goes out. */
export function checkBid(pkg: GuestPackageDto, s: BidFormState): BidCheck {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lineIdx: number[] = [];
    if (s.mode === 'unit') {
        let unpriced = 0;
        let zero = 0;
        let noReason = 0;
        let noMaterial = 0;
        const pairs = pairLines(pkg, s);
        pairs.forEach(({ line, d }) => {
            if (d.excluded) {
                if (d.reason.trim() === '') { noReason += 1; lineIdx.push(line.idx); }
                return;
            }
            const unit = parseAmount(d.unitPrice);
            const mat = line.materialBy === 'vendor' ? parseAmount(d.matUnitPrice) : 0;
            if (unit === null) { unpriced += 1; lineIdx.push(line.idx); return; }
            // The crew supplies material on this line: the server refuses a labour price without a material price.
            if (mat === null) { noMaterial += 1; lineIdx.push(line.idx); return; }
            if (unit === 0 && mat === 0) { zero += 1; lineIdx.push(line.idx); }
        });
        if (unpriced > 0) errors.push(`ยังไม่ได้ใส่ราคา ${String(unpriced)} รายการ (ใส่ราคา หรือกด "ไม่รวม")`);
        if (noMaterial > 0) errors.push(`ยังไม่ได้ใส่ค่าวัสดุ ${String(noMaterial)} รายการ (รายการที่คุณจัดหาวัสดุ ใส่ 0 ถ้าไม่คิดค่าวัสดุ)`);
        if (noReason > 0) errors.push(`รายการที่ไม่รวม ${String(noReason)} รายการ ยังไม่ได้บอกเหตุผล`);
        if (zero > 0) warnings.push(`มี ${String(zero)} รายการราคาเป็น 0 บาท — ตั้งใจให้ฟรีใช่ไหม`);
        if (pairs.length > 0 && pairs.every(p => p.d.excluded)) errors.push('ต้องเสนอราคาอย่างน้อย 1 รายการ');
    } else if ((parseAmount(s.lumpTotal) ?? 0) <= 0) {
        errors.push('ใส่ราคาเหมารวม');
    }
    if (s.installmentsMode === 'propose') {
        const sum = installmentsPctSum(s);
        if (Math.abs(sum - 100) > 0.01) errors.push(`งวดจ่ายรวมได้ ${String(sum)}% ต้องรวมให้ได้ 100%`);
        if (s.installments.some(i => i.condition.trim() === '')) errors.push('บอกเงื่อนไขของทุกงวด (ทำอะไรเสร็จจึงเบิก)');
    }
    if (s.days !== '' && (parseCount(s.days) ?? 0) < 1) errors.push('จำนวนวันทำงานไม่ถูกต้อง');
    return { errors, warnings, lineIdx };
}

function proposal(s: BidFormState): InstallmentDto[] | null {
    if (s.installmentsMode === 'accept') return null;
    return s.installments.map((i, k) => ({
        no: k + 1,
        pct: Math.round((parseAmount(i.pct) ?? 0) * 100) / 10000,
        condition: i.condition.trim(),
    }));
}

function body(pkg: GuestPackageDto, s: BidFormState): SubmitBidRequest {
    const days = parseCount(s.days);
    return {
        mode: s.mode,
        lines: s.mode === 'lump' ? [] : pairLines(pkg, s).map(({ line, d }) => ({
            idx: line.idx,
            unitPrice: d.excluded ? null : parseAmount(d.unitPrice),
            matUnitPrice: d.excluded || line.materialBy !== 'vendor' ? null : parseAmount(d.matUnitPrice),
            excluded: d.excluded,
            reason: d.excluded ? d.reason.trim().slice(0, 300) : '',
        })),
        lumpTotal: s.mode === 'lump' ? parseAmount(s.lumpTotal) : null,
        adjustment: s.mode === 'unit' ? -discountOf(s) : 0,
        adjustmentNote: s.mode === 'unit' ? s.adjustmentNote.trim() : '',
        inclusions: s.mode === 'lump' ? s.inclusions.trim() : '',
        days: days !== null && days >= 1 ? days : null,
        earliestStart: s.earliestStart === '' ? null : s.earliestStart,
        crewSkilled: parseCount(s.crewSkilled),
        crewLabourers: parseCount(s.crewLabourers),
        validUntil: s.validUntil === '' ? null : s.validUntil,
        installmentsProposal: proposal(s),
        answers: s.answers.map(a => a.trim()),
        note: s.note.trim(),
        photoFileIds: s.photos.map(p => p.id),
    };
}

/** Autosave body: everything as it is (incomplete values are fine for a draft). */
export function toDraftRequest(pkg: GuestPackageDto, s: BidFormState): SaveBidDraftRequest {
    const b = body(pkg, s);
    // A half-typed proposal (Σ ≠ 100 %) would be refused by the schema: keep the draft, drop the proposal.
    if (b.installmentsProposal !== null && Math.abs(installmentsPctSum(s) - 100) > 0.01) {
        const { installmentsProposal: _drop, ...rest } = b;
        return rest;
    }
    if (b.installmentsProposal?.some(i => i.condition === '') === true) {
        const { installmentsProposal: _drop, ...rest } = b;
        return rest;
    }
    return b;
}

export function toSubmitRequest(pkg: GuestPackageDto, s: BidFormState): SubmitBidRequest {
    return body(pkg, s);
}
