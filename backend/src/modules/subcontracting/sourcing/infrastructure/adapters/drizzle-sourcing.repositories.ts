// ─── Postgres adapters of the sourcing repositories; `ctx.executor` joins the UnitOfWork transaction ───
// Writes always filter by the owner workspace. Lookups by id / token are unscoped on purpose (the caller only has the
// id) and the use case checks access to the owner workspace right after.
import { type SQL, and, asc, desc, eq, inArray, lte } from 'drizzle-orm';
import type { PackageStatus } from '@contrack/contract';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import {
    scInvitationTokens, scInvitations, scPackageQuestions, scPackageVersions, scVendorListEntries, scVendorPortfolio,
    scVendorProfiles, scWorkPackages,
} from '../../../../../shared/infrastructure/database/schema-sc-sourcing';
import {
    type PackageId, type PortfolioItemId, type QuestionId, type ScInvitationId, type VendorListEntryId, asPackageId,
    asPortfolioItemId, asQuestionId, asScInvitationId, asVendorListEntryId,
} from '../../../shared/ids';
import {
    InvitationRepository, QuestionRepository, VendorListRepository, VendorProfileRepository, WorkPackageRepository,
} from '../../application/ports/sourcing.repositories';
import { PackageQuestion } from '../../domain/entities/package-question.entity';
import { PortfolioItem } from '../../domain/entities/portfolio-item.entity';
import { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import { VendorListEntry } from '../../domain/entities/vendor-list-entry.entity';
import { VendorProfile } from '../../domain/entities/vendor-profile.entity';
import { WorkPackage } from '../../domain/entities/work-package.entity';

const wsOrNull = (v: string | null): WorkspaceId | null => (v === null ? null : asWorkspaceId(v));

// ── vendor profiles ──

type ProfileRow = typeof scVendorProfiles.$inferSelect;
type PortfolioRow = typeof scVendorPortfolio.$inferSelect;

const toProfile = (r: ProfileRow): VendorProfile => VendorProfile.rehydrate({
    workspaceId: asWorkspaceId(r.workspaceId), teamName: r.teamName, contactName: r.contactName, phone: r.phone,
    lineUserId: r.lineUserId, trades: r.trades, provinces: r.provinces, crewSkilled: r.crewSkilled, crewLabourers: r.crewLabourers,
    tools: r.tools, vatRegistered: r.vatRegistered, referenceRates: r.referenceRates, availableMonths: r.availableMonths,
    tier: r.tier, tierUpdatedAt: r.tierUpdatedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

const toPortfolio = (r: PortfolioRow): PortfolioItem => PortfolioItem.rehydrate({
    id: asPortfolioItemId(r.id), vendorWorkspaceId: asWorkspaceId(r.vendorWorkspaceId), title: r.title, trade: r.trade,
    year: r.year, district: r.district, province: r.province, photoFileIds: r.photoFileIds, note: r.note, createdAt: r.createdAt,
});

export class DrizzleVendorProfileRepository extends VendorProfileRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(workspaceId: WorkspaceId): Promise<VendorProfile | undefined> {
        const [row] = await this.ctx.executor.select().from(scVendorProfiles).where(eq(scVendorProfiles.workspaceId, workspaceId)).limit(1);
        return row === undefined ? undefined : toProfile(row);
    }

    async findMany(workspaceIds: readonly WorkspaceId[]): Promise<VendorProfile[]> {
        if (workspaceIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(scVendorProfiles).where(inArray(scVendorProfiles.workspaceId, [...workspaceIds]));
        return rows.map(toProfile);
    }

    async findByPhone(phone: string): Promise<VendorProfile | undefined> {
        if (phone === '') return undefined;
        const [row] = await this.ctx.executor.select().from(scVendorProfiles).where(eq(scVendorProfiles.phone, phone))
            .orderBy(asc(scVendorProfiles.createdAt)).limit(1);
        return row === undefined ? undefined : toProfile(row);
    }

    async save(profile: VendorProfile): Promise<void> {
        const p = profile.toProps();
        const values = {
            workspaceId: p.workspaceId, teamName: p.teamName, contactName: p.contactName, phone: p.phone, lineUserId: p.lineUserId,
            trades: p.trades, provinces: p.provinces, crewSkilled: p.crewSkilled, crewLabourers: p.crewLabourers, tools: p.tools,
            vatRegistered: p.vatRegistered, referenceRates: p.referenceRates, availableMonths: p.availableMonths, tier: p.tier,
            tierUpdatedAt: p.tierUpdatedAt, createdAt: p.createdAt, updatedAt: p.updatedAt,
        };
        const { workspaceId: _id, createdAt: _c, ...set } = values;
        await this.ctx.executor.insert(scVendorProfiles).values(values).onConflictDoUpdate({ target: scVendorProfiles.workspaceId, set });
    }

    async listPortfolio(workspaceId: WorkspaceId): Promise<PortfolioItem[]> {
        const rows = await this.ctx.executor.select().from(scVendorPortfolio).where(eq(scVendorPortfolio.vendorWorkspaceId, workspaceId))
            .orderBy(asc(scVendorPortfolio.createdAt), asc(scVendorPortfolio.id));
        return rows.map(toPortfolio);
    }

    async findPortfolioItem(id: PortfolioItemId): Promise<PortfolioItem | undefined> {
        const [row] = await this.ctx.executor.select().from(scVendorPortfolio).where(eq(scVendorPortfolio.id, id)).limit(1);
        return row === undefined ? undefined : toPortfolio(row);
    }

    async insertPortfolioItem(item: PortfolioItem): Promise<void> {
        await this.ctx.executor.insert(scVendorPortfolio).values(item.toProps());
    }

    async deletePortfolioItem(workspaceId: WorkspaceId, id: PortfolioItemId): Promise<void> {
        await this.ctx.executor.delete(scVendorPortfolio)
            .where(and(eq(scVendorPortfolio.vendorWorkspaceId, workspaceId), eq(scVendorPortfolio.id, id)));
    }
}

// ── vendor lists ──

type EntryRow = typeof scVendorListEntries.$inferSelect;

const toEntry = (r: EntryRow): VendorListEntry => VendorListEntry.rehydrate({
    id: asVendorListEntryId(r.id), buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId), vendorWorkspaceId: wsOrNull(r.vendorWorkspaceId),
    displayName: r.displayName, phone: r.phone, lineId: r.lineId, trades: r.trades, province: r.province, privateNote: r.privateNote,
    hiddenAt: r.hiddenAt, createdBy: asUserId(r.createdBy), createdAt: r.createdAt, updatedAt: r.updatedAt,
});

export class DrizzleVendorListRepository extends VendorListRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async list(buyerWorkspaceId: WorkspaceId): Promise<VendorListEntry[]> {
        const rows = await this.ctx.executor.select().from(scVendorListEntries).where(eq(scVendorListEntries.buyerWorkspaceId, buyerWorkspaceId))
            .orderBy(asc(scVendorListEntries.createdAt), asc(scVendorListEntries.id));
        return rows.map(toEntry);
    }

    async findById(id: VendorListEntryId): Promise<VendorListEntry | undefined> {
        const [row] = await this.ctx.executor.select().from(scVendorListEntries).where(eq(scVendorListEntries.id, id)).limit(1);
        return row === undefined ? undefined : toEntry(row);
    }

    async findMany(ids: readonly VendorListEntryId[]): Promise<VendorListEntry[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(scVendorListEntries).where(inArray(scVendorListEntries.id, [...ids]));
        return rows.map(toEntry);
    }

    async findByPhone(buyerWorkspaceId: WorkspaceId, phone: string): Promise<VendorListEntry | undefined> {
        const [row] = await this.ctx.executor.select().from(scVendorListEntries)
            .where(and(eq(scVendorListEntries.buyerWorkspaceId, buyerWorkspaceId), eq(scVendorListEntries.phone, phone))).limit(1);
        return row === undefined ? undefined : toEntry(row);
    }

    /** Cross-tenant on purpose: linking a crew that just proved it owns this phone. */
    async findAllByPhone(phone: string): Promise<VendorListEntry[]> {
        const rows = await this.ctx.executor.select().from(scVendorListEntries).where(eq(scVendorListEntries.phone, phone));
        return rows.map(toEntry);
    }

    async findLinked(buyerWorkspaceId: WorkspaceId, vendorWorkspaceId: WorkspaceId): Promise<VendorListEntry | undefined> {
        const [row] = await this.ctx.executor.select().from(scVendorListEntries)
            .where(and(eq(scVendorListEntries.buyerWorkspaceId, buyerWorkspaceId), eq(scVendorListEntries.vendorWorkspaceId, vendorWorkspaceId)))
            .limit(1);
        return row === undefined ? undefined : toEntry(row);
    }

    async insert(entry: VendorListEntry): Promise<void> {
        await this.ctx.executor.insert(scVendorListEntries).values(entry.toProps());
    }

    async update(entry: VendorListEntry): Promise<void> {
        const { id: _id, buyerWorkspaceId: _ws, createdAt: _c, createdBy: _b, ...set } = entry.toProps();
        await this.ctx.executor.update(scVendorListEntries).set(set)
            .where(and(eq(scVendorListEntries.buyerWorkspaceId, entry.buyerWorkspaceId), eq(scVendorListEntries.id, entry.id)));
    }

    async delete(buyerWorkspaceId: WorkspaceId, id: VendorListEntryId): Promise<void> {
        await this.ctx.executor.delete(scVendorListEntries)
            .where(and(eq(scVendorListEntries.buyerWorkspaceId, buyerWorkspaceId), eq(scVendorListEntries.id, id)));
    }
}

// ── work packages (+ versions) ──

type PackageRow = typeof scWorkPackages.$inferSelect;
type VersionRow = typeof scPackageVersions.$inferSelect;

const toPackage = (r: PackageRow, versions: readonly VersionRow[]): WorkPackage => WorkPackage.rehydrate({
    id: asPackageId(r.id), buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId), projectId: asProjectId(r.projectId),
    projectName: r.projectName, title: r.title, trade: r.trade, status: r.status, sourcingMode: r.sourcingMode,
    pricingMode: r.pricingMode, supplyMode: r.supplyMode, description: r.description, hideOwnerIdentity: r.hideOwnerIdentity,
    terms: r.terms, schedule: r.schedule, installments: r.installments, location: r.location, selection: r.selection,
    bidDeadline: r.bidDeadline, priceValidUntil: r.priceValidUntil, estimateTotal: r.estimateTotal, fileIds: r.fileIds,
    createdBy: asUserId(r.createdBy), createdAt: r.createdAt, updatedAt: r.updatedAt, sentAt: r.sentAt, awardedAt: r.awardedAt,
    closedAt: r.closedAt, cancelledAt: r.cancelledAt, cancelReason: r.cancelReason,
    versions: versions.filter(v => v.packageId === r.id).sort((a, b) => a.version - b.version).map(v => ({
        version: v.version, lines: v.lines, changedIdx: v.changedIdx, note: v.note, createdBy: asUserId(v.createdBy), createdAt: v.createdAt,
    })),
});

export class DrizzleWorkPackageRepository extends WorkPackageRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    private async withVersions(rows: PackageRow[]): Promise<WorkPackage[]> {
        if (rows.length === 0) return [];
        const versions = await this.ctx.executor.select().from(scPackageVersions)
            .where(inArray(scPackageVersions.packageId, rows.map(r => r.id)));
        return rows.map(r => toPackage(r, versions));
    }

    async findById(id: PackageId): Promise<WorkPackage | undefined> {
        const rows = await this.ctx.executor.select().from(scWorkPackages).where(eq(scWorkPackages.id, id)).limit(1);
        return (await this.withVersions(rows))[0];
    }

    async lockById(id: PackageId): Promise<WorkPackage | undefined> {
        const rows = await this.ctx.executor.select().from(scWorkPackages).where(eq(scWorkPackages.id, id)).for('update');
        return (await this.withVersions(rows))[0];
    }

    async listByProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<WorkPackage[]> {
        const rows = await this.ctx.executor.select().from(scWorkPackages)
            .where(and(eq(scWorkPackages.buyerWorkspaceId, buyerWorkspaceId), eq(scWorkPackages.projectId, projectId)))
            .orderBy(desc(scWorkPackages.createdAt), desc(scWorkPackages.id));
        return this.withVersions(rows);
    }

    async listOpenDueBy(before: Date): Promise<WorkPackage[]> {
        const rows = await this.ctx.executor.select().from(scWorkPackages)
            .where(and(eq(scWorkPackages.status, 'open'), lte(scWorkPackages.bidDeadline, before)));
        return this.withVersions(rows);
    }

    private row(pkg: WorkPackage): typeof scWorkPackages.$inferInsert {
        const { versions: _v, ...p } = pkg.toProps();
        return { ...p, version: pkg.version };
    }

    private async saveVersions(pkg: WorkPackage): Promise<void> {
        for (const v of pkg.toProps().versions) {
            await this.ctx.executor.insert(scPackageVersions).values({ ...v, packageId: pkg.id, buyerWorkspaceId: pkg.buyerWorkspaceId })
                .onConflictDoUpdate({
                    target: [scPackageVersions.packageId, scPackageVersions.version],
                    set: { lines: v.lines, changedIdx: v.changedIdx, note: v.note, createdAt: v.createdAt },
                });
        }
    }

    async insert(pkg: WorkPackage): Promise<void> {
        await this.ctx.executor.insert(scWorkPackages).values(this.row(pkg));
        await this.saveVersions(pkg);
    }

    async update(pkg: WorkPackage): Promise<void> {
        const { id: _id, buyerWorkspaceId: _ws, projectId: _p, createdAt: _c, createdBy: _b, ...set } = this.row(pkg);
        await this.ctx.executor.update(scWorkPackages).set(set)
            .where(and(eq(scWorkPackages.buyerWorkspaceId, pkg.buyerWorkspaceId), eq(scWorkPackages.id, pkg.id)));
        await this.saveVersions(pkg);
    }

    async updateIfStatus(pkg: WorkPackage, expected: PackageStatus): Promise<boolean> {
        const { id: _id, buyerWorkspaceId: _ws, projectId: _p, createdAt: _c, createdBy: _b, ...set } = this.row(pkg);
        const updated = await this.ctx.executor.update(scWorkPackages).set(set)
            .where(and(
                eq(scWorkPackages.buyerWorkspaceId, pkg.buyerWorkspaceId), eq(scWorkPackages.id, pkg.id), eq(scWorkPackages.status, expected),
            ))
            .returning({ id: scWorkPackages.id });
        if (updated.length === 0) return false;
        await this.saveVersions(pkg);
        return true;
    }

    async delete(buyerWorkspaceId: WorkspaceId, id: PackageId): Promise<void> {
        await this.ctx.executor.delete(scWorkPackages).where(and(eq(scWorkPackages.buyerWorkspaceId, buyerWorkspaceId), eq(scWorkPackages.id, id)));
    }
}

// ── invitations (+ link tokens) ──

type InvitationRow = typeof scInvitations.$inferSelect;

const toInvitation = (r: InvitationRow): ScInvitation => ScInvitation.rehydrate({
    id: asScInvitationId(r.id), packageId: asPackageId(r.packageId), buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
    vendorListEntryId: asVendorListEntryId(r.vendorListEntryId), vendorWorkspaceId: wsOrNull(r.vendorWorkspaceId),
    displayName: r.displayName, phone: r.phone, channel: r.channel, status: r.status, sentAt: r.sentAt, viewedAt: r.viewedAt,
    declinedAt: r.declinedAt, declineReason: r.declineReason, declineNote: r.declineNote, withdrawnAt: r.withdrawnAt,
    expiresAt: r.expiresAt, resentCount: r.resentCount, deadlineSoonAt: r.deadlineSoonAt,
});

export class DrizzleInvitationRepository extends InvitationRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    private async listWhere(where: SQL): Promise<ScInvitation[]> {
        const rows = await this.ctx.executor.select().from(scInvitations).where(where).orderBy(asc(scInvitations.sentAt), asc(scInvitations.id));
        return rows.map(toInvitation);
    }

    async findById(id: ScInvitationId): Promise<ScInvitation | undefined> {
        const [row] = await this.ctx.executor.select().from(scInvitations).where(eq(scInvitations.id, id)).limit(1);
        return row === undefined ? undefined : toInvitation(row);
    }

    async lockById(id: ScInvitationId): Promise<ScInvitation | undefined> {
        const [row] = await this.ctx.executor.select().from(scInvitations).where(eq(scInvitations.id, id)).for('update');
        return row === undefined ? undefined : toInvitation(row);
    }

    /** The link token is the only key a guest has. */
    async findByTokenHash(tokenHash: string): Promise<ScInvitation | undefined> {
        const [row] = await this.ctx.executor.select({ inv: scInvitations }).from(scInvitationTokens)
            .innerJoin(scInvitations, eq(scInvitations.id, scInvitationTokens.invitationId))
            .where(eq(scInvitationTokens.tokenHash, tokenHash)).limit(1);
        return row === undefined ? undefined : toInvitation(row.inv);
    }

    listByPackage(packageId: PackageId): Promise<ScInvitation[]> {
        return this.listWhere(eq(scInvitations.packageId, packageId));
    }

    async lockByPackage(packageId: PackageId): Promise<ScInvitation[]> {
        const rows = await this.ctx.executor.select().from(scInvitations).where(eq(scInvitations.packageId, packageId))
            .orderBy(asc(scInvitations.sentAt), asc(scInvitations.id)).for('update');
        return rows.map(toInvitation);
    }

    async listByPackages(packageIds: readonly PackageId[]): Promise<ScInvitation[]> {
        if (packageIds.length === 0) return [];
        return this.listWhere(inArray(scInvitations.packageId, [...packageIds]));
    }

    listByVendor(vendorWorkspaceId: WorkspaceId): Promise<ScInvitation[]> {
        return this.listWhere(eq(scInvitations.vendorWorkspaceId, vendorWorkspaceId));
    }

    async listByEntries(entryIds: readonly VendorListEntryId[]): Promise<ScInvitation[]> {
        if (entryIds.length === 0) return [];
        return this.listWhere(inArray(scInvitations.vendorListEntryId, [...entryIds]));
    }

    async insert(invitation: ScInvitation, tokenHash: string): Promise<void> {
        await this.ctx.executor.insert(scInvitations).values(invitation.toProps());
        await this.ctx.executor.insert(scInvitationTokens).values({ tokenHash, invitationId: invitation.id, createdAt: invitation.props.sentAt });
    }

    async update(invitation: ScInvitation): Promise<void> {
        const { id: _id, packageId: _p, buyerWorkspaceId: _ws, vendorListEntryId: _e, ...set } = invitation.toProps();
        await this.ctx.executor.update(scInvitations).set(set)
            .where(and(eq(scInvitations.buyerWorkspaceId, invitation.props.buyerWorkspaceId), eq(scInvitations.id, invitation.id)));
    }

    async addToken(invitationId: ScInvitationId, tokenHash: string, at: Date): Promise<void> {
        await this.ctx.executor.insert(scInvitationTokens).values({ tokenHash, invitationId, createdAt: at });
    }

    async replaceTokens(invitationId: ScInvitationId, tokenHash: string, at: Date): Promise<void> {
        await this.ctx.executor.delete(scInvitationTokens).where(eq(scInvitationTokens.invitationId, invitationId));
        await this.ctx.executor.insert(scInvitationTokens).values({ tokenHash, invitationId, createdAt: at });
    }
}

// ── questions ──

type QuestionRow = typeof scPackageQuestions.$inferSelect;

const toQuestion = (r: QuestionRow): PackageQuestion => PackageQuestion.rehydrate({
    id: asQuestionId(r.id), packageId: asPackageId(r.packageId), buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
    invitationId: asScInvitationId(r.invitationId), question: r.question, answer: r.answer,
    answeredBy: r.answeredBy === null ? null : asUserId(r.answeredBy), askedAt: r.askedAt, answeredAt: r.answeredAt,
});

export class DrizzleQuestionRepository extends QuestionRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async listByPackage(packageId: PackageId): Promise<PackageQuestion[]> {
        const rows = await this.ctx.executor.select().from(scPackageQuestions).where(eq(scPackageQuestions.packageId, packageId))
            .orderBy(asc(scPackageQuestions.askedAt), asc(scPackageQuestions.id));
        return rows.map(toQuestion);
    }

    async findById(id: QuestionId): Promise<PackageQuestion | undefined> {
        const [row] = await this.ctx.executor.select().from(scPackageQuestions).where(eq(scPackageQuestions.id, id)).limit(1);
        return row === undefined ? undefined : toQuestion(row);
    }

    async insert(question: PackageQuestion): Promise<void> {
        await this.ctx.executor.insert(scPackageQuestions).values(question.toProps());
    }

    async update(question: PackageQuestion): Promise<void> {
        const p = question.toProps();
        await this.ctx.executor.update(scPackageQuestions)
            .set({ answer: p.answer, answeredBy: p.answeredBy, answeredAt: p.answeredAt, question: p.question })
            .where(and(eq(scPackageQuestions.buyerWorkspaceId, p.buyerWorkspaceId), eq(scPackageQuestions.id, p.id)));
    }
}
