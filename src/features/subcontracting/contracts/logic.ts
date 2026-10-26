// ─── Pure helpers of the buyer contract screens (labels, permissions widened by settings, claim preview) ───
// No React, no fetch: everything here is unit tested. Money rules follow plan §6 rules 9–11; the server is the one
// that decides (ClaimDto.amounts). The preview in the approve dialog only shows what the server will most likely say.
import type {
    ClaimAmounts, ClaimDto, ClaimStatus, InspectionResult, Role, SubcontractDto, SubcontractLineDto, SubcontractStatus,
    SubcontractSummaryDto, SubcontractTerms, SubcontractingSettingsDto, WorkspaceRetentionRow,
} from '@/shared/contract';
import { contractClaimAmounts } from '@/domain/subcontracting/claims';
import { round2 as domainRound2 } from '@/domain/subcontracting/snapshot';
import { isApiError } from '@/features/cloud/api/errors';
import { can, type Permission } from '@/features/cloud/permissions';

// ── Errors ──

/** The server said the subcontracting module is off for this workspace (404 module_disabled), not "not found". */
export function isModuleDisabled(e: unknown): boolean {
    return isApiError(e) && e.code === 'module_disabled';
}

// ── Numbers ──

/** Round to satang with the domain rule the server uses (half away from zero); 0 for a non-finite input. */
export function round2(n: number): number {
    return Number.isFinite(n) ? domainRound2(n) : 0;
}

const MONEY = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QTY = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

/** 125000 → "125,000.00" (tabular numerals come from the CSS). */
export function fmtMoney(n: number): string {
    return MONEY.format(round2(n));
}

export function fmtQty(n: number): string {
    return QTY.format(n);
}

/** 0.05 → "5%" (up to 2 decimals). */
export function fmtPct(fraction: number): string {
    return `${QTY.format(round2(fraction * 100))}%`;
}

const DATE = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });
const DATE_LONG = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-10-30" → "30 ต.ค. 69"; '' for null or a bad date. */
export function fmtDate(date: string | null | undefined, long = false): string {
    if (date === null || date === undefined || date === '') return '';
    const d = new Date(date.length === 10 ? `${date}T00:00:00Z` : date);
    if (Number.isNaN(d.getTime())) return '';
    return (long ? DATE_LONG : DATE).format(d);
}

/** Today in the browser's time zone as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${String(now.getFullYear())}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// ── Labels ──

export const SUBCONTRACT_STATUS_LABEL: Record<SubcontractStatus, string> = {
    pending_acceptance: 'รอผู้รับจ้างยอมรับ',
    active: 'กำลังดำเนินงาน',
    completed: 'ส่งมอบแล้ว',
    closed: 'ปิดสัญญาแล้ว',
    cancelled: 'ยกเลิก',
    terminated: 'บอกเลิกสัญญา',
};

/** Colour means state (design system): green done, red problem, grey not yet; the brand colour for "your move". */
export const SUBCONTRACT_STATUS_COLOR: Record<SubcontractStatus, string> = {
    pending_acceptance: 'default',
    active: 'processing',
    completed: 'success',
    closed: 'success',
    cancelled: 'default',
    terminated: 'error',
};

export type InstallmentState = SubcontractDto['installments'][number]['state'];

export const INSTALLMENT_STATE_LABEL: Record<InstallmentState, string> = {
    not_started: 'ยังไม่ถึง',
    requested: 'ขอเบิกแล้ว',
    inspected: 'ตรวจรับแล้ว',
    approved: 'อนุมัติแล้ว',
    paid: 'จ่ายแล้ว',
};

export const INSTALLMENT_STATE_COLOR: Record<InstallmentState, string> = {
    not_started: 'default',
    requested: 'warning',
    inspected: 'processing',
    approved: 'processing',
    paid: 'success',
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
    requested: 'รอตรวจรับ',
    inspected: 'ตรวจรับแล้ว',
    approved: 'อนุมัติแล้ว',
    paid: 'จ่ายแล้ว',
    rejected: 'ไม่อนุมัติ',
};

export const INSPECTION_RESULT_LABEL: Record<InspectionResult, string> = {
    pass: 'ผ่าน',
    pass_with_fixes: 'ผ่าน มีรายการแก้',
    fail: 'ไม่ผ่าน',
};

export type PendingAction = SubcontractSummaryDto['pendingAction'];

/** The one call to action of a contract row (null = nothing waits on the buyer). */
export const PENDING_ACTION_LABEL: Record<PendingAction, string | null> = {
    none: null,
    vendor_accept: 'รอผู้รับจ้างยอมรับ',
    buyer_inspect: 'ตรวจรับงวด',
    buyer_approve: 'อนุมัติงวด',
    buyer_pay: 'บันทึกจ่าย',
    variation_response: 'ตอบงานเพิ่ม-ลด',
};

/** Pending actions that are the buyer's move (shown as a button, the others as quiet text). */
export function isBuyerMove(action: PendingAction): boolean {
    return action === 'buyer_inspect' || action === 'buyer_approve' || action === 'buyer_pay' || action === 'variation_response';
}

export const RETENTION_KIND_LABEL = { withheld: 'หักไว้', released: 'คืนแล้ว', forfeited: 'ริบ' } as const;

// ── Permissions (client mirror of ScAccess.allowed: settings widen three rights) ──

type ScSettingsLike = Pick<SubcontractingSettingsDto, 'estimatorCanAward' | 'estimatorCanApproveClaims' | 'viewerSeesPrices'>;

/** Whether `role` may do `permission` in the buyer workspace, counting the settings that widen it (unknown = not widened). */
export function scCan(role: Role | undefined, permission: Permission, settings: ScSettingsLike | undefined): boolean {
    if (can(role, permission)) return true;
    if (settings === undefined) return false;
    if (role === 'estimator' && permission === 'sc.award') return settings.estimatorCanAward;
    if (role === 'estimator' && permission === 'sc.claims.approve') return settings.estimatorCanApproveClaims;
    if (role === 'viewer' && permission === 'sc.readPrices') return settings.viewerSeesPrices;
    return false;
}

/** Rights that only read (they stay when the buyer switched the module off and the contract is read-only). */
const READ_RIGHTS: readonly Permission[] = ['sc.read', 'sc.readPrices'];

/**
 * `may` of a contract page: when the buyer's module is off (SubcontractDto.buyerModuleOn false) every action is
 * hidden and only the read rights remain.
 */
export function contractMay(may: (p: Permission) => boolean, buyerModuleOn: boolean): (p: Permission) => boolean {
    return (p) => (buyerModuleOn || READ_RIGHTS.includes(p)) && may(p);
}

// ── Contract progress ──

/** Paid installments out of all (plan §4.7: progress = paid / all). */
export function installmentProgress(installments: readonly { state: InstallmentState }[]): { paid: number; total: number; pct: number } {
    const total = installments.length;
    const paid = installments.filter(i => i.state === 'paid').length;
    return { paid, total, pct: total === 0 ? 0 : Math.round((paid / total) * 100) };
}

/** Which end-of-life actions the buyer has on a contract in this state. */
export function contractActions(sc: Pick<SubcontractDto, 'status' | 'retention' | 'myRating'> & { installments: readonly { state: InstallmentState }[] }): {
    cancel: boolean; terminate: boolean; complete: boolean; close: boolean; rate: boolean;
} {
    const allPaid = sc.installments.length > 0 && sc.installments.every(i => i.state === 'paid');
    return {
        cancel: sc.status === 'pending_acceptance',
        terminate: sc.status === 'active',
        complete: sc.status === 'active' && allPaid,
        close: sc.status === 'completed' && round2(sc.retention.balance) === 0,
        rate: (sc.status === 'completed' || sc.status === 'closed' || sc.status === 'terminated') && !sc.myRating.submitted,
    };
}

/** The claim behind an installment row (the latest non-rejected one, as the server marks it). */
export function claimOfInstallment(claims: readonly ClaimDto[], installment: { no: number; claimId: string | null }): ClaimDto | undefined {
    if (installment.claimId !== null) {
        const byId = claims.find(c => c.id === installment.claimId);
        if (byId !== undefined) return byId;
    }
    return claims
        .filter(c => c.installmentNo === installment.no && c.status !== 'rejected')
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
}

/** Open fixes of earlier installments that block approving the next one (plan §6 rule 9, when settings say so). */
export function openFixesBefore(claims: readonly ClaimDto[], installmentNo: number): number {
    return claims
        .filter(c => c.installmentNo < installmentNo && c.status !== 'rejected')
        .reduce((n, c) => n + (c.inspection?.fixes.filter(f => !f.done).length ?? 0), 0);
}

// ── Claim preview (approve dialog) ──

/** What the approve preview reads of the contract (SubcontractDto fits). */
export type PreviewContract = Pick<SubcontractDto, 'installments'> & {
    terms: Pick<SubcontractTerms, 'retentionPct' | 'whtPct' | 'vat'>;
    lines: readonly SubcontractLineDto[];
};

/**
 * Amounts the server will store when the claim is approved with these adjustments: the domain rule (contractClaimAmounts:
 * retention on gross, WHT on the labour share of gross + adjustments, VAT on gross + adjustments) on the installment's
 * CURRENT amount (the last installment absorbs variations accepted after the claim was requested). Rows without a
 * label or with a 0 / non-finite amount are left out, as the request leaves them out.
 */
export function previewApproveAmounts(
    sc: PreviewContract,
    claim: Pick<ClaimDto, 'installmentNo' | 'amounts'>,
    adjustments: readonly { label: string; amount: number }[],
): ClaimAmounts {
    const gross = sc.installments.find(i => i.no === claim.installmentNo)?.amount ?? claim.amounts.gross;
    const kept = adjustments
        .filter(a => a.label.trim() !== '' && Number.isFinite(a.amount) && a.amount !== 0)
        .map(a => ({ label: a.label.trim(), amount: a.amount }));
    return contractClaimAmounts(sc, gross, kept);
}

// ── Variations ──

/** Σ qty × unit price of proposed lines (qty may be negative: work removed). */
export function variationAmount(lines: readonly { qty: number; unitPrice: number }[]): number {
    return round2(lines.reduce((s, l) => s + (Number.isFinite(l.qty) && Number.isFinite(l.unitPrice) ? l.qty * l.unitPrice : 0), 0));
}

// ── Retention (workspace page) ──

/** Rows with a balance (all rows with keepZero: the role sees no money), soonest due first; no due date last; then by contract no. */
export function sortRetentionRows(rows: readonly WorkspaceRetentionRow[], opts: { keepZero?: boolean } = {}): WorkspaceRetentionRow[] {
    return rows
        .filter(r => opts.keepZero === true || round2(r.balance) > 0)
        .sort((a, b) => {
            if (a.nextDueAt !== b.nextDueAt) {
                if (a.nextDueAt === null) return 1;
                if (b.nextDueAt === null) return -1;
                return a.nextDueAt.localeCompare(b.nextDueAt);
            }
            return a.contractNo.localeCompare(b.contractNo);
        });
}

/** Due date passed (before today) → shown in the problem colour. */
export function isOverdue(dueAt: string | null, today: string): boolean {
    return dueAt !== null && dueAt < today;
}

// ── Settings form (percentages typed as %, stored as fractions) ──

export interface SettingsForm {
    retentionPct: number;
    warrantyMonths: number;
    whtPct: number;
    estimatorCanAward: boolean;
    estimatorCanApproveClaims: boolean;
    viewerSeesPrices: boolean;
    levelingPct: number;
    fixesBlockNextClaim: boolean;
    contractTemplateHtml: string;
}

export function settingsToForm(s: SubcontractingSettingsDto): SettingsForm {
    return {
        retentionPct: round2(s.defaultRetentionPct * 100),
        warrantyMonths: s.defaultWarrantyMonths,
        whtPct: round2(s.defaultWhtPct * 100),
        estimatorCanAward: s.estimatorCanAward,
        estimatorCanApproveClaims: s.estimatorCanApproveClaims,
        viewerSeesPrices: s.viewerSeesPrices,
        levelingPct: round2(s.levelingThreshold * 100),
        fixesBlockNextClaim: s.fixesBlockNextClaim,
        contractTemplateHtml: s.contractTemplateHtml,
    };
}

/** % → fraction with 4 decimals (5.5 → 0.055), whole months. */
export function settingsFromForm(f: SettingsForm): SubcontractingSettingsDto {
    const frac = (pct: number) => Math.round(pct * 100) / 10_000;
    return {
        defaultRetentionPct: frac(f.retentionPct),
        defaultWarrantyMonths: Math.round(f.warrantyMonths),
        defaultWhtPct: frac(f.whtPct),
        estimatorCanAward: f.estimatorCanAward,
        estimatorCanApproveClaims: f.estimatorCanApproveClaims,
        viewerSeesPrices: f.viewerSeesPrices,
        levelingThreshold: frac(f.levelingPct),
        fixesBlockNextClaim: f.fixesBlockNextClaim,
        contractTemplateHtml: f.contractTemplateHtml,
    };
}

// ── Contract template placeholders (settings editor help) ──
// TODO(C3): keep in step with src/domain/subcontracting/contract-template.ts once the contracts stream writes it.
export const TEMPLATE_PLACEHOLDERS: readonly { key: string; label: string }[] = [
    { key: 'contractNo', label: 'เลขที่สัญญา' },
    { key: 'date', label: 'วันที่ทำสัญญา' },
    { key: 'buyerName', label: 'ผู้ว่าจ้าง' },
    { key: 'vendorName', label: 'ผู้รับจ้าง' },
    { key: 'projectName', label: 'ชื่อโครงการ' },
    { key: 'location', label: 'สถานที่ก่อสร้าง' },
    { key: 'title', label: 'ชื่องาน' },
    { key: 'lines', label: 'ตารางรายการงาน-ปริมาณ-ราคา' },
    { key: 'total', label: 'มูลค่าสัญญา (ตัวเลข)' },
    { key: 'totalText', label: 'มูลค่าสัญญา (ตัวอักษร)' },
    { key: 'installments', label: 'ตารางงวดงาน-งวดเงิน' },
    { key: 'start', label: 'วันเริ่มงาน' },
    { key: 'finish', label: 'วันแล้วเสร็จ' },
    { key: 'retentionPct', label: 'เงินประกันผลงาน %' },
    { key: 'warrantyMonths', label: 'ระยะประกันผลงาน (เดือน)' },
    { key: 'penalty', label: 'ค่าปรับ' },
    { key: 'provisions', label: 'น้ำ ไฟ ที่พัก นั่งร้าน' },
    { key: 'safetyNote', label: 'ความปลอดภัย' },
];
