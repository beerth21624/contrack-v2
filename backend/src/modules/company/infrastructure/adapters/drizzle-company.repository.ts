import { eq } from 'drizzle-orm';
import { type WorkspaceId, asUserId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { companyProfiles } from '../../../../shared/infrastructure/database/schema-erp-core';
import { CompanyRepository, type SavedCompany } from '../../application/ports/company.repository';

type Row = typeof companyProfiles.$inferSelect;

const PROJECT_TYPES = ['residential_new', 'residential_renovation', 'government', 'commercial'] as const;

const toSaved = (row: Row): SavedCompany => ({
    workspaceId: row.workspaceId as WorkspaceId,
    legalNameTh: row.legalNameTh,
    legalNameEn: row.legalNameEn,
    taxId: row.taxId,
    branchCode: row.branchCode,
    branchNameTh: row.branchNameTh,
    branchNameEn: row.branchNameEn,
    addressTh: row.addressTh,
    addressEn: row.addressEn,
    phone: row.phone,
    email: row.email,
    website: row.website,
    logoFileId: row.logoFileId,
    stampFileId: row.stampFileId,
    signatureFileId: row.signatureFileId,
    vatRegistered: row.vatRegistered,
    vatRate: row.vatRate,
    businessProfiles: row.businessProfiles,
    defaultProjectType: PROJECT_TYPES.find(t => t === row.defaultProjectType) ?? null,
    defaultDocLanguage: row.defaultDocLanguage,
    documentYearStyle: row.documentYearStyle,
    bankAccounts: row.bankAccounts,
    promptpayId: row.promptpayId,
    defaults: row.defaults,
    brandColor: row.brandColor,
    documentFooterTh: row.documentFooterTh,
    documentFooterEn: row.documentFooterEn,
    updatedBy: row.updatedBy === null ? null : asUserId(row.updatedBy),
    updatedAt: row.updatedAt,
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleCompanyRepository extends CompanyRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(workspaceId: WorkspaceId): Promise<SavedCompany | undefined> {
        const [row] = await this.ctx.executor.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1);
        return row === undefined ? undefined : toSaved(row);
    }

    async save(c: SavedCompany): Promise<void> {
        const { workspaceId, updatedAt, ...rest } = c;
        const values = { ...rest, updatedAt: updatedAt ?? new Date() };
        await this.ctx.executor.insert(companyProfiles)
            .values({ ...values, workspaceId })
            .onConflictDoUpdate({ target: companyProfiles.workspaceId, set: values });
    }
}
