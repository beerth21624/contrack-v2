// ─── Pure helpers of the package page: primary action, addendum body, manual bid form → request and total ───
import type {
    AddendumRequest, BidMode, BuyerPackageDto, InstallmentDto, ManualBidRequest, MaterialBy, PackageStatus, Penalty,
    PricingMode, ScInvitationDto,
} from '@/shared/contract';
import { priceLine, round2 } from '@/domain/subcontracting/snapshot';
import { money0, pct } from '../format';
import { scText, type ScT } from '../text';
// ── state of the package ──

/** Package sent and not decided yet (invitations, bids and addenda still move). */
export const SENT_UNDECIDED: readonly PackageStatus[] = ['open', 'reviewing', 'expired'];

export function isSentUndecided(status: PackageStatus): boolean {
    return SENT_UNDECIDED.includes(status);
}

/** Invitation states out of the running: the buyer withdrew it, the crew declined it, or it was closed. */
const OUT_OF_RUNNING: readonly ScInvitationDto['status'][] = ['withdrawn', 'declined', 'closed'];

/** The invitation still takes part (counts against the invite limit; its crew cannot be invited again). */
export function isInRunning(i: Pick<ScInvitationDto, 'status'>): boolean {
    return !OUT_OF_RUNNING.includes(i.status);
}

/** Invitations that still take part (not withdrawn / declined / closed). */
export function activeInvitations<T extends Pick<ScInvitationDto, 'status'>>(list: readonly T[]): T[] {
    return list.filter(isInRunning);
}

/** Vendor-list entries holding an invitation still in the running (hidden from the invite picker). */
export function invitedEntryIds(list: readonly Pick<ScInvitationDto, 'status' | 'vendorListEntryId'>[]): Set<string> {
    return new Set(activeInvitations(list).map(i => i.vendorListEntryId));
}

/** Invitations with a submitted price (latest bid present, invitation not withdrawn). */
export function bidCount(list: readonly Pick<ScInvitationDto, 'status' | 'latestBid'>[]): number {
    return list.filter(i => i.latestBid !== null && i.status !== 'withdrawn').length;
}

/** Invitations the vendor has not opened yet. */
export function unopenedIds(list: readonly Pick<ScInvitationDto, 'id' | 'status'>[]): string[] {
    return list.filter(i => i.status === 'sent').map(i => i.id);
}

export type PrimaryAction =
    | { kind: 'invite' }
    | { kind: 'leveling' }
    | { kind: 'resend'; ids: string[] }
    | { kind: 'contracts' }
    | { kind: 'none' };

/** Plan §4.4: draft → send invitations; ≥ 1 price → leveling; else nudge the unopened; awarded → contracts. */
export function primaryAction(
    status: PackageStatus,
    invitations: readonly Pick<ScInvitationDto, 'id' | 'status' | 'latestBid'>[],
): PrimaryAction {
    if (status === 'draft') return { kind: 'invite' };
    if (status === 'awarded' || status === 'closed') return { kind: 'contracts' };
    if (!isSentUndecided(status)) return { kind: 'none' };
    if (bidCount(invitations) > 0) return { kind: 'leveling' };
    const ids = unopenedIds(invitations);
    return ids.length > 0 ? { kind: 'resend', ids } : { kind: 'none' };
}

/** RFQ whose deadline passed with fewer than 2 prices: offer extend / invite more / continue (plan §4.4). */
export function needsMoreBids(
    pkg: Pick<BuyerPackageDto, 'status' | 'sourcingMode' | 'bidDeadline'>,
    invitations: readonly Pick<ScInvitationDto, 'status' | 'latestBid'>[],
    now: Date,
): boolean {
    if (pkg.sourcingMode !== 'rfq' || !isSentUndecided(pkg.status)) return false;
    const passed = new Date(pkg.bidDeadline).getTime() <= now.getTime();
    return passed && bidCount(invitations) < 2;
}

/** More invitees allowed: rfq up to 8 active, direct exactly one. */
export function inviteRoom(sourcingMode: BuyerPackageDto['sourcingMode'], invitations: readonly Pick<ScInvitationDto, 'status'>[]): number {
    const active = activeInvitations(invitations).length;
    const max = sourcingMode === 'direct' ? 1 : 8;
    return Math.max(0, max - active);
}

// ── addendum ──

/** Addendum keeping every line not in `removed`: BOQ keys (re-read from the live BOQ by the server) and typed lines. */
export function addendumBody(
    pkg: Pick<BuyerPackageDto, 'lines' | 'supplyMode'>,
    removed: ReadonlySet<number>,
    note: string,
): AddendumRequest {
    const kept = pkg.lines.filter(l => !removed.has(l.idx));
    const materialByLine: Record<string, MaterialBy> = pkg.supplyMode === 'per_line'
        ? Object.fromEntries(kept.flatMap(l => (l.lineKey === null ? [] : [[l.lineKey, l.materialBy] as const])))
        : {};
    return {
        lineKeys: kept.flatMap(l => (l.lineKey === null ? [] : [l.lineKey])),
        customLines: kept.filter(l => l.lineKey === null).map(l => ({ desc: l.desc, unit: l.unit, qty: l.qtyNet, estUnit: l.estLabUnit })),
        materialByLine,
        note: note.trim(),
    };
}

// ── manual bid (บันทึกราคาแทน) ──

export function allowedBidModes(pricingMode: PricingMode): BidMode[] {
    switch (pricingMode) {
        case 'unit': return ['unit'];
        case 'lump': return ['lump'];
        case 'vendor_choice': return ['unit', 'lump'];
    }
}

export interface ManualBidLine {
    idx: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    excluded: boolean;
    reason: string;
}

export interface ManualBidForm {
    mode: BidMode;
    lines: ManualBidLine[];
    lumpTotal: number | null;
    adjustment: number;
    adjustmentNote: string;
    inclusions: string;
    days: number | null;
    earliestStart: string | null;
    crewSkilled: number | null;
    crewLabourers: number | null;
    validUntil: string | null;
    /** true = accepts the package installments. */
    acceptInstallments: boolean;
    installments: InstallmentDto[];
    answers: string[];
    note: string;
}

type PkgForBid = Pick<BuyerPackageDto, 'lines' | 'pricingMode' | 'priceValidUntil' | 'schedule' | 'installments' | 'terms'>;

export function initialManualBid(pkg: PkgForBid): ManualBidForm {
    return {
        mode: allowedBidModes(pkg.pricingMode)[0] ?? 'unit',
        lines: pkg.lines.map(l => ({ idx: l.idx, unitPrice: null, matUnitPrice: null, excluded: false, reason: '' })),
        lumpTotal: null,
        adjustment: 0,
        adjustmentNote: '',
        inclusions: '',
        days: pkg.schedule.days !== null && pkg.schedule.days > 0 ? pkg.schedule.days : null,
        earliestStart: pkg.schedule.start,
        crewSkilled: null,
        crewLabourers: null,
        validUntil: pkg.priceValidUntil,
        acceptInstallments: true,
        installments: pkg.installments.map(i => ({ ...i })),
        answers: pkg.terms.questions.map(() => ''),
        note: '',
    };
}

/** Total the bid will show: Σ priced lines (or the lump sum) + adjustment. */
export function manualBidTotal(pkg: Pick<BuyerPackageDto, 'lines'>, form: Pick<ManualBidForm, 'mode' | 'lines' | 'lumpTotal' | 'adjustment'>): number {
    if (form.mode === 'lump') return round2((form.lumpTotal ?? 0) + form.adjustment);
    const byIdx = new Map(form.lines.map(l => [l.idx, l]));
    let sum = 0;
    for (const line of pkg.lines) {
        const f = byIdx.get(line.idx);
        if (f === undefined || f.excluded) continue;
        sum += priceLine(line, f.unitPrice, f.matUnitPrice);
    }
    return round2(sum + form.adjustment);
}

/** Lines still missing a price in unit mode (labour price, and material price where the vendor supplies it). */
export function unpricedLines(pkg: Pick<BuyerPackageDto, 'lines'>, form: Pick<ManualBidForm, 'mode' | 'lines'>): number[] {
    if (form.mode !== 'unit') return [];
    const byIdx = new Map(form.lines.map(l => [l.idx, l]));
    return pkg.lines.filter(line => {
        const f = byIdx.get(line.idx);
        if (f === undefined) return true;
        if (f.excluded) return false;
        return f.unitPrice === null || (line.materialBy === 'vendor' && f.matUnitPrice === null);
    }).map(l => l.idx);
}

export function manualBidRequest(form: ManualBidForm): ManualBidRequest {
    return {
        mode: form.mode,
        lines: form.mode === 'unit' ? form.lines.map(l => ({ ...l, reason: l.excluded ? l.reason.trim() : '' })) : [],
        lumpTotal: form.mode === 'lump' ? form.lumpTotal : null,
        adjustment: form.adjustment,
        adjustmentNote: form.adjustmentNote.trim(),
        inclusions: form.mode === 'lump' ? form.inclusions.trim() : '',
        days: form.days,
        earliestStart: form.earliestStart,
        crewSkilled: form.crewSkilled,
        crewLabourers: form.crewLabourers,
        validUntil: form.validUntil,
        installmentsProposal: form.acceptInstallments ? null : form.installments,
        answers: form.answers.map(a => a.trim()),
        note: form.note.trim(),
        photoFileIds: [],
    };
}

// ── text ──

export function penaltyText(p: Penalty, t: ScT = scText()): string {
    switch (p.kind) {
        case 'none': return t('buyer.helpers.penaltyNone');
        case 'per_day': return t('buyer.helpers.penaltyPerDay', { amount: money0(p.amount) });
        case 'pct_per_day': return t('buyer.helpers.penaltyPctPerDay', { rate: pct(p.rate) });
    }
}

/** Lines grouped by section title, consecutive runs in package order. */
export function groupLines<L extends { sectionTitle: string }>(lines: readonly L[]): { title: string; lines: L[] }[] {
    const out: { title: string; lines: L[] }[] = [];
    for (const l of lines) {
        const last = out[out.length - 1];
        if (last?.title === l.sectionTitle) last.lines.push(l);
        else out.push({ title: l.sectionTitle, lines: [l] });
    }
    return out;
}

/** Unanswered first (oldest first), then answered (newest first). */
export function sortQuestions<Q extends { answer: string | null; askedAt: string }>(list: readonly Q[]): Q[] {
    const open = list.filter(q => q.answer === null).sort((a, b) => a.askedAt.localeCompare(b.askedAt));
    const done = list.filter(q => q.answer !== null).sort((a, b) => b.askedAt.localeCompare(a.askedAt));
    return [...open, ...done];
}
