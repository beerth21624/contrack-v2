// ─── Package wizard: the draft the three steps edit, and the pure logic around it ───
// Values that follow a default (title, questions, schedule, installments) are stored as null until the user edits
// them, so changing the trade or the schedule moves the defaults along without effects.
import type {
    CreatePackageRequest, FileDto, InstallmentDto, InviteChannel, LocationDto, MaterialBy, PackageTerms, Penalty,
    PricingMode, ScheduleDto, SubcontractingSettingsDto, SupplyMode, TradeId, VendorListEntryDto,
} from '@/shared/contract';
import type { BoqResult } from '@/domain/boq/types';
import type { ScheduleTaskResult } from '@/domain/planning/schedule';
import { buildSnapshot, subcontractableRows, type IndexedBoqRow } from '@/domain/subcontracting/snapshot';
import { getTrade, tasksOfTrade, tradeLabel } from '@/domain/subcontracting/trades';
import { daysBetween, defaultBidDeadline, defaultInstallments, defaultPriceValidUntil, installmentsValid } from '../format';

// ── quick-start templates (plan §3.3) ──

export interface PackageTemplate {
    id: string;
    label: string;
    /** Trade of the package. */
    trade: TradeId;
    /** Trades whose BOQ rows the template lists and ticks. */
    trades: readonly TradeId[];
}

export const TEMPLATES: readonly PackageTemplate[] = [
    { id: 'structure-all', label: 'โครงสร้างทั้งหมด', trade: 'structure', trades: ['piling', 'structure', 'roof-structure'] },
    { id: 'masonry', label: 'ก่ออิฐ + ฉาบ', trade: 'masonry', trades: ['masonry'] },
    { id: 'electrical', label: 'ระบบไฟฟ้าทั้งหลัง', trade: 'electrical', trades: ['electrical'] },
    { id: 'plumbing', label: 'ระบบประปา-สุขาภิบาล', trade: 'plumbing', trades: ['plumbing'] },
    { id: 'roof', label: 'หลังคา (โครง + มุง)', trade: 'roof-structure', trades: ['roof-structure', 'roofing'] },
    { id: 'interior', label: 'งานสถาปัตย์ภายใน', trade: 'tiling', trades: ['ceiling', 'tiling', 'painting'] },
    { id: 'doors-windows', label: 'ประตู-หน้าต่าง', trade: 'doors-windows', trades: ['doors-windows'] },
];

// ── draft ──

export interface CustomLineDraft {
    /** Local id for the editor only. */
    id: string;
    desc: string;
    unit: string;
    qty: number;
    estUnit: number;
}

export interface InviteeDraft {
    entryId: string;
    channel: InviteChannel;
}

export type DirectOrRfq = 'direct' | 'rfq';

export interface Draft {
    trade: TradeId;
    /** Trades whose rows step 1 lists (the trade, or a template's trades). */
    shownTrades: TradeId[];
    /** Ticked BOQ line keys (rows of hidden trades or held by other packages are ignored, see effectiveKeys). */
    selected: string[];
    customLines: CustomLineDraft[];
    showZero: boolean;

    supplyMode: SupplyMode;
    materialByLine: Record<string, MaterialBy>;
    pricingMode: PricingMode;
    retentionPct: number;
    retentionCustom: boolean;
    warrantyMonths: number;
    penalty: Penalty;
    provisions: PackageTerms['provisions'];
    safetyNote: string;
    /** null = the trade's suggested questions. */
    questions: string[] | null;
    /** null = default title. */
    title: string | null;
    description: string;
    hideOwnerIdentity: boolean;
    location: LocationDto;
    files: FileDto[];

    /** null = from the S-Curve plan. */
    schedule: ScheduleDto | null;
    /** null = default for the schedule length. */
    installments: InstallmentDto[] | null;
    bidDeadline: string;
    priceValidUntil: string;
    sourcingMode: DirectOrRfq;
    invitees: InviteeDraft[];
}

export interface DraftInit {
    trade: TradeId;
    /** Section to pre-tick (from the BOQ section shortcut). */
    section: number | null;
    boq: BoqResult;
    settings: SubcontractingSettingsDto | undefined;
    province: string;
    address: string;
    now: Date;
}

export const DEFAULT_PROVISIONS: PackageTerms['provisions'] = { water: 'buyer', power: 'buyer', lodging: 'none', scaffolding: 'vendor' };

export function initialDraft(init: DraftInit): Draft {
    const retention = init.settings?.defaultRetentionPct ?? 0.05;
    const selected = init.section === null ? [] : wizardRows(init.boq, [init.trade])
        .filter(r => r.section === init.section && r.row.qty > 0).map(r => r.row.key);
    return {
        trade: init.trade,
        shownTrades: [init.trade],
        selected,
        customLines: [],
        showZero: false,
        supplyMode: 'labour_only',
        materialByLine: {},
        pricingMode: 'unit',
        retentionPct: retention,
        retentionCustom: !isStandardRetention(retention),
        warrantyMonths: init.settings?.defaultWarrantyMonths ?? 12,
        penalty: { kind: 'none' },
        provisions: DEFAULT_PROVISIONS,
        safetyNote: '',
        questions: null,
        title: null,
        description: '',
        hideOwnerIdentity: true,
        location: { district: '', province: init.province, address: init.address },
        files: [],
        schedule: null,
        installments: null,
        bidDeadline: defaultBidDeadline(init.now),
        priceValidUntil: defaultPriceValidUntil(init.now),
        sourcingMode: 'rfq',
        invitees: [],
    };
}

export function isStandardRetention(v: number): boolean {
    return Math.abs(v - 0.05) < 1e-9 || Math.abs(v - 0.1) < 1e-9;
}

/** Applies a template: its trade, its trades' rows listed and every non-zero row ticked. */
export function applyTemplate(draft: Draft, template: PackageTemplate, boq: BoqResult): Draft {
    const trades = [...template.trades];
    return {
        ...draft,
        trade: template.trade,
        shownTrades: trades,
        selected: wizardRows(boq, trades).filter(r => r.row.qty > 0).map(r => r.row.key),
    };
}

/** Changing the trade lists that trade's rows (ticks of other trades stop counting). */
export function changeTrade(draft: Draft, trade: TradeId): Draft {
    return { ...draft, trade, shownTrades: [trade] };
}

// ── step 1: rows ──

export type WizardRow = IndexedBoqRow & { trade: TradeId };

/** BOQ item rows of the given trades, in BOQ order. */
export function wizardRows(boq: BoqResult, trades: readonly TradeId[]): WizardRow[] {
    return subcontractableRows(boq).filter(r => trades.includes(r.trade)).sort((a, b) => a.order - b.order);
}

/** Labour estimate of a row: K × the quantity labour is priced on (E, or H for gross-basis rows). */
export function labourEstimate(row: IndexedBoqRow['row']): number {
    const q = row.labourBasis === 'gross' ? (row.grossQty ?? row.qty) : row.qty;
    return row.labUnit * q;
}

export interface RowGroup {
    section: number;
    title: string;
    rows: WizardRow[];
}

/** Rows grouped by BOQ section (order kept); zero-quantity rows dropped unless `showZero` or ticked. */
export function groupRows(rows: readonly WizardRow[], showZero: boolean, selected: ReadonlySet<string>): RowGroup[] {
    const groups: RowGroup[] = [];
    for (const r of rows) {
        if (!showZero && r.row.qty === 0 && !selected.has(r.row.key)) continue;
        const last = groups[groups.length - 1];
        if (last?.section === r.section) last.rows.push(r);
        else groups.push({ section: r.section, title: r.sectionTitle, rows: [r] });
    }
    return groups;
}

/** Count of rows hidden because their quantity is 0. */
export function zeroRowCount(rows: readonly WizardRow[]): number {
    return rows.filter(r => r.row.qty === 0).length;
}

/** BOQ line key → title of the live package that already holds it. */
export function heldLines(packages: readonly { id: string; title: string; lines: readonly { lineKey: string | null }[] }[], exceptId?: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const p of packages) {
        if (p.id === exceptId) continue;
        for (const l of p.lines) if (l.lineKey !== null && !map.has(l.lineKey)) map.set(l.lineKey, p.title);
    }
    return map;
}

/** Ticked keys that count: listed (shown trades) and not held by another package, in BOQ order. */
export function effectiveKeys(draft: Pick<Draft, 'selected'>, rows: readonly WizardRow[], held: ReadonlyMap<string, string>): string[] {
    const ticked = new Set(draft.selected);
    return rows.filter(r => ticked.has(r.row.key) && !held.has(r.row.key)).map(r => r.row.key);
}

/** Custom lines with a description (blank rows are dropped). */
export function filledCustomLines(lines: readonly CustomLineDraft[]): CustomLineDraft[] {
    return lines.filter(l => l.desc.trim() !== '');
}

/** Every typed custom line has a unit and a quantity ≥ 0. */
export function customLinesComplete(lines: readonly CustomLineDraft[]): boolean {
    return filledCustomLines(lines).every(l => l.unit.trim() !== '' && Number.isFinite(l.qty) && l.qty >= 0);
}

/** Toggle every selectable row of a group on or off. */
export function toggleKeys(selected: readonly string[], keys: readonly string[], on: boolean): string[] {
    const set = new Set(selected);
    for (const k of keys) {
        if (on) set.add(k);
        else set.delete(k);
    }
    return [...set];
}

// ── defaults that follow other values ──

/**
 * Default package title: the trade label only (e.g. "ก่ออิฐ-ฉาบปูน"). Never the project name: crews see the title even
 * when the buyer hides the owner identity.
 */
export function defaultTitle(trade: TradeId): string {
    return tradeLabel(trade).slice(0, 160);
}

export function titleOf(draft: Draft): string {
    return draft.title ?? defaultTitle(draft.trade);
}

const squash = (s: string) => s.toLocaleLowerCase('th').replace(/\s+/g, '');

/** The title shows the project name although the owner identity is hidden (crews see the title): worth a quiet hint. */
export function titleRevealsProject(title: string, projectName: string, hideOwnerIdentity: boolean): boolean {
    if (!hideOwnerIdentity) return false;
    const name = squash(projectName);
    return name.length >= 2 && squash(title).includes(name);
}

export function questionsOf(draft: Draft): string[] {
    return draft.questions ?? [...getTrade(draft.trade).questions];
}

/** Planned dates of the trade from the S-Curve: earliest start, latest finish; days = span, else Σ Man-Day durations. */
export function scheduleFromPlan(tasks: readonly ScheduleTaskResult[], trade: TradeId): ScheduleDto {
    const ids = new Set(tasksOfTrade(trade));
    const mine = tasks.filter(t => ids.has(t.id));
    const starts = mine.map(t => t.start).filter((s): s is string => s !== null).sort();
    const finishes = mine.map(t => t.finish).filter((s): s is string => s !== null).sort();
    const start = starts[0] ?? null;
    const finish = finishes[finishes.length - 1] ?? null;
    const span = daysBetween(start, finish);
    const sum = Math.ceil(mine.reduce((s, t) => s + (Number.isFinite(t.duration) ? t.duration : 0), 0));
    return { start, finish, days: span ?? (sum > 0 ? sum : null) };
}

export function scheduleOf(draft: Draft, tasks: readonly ScheduleTaskResult[]): ScheduleDto {
    return draft.schedule ?? scheduleFromPlan(tasks, draft.trade);
}

export function installmentsOf(draft: Draft, schedule: ScheduleDto): InstallmentDto[] {
    return draft.installments ?? defaultInstallments(schedule.days);
}

export function termsOf(draft: Draft): PackageTerms {
    return {
        retentionPct: draft.retentionPct,
        warrantyMonths: draft.warrantyMonths,
        penalty: draft.penalty,
        provisions: draft.provisions,
        safetyNote: draft.safetyNote.trim(),
        questions: questionsOf(draft).map(q => q.trim()).filter(q => q !== ''),
    };
}

// ── estimate ──

export function estimateTotal(boq: BoqResult, draft: Draft, lineKeys: readonly string[]): number {
    const res = buildSnapshot(boq, {
        lineKeys,
        customLines: filledCustomLines(draft.customLines).map(l => ({ desc: l.desc, unit: l.unit, qty: l.qty, estUnit: l.estUnit })),
        supplyMode: draft.supplyMode,
        materialByLine: draft.materialByLine,
    });
    return res.ok ? res.snapshot.estimateTotal : 0;
}

// ── step 3: invitees ──

/** Invitees: project province first, then those who worked with us most, then by name. */
export function sortVendors(list: readonly VendorListEntryDto[], province: string): VendorListEntryDto[] {
    return [...list].sort((a, b) => {
        const pa = province !== '' && a.province === province ? 0 : 1;
        const pb = province !== '' && b.province === province ? 0 : 1;
        if (pa !== pb) return pa - pb;
        if (a.completedWithUs !== b.completedWithUs) return b.completedWithUs - a.completedWithUs;
        return a.displayName.localeCompare(b.displayName, 'th');
    });
}

export const MAX_RFQ = 8;

/** How many invitees the mode needs: direct exactly 1, rfq 2–8. */
export function inviteeProblem(mode: DirectOrRfq, count: number): string | null {
    if (mode === 'direct') return count === 1 ? null : 'จ้างตรงเลือกผู้รับ 1 ราย';
    if (count < 2) return 'ขอราคาเทียบเลือกอย่างน้อย 2 ราย';
    if (count > MAX_RFQ) return `ขอราคาเทียบเลือกได้ไม่เกิน ${String(MAX_RFQ)} ราย`;
    return null;
}

/** Tick / untick one invitee; direct mode keeps only the last one ticked. */
export function toggleInvitee(list: readonly InviteeDraft[], entryId: string, on: boolean, mode: DirectOrRfq): InviteeDraft[] {
    if (!on) return list.filter(i => i.entryId !== entryId);
    if (list.some(i => i.entryId === entryId)) return [...list];
    const next = { entryId, channel: 'link' as const };
    if (mode === 'direct') return [next];
    return list.length >= MAX_RFQ ? [...list] : [...list, next];
}

// ── the request ──

export interface RequestContext {
    lineKeys: readonly string[];
    tasks: readonly ScheduleTaskResult[];
}

export function buildRequest(draft: Draft, ctx: RequestContext): CreatePackageRequest {
    const schedule = scheduleOf(draft, ctx.tasks);
    const keys = new Set(ctx.lineKeys);
    return {
        title: titleOf(draft).trim(),
        trade: draft.trade,
        lineKeys: [...ctx.lineKeys],
        customLines: filledCustomLines(draft.customLines).map(l => ({ desc: l.desc.trim(), unit: l.unit.trim(), qty: l.qty, estUnit: l.estUnit })),
        supplyMode: draft.supplyMode,
        materialByLine: draft.supplyMode === 'per_line'
            ? Object.fromEntries(Object.entries(draft.materialByLine).filter(([k]) => keys.has(k)))
            : {},
        pricingMode: draft.pricingMode,
        sourcingMode: draft.sourcingMode,
        terms: termsOf(draft),
        schedule,
        installments: installmentsOf(draft, schedule),
        location: { district: draft.location.district.trim(), province: draft.location.province.trim(), address: draft.location.address.trim() },
        hideOwnerIdentity: draft.hideOwnerIdentity,
        bidDeadline: draft.bidDeadline,
        priceValidUntil: draft.priceValidUntil,
        description: draft.description.trim(),
    };
}

/** What still blocks sending (empty = ready). `forDraft` skips the invitee rule (saving a draft). */
export function sendProblems(req: CreatePackageRequest, draft: Draft, now: Date, forDraft: boolean): string[] {
    const out: string[] = [];
    if (req.lineKeys.length + req.customLines.length === 0) out.push('เลือกงานอย่างน้อย 1 รายการ');
    if (req.title === '') out.push('ตั้งชื่อแพ็กเกจ');
    if (!installmentsValid(req.installments)) out.push('งวดจ่ายต้องรวมได้ 100% และระบุเงื่อนไขทุกงวด');
    if (new Date(req.bidDeadline).getTime() <= now.getTime()) out.push('วันปิดรับราคาต้องเป็นเวลาข้างหน้า');
    if (req.schedule.start !== null && req.schedule.finish !== null && req.schedule.finish < req.schedule.start) {
        out.push('วันจบต้องไม่ก่อนวันเริ่ม');
    }
    if (!forDraft) {
        const p = inviteeProblem(draft.sourcingMode, draft.invitees.length);
        if (p !== null) out.push(p);
    }
    return out;
}

const FIELD_LABEL: Record<string, string> = {
    title: 'ชื่อแพ็กเกจ', lineKeys: 'รายการงาน', customLines: 'แถวกรอกเอง', terms: 'เงื่อนไข', schedule: 'กำหนดเวลา',
    installments: 'งวดจ่าย', location: 'สถานที่', bidDeadline: 'วันปิดรับราคา', priceValidUntil: 'ราคายืนถึง',
    description: 'รายละเอียด', materialByLine: 'วัสดุโดย',
};

/** One zod issue → a short Thai line. */
export function issueText(issue: { path: (string | number)[]; message: string } | undefined): string {
    if (issue === undefined) return 'ข้อมูลไม่ครบ ตรวจอีกครั้ง';
    if (/[฀-๿]/.test(issue.message)) return issue.message;
    const head = issue.path[0];
    const label = typeof head === 'string' ? FIELD_LABEL[head] : undefined;
    return label === undefined ? 'ข้อมูลไม่ครบ ตรวจอีกครั้ง' : `ตรวจ "${label}" อีกครั้ง`;
}

/** Local id for a new editor row. */
export function newLocalId(): string {
    return `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
}
