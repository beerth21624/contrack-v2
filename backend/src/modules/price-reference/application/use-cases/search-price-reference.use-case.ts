import { Injectable } from '@nestjs/common';
import type { PriceReferenceItemDto, PriceReferenceQuery } from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { PriceReferenceRepository } from '../ports/price-reference.repository';

/** GET /workspaces/:workspaceId/price-reference/items?q=&category=&limit= — `projects.read`, module `project-hub`. */
@Injectable()
export class SearchPriceReferenceUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: PriceReferenceRepository) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: PriceReferenceQuery): Promise<Result<PriceReferenceItemDto[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'project-hub', 'projects.read');
        if (!grant.ok) return grant;
        const category = query.category === undefined || query.category === '' ? undefined : query.category;
        return ok(await this.repo.search({ q: (query.q ?? '').toLowerCase(), category, limit: query.limit }));
    }
}
