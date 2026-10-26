// ─── Vendor profile DTOs: the crew's own view (VendorProfileDto) and the card buyers see (VendorCardDto) ───
import { Injectable } from '@nestjs/common';
import type { PortfolioItemDto, VendorCardDto, VendorProfileDto } from '@contrack/contract';
import { FileService } from '../../../../../shared/application/ports';
import type { PortfolioItem } from '../../domain/entities/portfolio-item.entity';
import type { VendorProfile } from '../../domain/entities/vendor-profile.entity';
import { VendorProfileRepository } from '../ports/sourcing.repositories';

@Injectable()
export class VendorProfileViews {
    constructor(private readonly profiles: VendorProfileRepository, private readonly files: FileService) {}

    async portfolioItem(item: PortfolioItem): Promise<PortfolioItemDto> {
        const p = item.props;
        return {
            id: p.id, title: p.title, trade: p.trade, year: p.year, district: p.district, province: p.province,
            photos: await this.files.describe(p.photoFileIds), note: p.note, createdAt: p.createdAt.toISOString(),
        };
    }

    async profile(profile: VendorProfile): Promise<VendorProfileDto> {
        const items = await this.profiles.listPortfolio(profile.workspaceId);
        const p = profile.props;
        return {
            workspaceId: p.workspaceId,
            teamName: p.teamName,
            contactName: p.contactName,
            phone: p.phone,
            lineLinked: p.lineUserId !== null,
            trades: [...p.trades],
            provinces: [...p.provinces],
            crewSkilled: p.crewSkilled,
            crewLabourers: p.crewLabourers,
            tools: [...p.tools],
            vatRegistered: p.vatRegistered,
            referenceRates: p.referenceRates.map(r => ({ ...r })),
            availableMonths: [...p.availableMonths],
            tier: p.tier,
            profileComplete: profile.isComplete(items.length),
            portfolio: await Promise.all(items.map(i => this.portfolioItem(i))),
            updatedAt: p.updatedAt.toISOString(),
        };
    }

    /** Public data only: no phone, contact name, rates or availability. */
    async card(profile: VendorProfile): Promise<VendorCardDto> {
        const items = await this.profiles.listPortfolio(profile.workspaceId);
        const p = profile.props;
        return {
            workspaceId: p.workspaceId,
            teamName: p.teamName,
            trades: [...p.trades],
            provinces: [...p.provinces],
            crewSkilled: p.crewSkilled,
            crewLabourers: p.crewLabourers,
            tier: p.tier,
            profileComplete: profile.isComplete(items.length),
            portfolio: await Promise.all(items.map(i => this.portfolioItem(i))),
        };
    }
}
