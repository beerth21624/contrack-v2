// ─── The CrewDailyCost port (site diary, WP-42): a crew's ฿/day through CrewPricing ───
import { Injectable } from '@nestjs/common';
import { CrewDailyCost, type CrewDailyCostInfo } from '../../../shared/application/ports';
import { type WorkspaceId, asCrewId, isUuid } from '../../../shared/domain';
import type { Crew } from '../domain/entities/crew.entity';
import { CrewPricing } from './crew-pricing';
import { CrewRepository } from './ports/crew.repository';

@Injectable()
export class WorkforceCrewDailyCost extends CrewDailyCost {
    constructor(private readonly crews: CrewRepository, private readonly pricing: CrewPricing) {
        super();
    }

    async dailyCostOf(workspaceId: WorkspaceId, crewIds: readonly string[]): Promise<Map<string, CrewDailyCostInfo>> {
        const out = new Map<string, CrewDailyCostInfo>();
        const found: Crew[] = [];
        for (const id of new Set(crewIds.filter(isUuid).map(i => i.toLowerCase()))) {
            const crew = await this.crews.find(workspaceId, asCrewId(id));
            if (crew !== undefined) found.push(crew);
        }
        for (const p of await this.pricing.price(workspaceId, found)) {
            out.set(p.crew.id, { crewId: p.crew.id, name: p.crew.name.value, trade: p.crew.trade, dailyCost: p.dailyCost });
        }
        return out;
    }
}
