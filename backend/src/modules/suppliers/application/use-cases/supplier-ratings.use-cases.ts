import { Injectable } from '@nestjs/common';
import type { CreateSupplierRatingRequest, SupplierRatedDto, SupplierRatingDto } from '@contrack/contract';
import { AuditLog, Clock, IdGenerator, ProjectStatusLookup, UnitOfWork, UserDirectory } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, asProjectId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { averageScore } from '../../domain/supplier';
import type { SupplierRating } from '../ports/supplier.repository';
import { SupplierRepository } from '../ports/supplier.repository';
import { SupplierAccess, supplierArchived, toSupplierDto } from './suppliers.use-cases';

const RATINGS_LIMIT = 100;

const toRatingDto = (r: SupplierRating, names: Map<UserId, { displayName: string }>): SupplierRatingDto => ({
    id: r.id,
    supplierId: r.supplierId,
    projectId: r.projectId,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    score: r.score,
    note: r.note,
    createdBy: r.createdBy,
    createdByName: r.createdBy === null ? null : names.get(r.createdBy)?.displayName ?? null,
    createdAt: r.createdAt.toISOString(),
});

/** GET /suppliers/:supplierId/ratings — `suppliers.read`; newest first (100). */
@Injectable()
export class ListSupplierRatingsUseCase {
    constructor(private readonly suppliers: SupplierAccess, private readonly repo: SupplierRepository, private readonly users: UserDirectory) {}

    async execute(userId: UserId, supplierId: string): Promise<Result<SupplierRatingDto[], DomainError>> {
        const loaded = await this.suppliers.load(userId, supplierId, 'suppliers.read');
        if (!loaded.ok) return loaded;
        const rows = await this.repo.listRatings(loaded.value.id, RATINGS_LIMIT);
        const names = await this.users.findMany([...new Set(rows.flatMap(r => (r.createdBy === null ? [] : [r.createdBy])))]);
        return ok(rows.map(r => toRatingDto(r, names)));
    }
}

/**
 * POST /suppliers/:supplierId/ratings — `suppliers.manage`; score 1–5, optional project of the same workspace (else 404).
 * `rating` / `rating_count` are recomputed from every score each time. Archived → 409 `supplier_archived`.
 */
@Injectable()
export class RateSupplierUseCase {
    constructor(
        private readonly suppliers: SupplierAccess,
        private readonly repo: SupplierRepository,
        private readonly projects: ProjectStatusLookup,
        private readonly users: UserDirectory,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; supplierId: string; body: CreateSupplierRatingRequest }): Promise<Result<SupplierRatedDto, DomainError>> {
        const loaded = await this.suppliers.load(input.userId, input.supplierId, 'suppliers.manage');
        if (!loaded.ok) return loaded;
        const supplier = loaded.value;
        if (supplier.archivedAt !== null) return err(supplierArchived());
        const projectId = input.body.projectId === null ? null : asProjectId(input.body.projectId.toLowerCase());
        if (projectId !== null && (await this.projects.find(projectId))?.workspaceId !== supplier.workspaceId) {
            return err(DomainError.notFound('Project'));
        }
        const now = this.clock.now();
        const rating: SupplierRating = {
            id: this.ids.newId(), supplierId: supplier.id, workspaceId: supplier.workspaceId, projectId,
            sourceType: input.body.sourceType, sourceId: input.body.sourceId?.toLowerCase() ?? null,
            score: input.body.score, note: input.body.note, createdBy: input.userId, createdAt: now,
        };
        const saved = await this.uow.run(async () => {
            await this.repo.addRating(rating);
            const scores = await this.repo.scores(supplier.id);
            // updatedAt stays: a score is not an edit of the details (the edit form keys on it).
            const after = { ...supplier, rating: averageScore(scores), ratingCount: scores.length };
            await this.repo.save(after);
            await this.audit.record({
                workspaceId: supplier.workspaceId, projectId, actor: input.userId,
                entityType: 'supplier', entityId: supplier.id, action: 'rate', data: { score: rating.score, rating: after.rating },
            });
            return after;
        });
        const names = await this.users.findMany([input.userId]);
        return ok({ supplier: toSupplierDto(saved), rating: toRatingDto(rating, names) });
    }
}
