import { Injectable } from '@nestjs/common';
import { type CompanyProfileDto, type PutCompanyProfileRequest } from '@contrack/contract';
import { defaultProjectTypeFor } from '@contrack/domain/erp/profiles';
import { isThaiTaxId } from '@contrack/domain/erp/tax-id';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { AuditLog, Clock, CompanyProfiles, FileService, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { RepositoryCompanyProfiles } from '../../infrastructure/adapters/company-profiles.adapter';
import { CompanyRepository, type SavedCompany } from '../ports/company.repository';

/** The profile as the API shows it (images with fresh signed links). */
async function toDto(profiles: CompanyProfiles, files: FileService, workspaceId: WorkspaceId): Promise<CompanyProfileDto> {
    const c = await profiles.get(workspaceId);
    const ids = [c.logoFileId, c.stampFileId, c.signatureFileId].filter((id): id is string => id !== null);
    const described = new Map((await files.describe(ids)).map(f => [f.id, f]));
    const image = (id: string | null) => (id === null ? null : described.get(id) ?? null);
    return {
        legalNameTh: c.legalNameTh,
        legalNameEn: c.legalNameEn,
        taxId: c.taxId,
        branchCode: c.branchCode,
        branchNameTh: c.branchNameTh,
        branchNameEn: c.branchNameEn,
        addressTh: c.addressTh,
        addressEn: c.addressEn,
        phone: c.phone,
        email: c.email,
        website: c.website,
        logo: image(c.logoFileId),
        stamp: image(c.stampFileId),
        signature: image(c.signatureFileId),
        vatRegistered: c.vatRegistered,
        vatRate: c.vatRate,
        businessProfiles: c.businessProfiles,
        defaultProjectType: c.defaultProjectType,
        defaultDocLanguage: c.defaultDocLanguage,
        documentYearStyle: c.documentYearStyle,
        bankAccounts: c.bankAccounts,
        promptpayId: c.promptpayId,
        defaults: c.defaults,
        brandColor: c.brandColor,
        documentFooterTh: c.documentFooterTh,
        documentFooterEn: c.documentFooterEn,
        workspaceName: c.workspaceName,
        isDefault: c.isDefault,
        effectiveProjectType: c.defaultProjectType ?? defaultProjectTypeFor(c.businessProfiles),
        updatedBy: c.updatedBy,
        updatedAt: c.updatedAt === null ? null : c.updatedAt.toISOString(),
    };
}

/** GET /workspaces/:workspaceId/company: `project-hub` active, `company.read`. */
@Injectable()
export class GetCompanyUseCase {
    constructor(private readonly access: ModuleAccess, private readonly profiles: CompanyProfiles, private readonly files: FileService) {}

    async execute(userId: UserId, workspaceId: WorkspaceId): Promise<Result<CompanyProfileDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'project-hub', 'company.read');
        if (!grant.ok) return grant;
        return ok(await toDto(this.profiles, this.files, workspaceId));
    }
}

const IMAGE_KEYS = ['logoFileId', 'stampFileId', 'signatureFileId'] as const;

/**
 * PUT /workspaces/:workspaceId/company: `project-hub` active, `company.manage`. Replaces the whole profile. A tax id
 * with a wrong check digit → 400 `validation_failed` (`reason: 'invalid_tax_id'`); images newly attached must have
 * been uploaded by the caller. Audited as `company_profile` / `set` with the changed field names.
 */
@Injectable()
export class PutCompanyUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: CompanyRepository,
        private readonly profiles: RepositoryCompanyProfiles,
        private readonly files: FileService,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; workspaceId: WorkspaceId; body: PutCompanyProfileRequest }): Promise<Result<CompanyProfileDto, DomainError>> {
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'project-hub', 'company.manage');
        if (!grant.ok) return grant;
        const body = input.body;
        if (body.taxId !== '' && !isThaiTaxId(body.taxId)) {
            return err(DomainError.validation('The tax id is not valid', { reason: 'invalid_tax_id' }));
        }
        const before = await this.profiles.get(input.workspaceId);
        const added = IMAGE_KEYS.map(k => body[k]).filter((id): id is string => id !== null && !IMAGE_KEYS.some(k => before[k] === id));
        if (added.length > 0) {
            const owned = await this.files.assertUploadedBy(added, input.userId);
            if (!owned.ok) return owned;
        }
        const next: SavedCompany = { ...body, workspaceId: input.workspaceId, updatedBy: input.userId, updatedAt: this.clock.now() };
        const changed = (Object.keys(body) as (keyof PutCompanyProfileRequest)[])
            .filter(k => JSON.stringify(body[k]) !== JSON.stringify(before[k]));
        await this.uow.run(async () => {
            await this.repo.save(next);
            await this.audit.record({
                workspaceId: input.workspaceId, projectId: null, actor: input.userId,
                entityType: 'company_profile', entityId: input.workspaceId, action: 'set', data: { changed },
            });
        });
        return ok(await toDto(this.profiles, this.files, input.workspaceId));
    }
}
