// ─── Rate card → contract DTO (dates as ISO strings) ───
import type { RateCardDto } from '@contrack/contract';
import type { RateCard } from '../domain/entities/rate-card.entity';

export function rateCardToDto(c: RateCard): RateCardDto {
    return {
        id: c.id,
        workspaceId: c.workspaceId,
        name: c.name.value,
        skilledRate: c.skilledRate.baht,
        labourerRate: c.labourerRate.baht,
        note: c.note,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        archivedAt: c.archivedAt?.toISOString() ?? null,
    };
}
