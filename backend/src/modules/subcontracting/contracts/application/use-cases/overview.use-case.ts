// ─── Project overview (plan §4.1) and estimate vs contracted vs paid report (§4.8), buyer side ───
// Estimates come from the live BOQ (computeProject on the server); contracted values from the subcontracts (a
// terminated one counts the value of the work paid for: Σ gross + adjustments of its paid claims); packages and
// invitations from sourcing. "paid" is that same value of work paid for, not the cash net of retention / WHT.
// Overview trade rows: `estimate` is the whole-trade BOQ estimate while nothing is contracted; once the trade has live
// subcontracts it is the estimate of the CONTRACTED SCOPE (Σ estTotal of the package lines that were awarded), so
// `contracted` vs `estimate` compares like with like (a trade with half its rows contracted does not show −55 %).
// A buyer member without sc.readPrices sees every money figure as 0.
import { Injectable } from '@nestjs/common';
import type { ProcurementOverviewDto, ProcurementReportDto } from '@contrack/contract';
import type { BoqResult } from '@contrack/domain/boq/types';
import { computeProject } from '@contrack/domain/project';
import { round2, snapshotDrift } from '@contrack/domain/subcontracting/snapshot';
import { TRADES } from '@contrack/domain/subcontracting/trades';
import { Clock, ProjectReader } from '../../../../../shared/application/ports';
import { DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, err, ok } from '../../../../../shared/domain';
import { type InvitationView, PackageDirectory, type PackageView } from '../../../shared/ports';
import { ScAccess } from '../../../shared/sc-access';
import type { Claim } from '../../domain/entities/claim.entity';
import type { RetentionEntry } from '../../domain/entities/contract-records.entity';
import type { Subcontract } from '../../domain/entities/subcontract.entity';
import { buyerContractHref } from '../contract-notices';
import { paidValue, retentionOf } from '../contract-state';
import { ClaimRepository } from '../ports/claim.repository';
import { RetentionRepository } from '../ports/retention.repository';
import { SubcontractRepository } from '../ports/subcontract.repository';
import { tradeEstimates } from '../trade-estimates';
import { bangkokDate, formatBaht } from '../thai-format';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A claim waiting this long for the buyer marks the trade as a problem. */
const STALE_CLAIM_DAYS = 7;
/** Planned retention releases this close (or past) show up in the to-do list. */
const RETENTION_DUE_DAYS = 7;

interface ProjectFacts {
    workspaceId: WorkspaceId;
    boq: BoqResult;
    packages: PackageView[];
    subcontracts: Subcontract[];
    live: Subcontract[];
    claims: Claim[];
    entries: RetentionEntry[];
    /** The caller may see money (sc.readPrices, widened by settings). */
    seesPrices: boolean;
}

@Injectable()
export class ProjectFactsLoader {
    constructor(
        private readonly access: ScAccess,
        private readonly projects: ProjectReader,
        private readonly packages: PackageDirectory,
        private readonly subcontracts: SubcontractRepository,
        private readonly claims: ClaimRepository,
        private readonly retention: RetentionRepository,
    ) {}

    async load(userId: UserId, projectId: ProjectId, permission: 'sc.read' | 'sc.readPrices'): Promise<Result<ProjectFacts, DomainError>> {
        const granted = await this.access.buyerProject(userId, projectId, [permission]);
        if (!granted.ok) return granted;
        const { workspaceId, role } = granted.value;
        const seesPrices = permission === 'sc.readPrices' || await this.access.allowed(role, 'sc.readPrices', workspaceId);
        const read = await this.projects.read(projectId);
        if (read?.workspaceId !== workspaceId) return err(DomainError.notFound('Project'));
        const [packages, subcontracts] = await Promise.all([
            this.packages.listPackagesOfProject(workspaceId, projectId), this.subcontracts.listByProject(workspaceId, projectId),
        ]);
        const live = subcontracts.filter(s => s.status !== 'cancelled');
        const ids = live.map(s => s.id);
        const [claims, entries] = await Promise.all([this.claims.listBySubcontracts(ids), this.retention.listBySubcontracts(ids)]);
        return ok({ workspaceId, boq: computeProject(read.project).boq, packages, subcontracts, live, claims, entries, seesPrices });
    }
}

/** What a subcontract adds to "contracted": its value, or the value of the work paid for when it was terminated. */
function contractedValue(sc: Subcontract, claims: readonly Claim[]): number {
    return sc.status === 'terminated' ? paidValue(claims.filter(c => c.subcontractId === sc.id)) : sc.total;
}

/** Estimate of what the subcontracts cover: Σ estTotal of their package's lines (same idx) that were awarded. */
export function contractedScopeEstimate(scs: readonly Subcontract[], packages: readonly PackageView[]): number {
    const byId = new Map(packages.map(p => [p.id, p]));
    return round2(scs.reduce((sum, sc) => {
        const est = new Map((byId.get(sc.packageId)?.lines ?? []).map(l => [l.idx, l.estTotal]));
        return sum + sc.state.lines.reduce((s, l) => s + (est.get(l.idx) ?? 0), 0);
    }, 0));
}

function sumBy<T>(items: readonly T[], f: (t: T) => number): number {
    return round2(items.reduce((s, t) => s + f(t), 0));
}

@Injectable()
export class GetOverviewUseCase {
    constructor(private readonly facts: ProjectFactsLoader, private readonly packages: PackageDirectory, private readonly clock: Clock) {}

    async execute(input: { userId: UserId; projectId: ProjectId }): Promise<Result<ProcurementOverviewDto, DomainError>> {
        const loaded = await this.facts.load(input.userId, input.projectId, 'sc.read');
        if (!loaded.ok) return loaded;
        const f = loaded.value;
        const now = this.clock.now();
        const today = bangkokDate(now);
        const estimates = tradeEstimates(f.boq, f.packages, f.live);
        const activePackages = f.packages.filter(p => p.status !== 'cancelled');
        const invitations = new Map<string, InvitationView[]>(await Promise.all(
            activePackages.filter(p => p.status === 'open' || p.status === 'reviewing')
                .map(async p => [p.id, await this.packages.listInvitations(p.id)] as const),
        ));

        const trades: ProcurementOverviewDto['trades'] = [];
        for (const t of TRADES) {
            const pkgs = f.packages.filter(p => p.trade === t.id);
            const scs = f.live.filter(s => s.state.trade === t.id);
            const tradeEstimate = estimates.byTrade.get(t.id) ?? 0;
            if (tradeEstimate === 0 && pkgs.length === 0 && scs.length === 0) continue;
            const estimate = scs.length > 0 ? contractedScopeEstimate(scs, f.packages) : tradeEstimate;
            const money = (v: number): number => (f.seesPrices ? v : 0);
            const live = pkgs.filter(p => p.status !== 'cancelled');
            const claims = f.claims.filter(c => scs.some(s => s.id === c.subcontractId));
            const problem = this.problemOf(live, invitations, claims, now);
            const anySubmitted = live.some(p => (invitations.get(p.id) ?? []).some(i => i.status === 'submitted'));
            const status = problem !== null ? 'problem'
                : scs.length > 0 ? 'contracted'
                    : live.some(p => p.status === 'reviewing') || anySubmitted ? 'has_bids'
                        : live.some(p => p.status === 'open') ? 'waiting_bids' : 'not_sourced';
            trades.push({
                trade: t.id,
                estimate: money(estimate),
                contracted: money(sumBy(scs, s => contractedValue(s, f.claims))),
                status,
                problem,
                packages: pkgs.map(p => ({ id: p.id, title: p.title, status: p.status })),
                subcontracts: scs.map(s => ({ id: s.id, vendorName: s.vendorName, total: money(s.total) })),
            });
        }

        const contractedTotal = sumBy(f.live, s => contractedValue(s, f.claims));
        return ok({
            projectId: input.projectId,
            estimateTotal: f.seesPrices ? estimates.total : 0,
            contractedTotal: f.seesPrices ? contractedTotal : 0,
            coverage: estimates.total > 0 ? Math.min(1, Math.round((estimates.covered / estimates.total) * 10000) / 10000) : 0,
            trades,
            todo: this.todo(f, today, now),
        });
    }

    private problemOf(packages: readonly PackageView[], invitations: ReadonlyMap<string, InvitationView[]>, claims: readonly Claim[], now: Date): string | null {
        if (packages.some(p => p.status === 'expired')) return 'ปิดรับราคาแล้วไม่มีผู้เสนอราคา';
        for (const p of packages) {
            const list = invitations.get(p.id) ?? [];
            if (list.length > 0 && list.every(i => i.status === 'declined' || i.status === 'withdrawn')) return 'ทีมช่างปฏิเสธทั้งหมด';
            if (p.status === 'open' && p.bidDeadline < now && !list.some(i => i.status === 'submitted')) return 'เลยวันปิดรับราคาแล้วยังไม่มีราคา';
        }
        const stale = claims.some(c => (c.status === 'requested' || (c.status === 'inspected' && c.inspection?.result !== 'fail'))
            && now.getTime() - c.requestedAt.getTime() > STALE_CLAIM_DAYS * DAY_MS);
        return stale ? `ใบเบิกค้างอนุมัติเกิน ${STALE_CLAIM_DAYS} วัน` : null;
    }

    private todo(f: ProjectFacts, today: string, now: Date): ProcurementOverviewDto['todo'] {
        const out: ProcurementOverviewDto['todo'] = [];
        const byId = new Map(f.live.map(s => [s.id, s]));
        for (const c of f.claims) {
            const sc = byId.get(c.subcontractId);
            if (sc?.status !== 'active') continue;
            const who = `${sc.title} (${sc.vendorName})`;
            const href = buyerContractHref(sc.id);
            if (c.status === 'requested') out.push({ kind: 'claim_to_inspect', label: `ตรวจรับงวด ${c.installmentNo} · ${who}`, href });
            else if (c.status === 'inspected' && c.inspection?.result !== 'fail') out.push({ kind: 'claim_to_approve', label: `อนุมัติใบเบิกงวด ${c.installmentNo} · ${who}`, href });
            else if (c.status === 'approved') out.push({ kind: 'claim_to_pay', label: `บันทึกจ่ายงวด ${c.installmentNo} · ${who}`, href });
        }
        for (const p of f.packages) {
            const href = `/subcontracting/packages/${p.id}`;
            if (p.status === 'open') {
                if (p.bidDeadline < now) out.push({ kind: 'deadline_passed', label: `เลยวันปิดรับราคาแล้ว · ${p.title}`, href });
                else if (bangkokDate(p.bidDeadline) === today) out.push({ kind: 'deadline_today', label: `ปิดรับราคาวันนี้ · ${p.title}`, href });
            }
            if (p.status === 'draft' || p.status === 'open' || p.status === 'reviewing') {
                const drift = snapshotDrift(p.lines, f.boq).length;
                if (drift > 0) out.push({ kind: 'boq_changed', label: `BOQ เปลี่ยน ${drift} แถว · ${p.title}`, href });
            }
        }
        const soon = new Date(Date.parse(`${today}T00:00:00Z`) + RETENTION_DUE_DAYS * DAY_MS).toISOString().slice(0, 10);
        for (const sc of f.live) {
            const href = buyerContractHref(sc.id);
            if (sc.status === 'pending_acceptance') {
                out.push({ kind: 'awaiting_acceptance', label: `รอทีมช่างยอมรับสัญญา · ${sc.title} (${sc.vendorName})`, href });
            }
            const due = retentionOf(sc, f.entries.filter(e => e.subcontractId === sc.id)).schedule
                .filter(s => s.dueAt !== null && s.dueAt <= soon);
            for (const d of due) {
                const amount = f.seesPrices ? ` ${formatBaht(d.amount)}` : '';
                out.push({ kind: 'retention_due', label: `ครบกำหนดคืนเงินประกันผลงาน${amount} · ${sc.title}`, href });
            }
        }
        return out;
    }
}

@Injectable()
export class GetReportUseCase {
    constructor(private readonly facts: ProjectFactsLoader) {}

    async execute(input: { userId: UserId; projectId: ProjectId }): Promise<Result<ProcurementReportDto, DomainError>> {
        const loaded = await this.facts.load(input.userId, input.projectId, 'sc.readPrices');
        if (!loaded.ok) return loaded;
        const f = loaded.value;
        const estimates = tradeEstimates(f.boq, f.packages, f.live);
        const rows: ProcurementReportDto['rows'] = [];
        for (const t of TRADES) {
            const scs = f.live.filter(s => s.state.trade === t.id);
            const estimate = estimates.byTrade.get(t.id) ?? 0;
            const contracted = sumBy(scs, s => contractedValue(s, f.claims));
            const paid = paidValue(f.claims.filter(c => scs.some(s => s.id === c.subcontractId)));
            if (estimate === 0 && contracted === 0 && paid === 0) continue;
            rows.push({ trade: t.id, estimate, contracted, paid, diff: round2(contracted - estimate) });
        }
        const estimate = sumBy(rows, r => r.estimate);
        const contracted = sumBy(rows, r => r.contracted);
        return ok({
            rows,
            totals: { estimate, contracted, paid: sumBy(rows, r => r.paid), diff: round2(contracted - estimate) },
        });
    }
}
