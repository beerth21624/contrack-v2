import { Injectable } from '@nestjs/common';
import type { DocLanguage } from '@contrack/contract';
import { type CompanyProfile, CompanyProfiles, type CompanySnapshot, WorkspaceDirectory } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { CompanyRepository, type SavedCompany } from '../../application/ports/company.repository';

/** The profile of a workspace that saved nothing: the legal Thai name is the workspace name. */
export function defaultCompany(workspaceId: WorkspaceId): SavedCompany {
    return {
        workspaceId,
        legalNameTh: '',
        legalNameEn: '',
        taxId: '',
        branchCode: '00000',
        branchNameTh: '',
        branchNameEn: '',
        addressTh: '',
        addressEn: '',
        phone: '',
        email: '',
        website: '',
        logoFileId: null,
        stampFileId: null,
        signatureFileId: null,
        vatRegistered: false,
        vatRate: 0.07,
        businessProfiles: [],
        defaultProjectType: null,
        defaultDocLanguage: 'th',
        documentYearStyle: 'ce',
        bankAccounts: [],
        promptpayId: '',
        defaults: {},
        brandColor: '#F97316',
        documentFooterTh: '',
        documentFooterEn: '',
        updatedBy: null,
        updatedAt: null,
    };
}

/** CompanyProfiles over CompanyRepository + the workspace name. */
@Injectable()
export class RepositoryCompanyProfiles extends CompanyProfiles {
    constructor(private readonly repo: CompanyRepository, private readonly directory: WorkspaceDirectory) {
        super();
    }

    async get(workspaceId: WorkspaceId): Promise<CompanyProfile> {
        const saved = await this.repo.find(workspaceId);
        const workspaceName = (await this.directory.names([workspaceId])).get(workspaceId) ?? '';
        const row = saved ?? defaultCompany(workspaceId);
        return {
            ...row,
            isDefault: saved === undefined,
            workspaceName,
            legalNameTh: row.legalNameTh.trim() === '' ? workspaceName : row.legalNameTh,
        };
    }

    async snapshot(workspaceId: WorkspaceId, language: DocLanguage): Promise<CompanySnapshot> {
        const c = await this.get(workspaceId);
        const en = language === 'en';
        // English falls back to Thai text: a document must never print an empty seller.
        const pick = (th: string, enText: string): string => (en && enText.trim() !== '' ? enText : th);
        return {
            language,
            legalName: pick(c.legalNameTh, c.legalNameEn),
            taxId: c.taxId,
            branchCode: c.branchCode,
            branchName: pick(c.branchNameTh, c.branchNameEn),
            address: pick(c.addressTh, c.addressEn),
            phone: c.phone,
            email: c.email,
            website: c.website,
            logoFileId: c.logoFileId,
            stampFileId: c.stampFileId,
            signatureFileId: c.signatureFileId,
            vatRegistered: c.vatRegistered,
            vatRate: c.vatRegistered ? c.vatRate : 0,
            bankAccounts: c.bankAccounts.map(b => ({ ...b })),
            promptpayId: c.promptpayId,
            brandColor: c.brandColor,
            footer: pick(c.documentFooterTh, c.documentFooterEn),
            yearStyle: c.documentYearStyle,
        };
    }
}
