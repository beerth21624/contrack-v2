import { and, asc, eq, isNull } from 'drizzle-orm';
import { asUserId, asWorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scChangeRequests, scContractDocuments } from '../../../../../shared/infrastructure/database/schema-sc-contracts';
import { asSubcontractId, type SubcontractId } from '../../../shared/ids';
import { ContractDocumentRepository } from '../../application/ports/contract-document.repository';
import type { ChangeRequest, ContractDocument } from '../../domain/entities/contract-records.entity';

export class DrizzleContractDocumentRepository extends ContractDocumentRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insertDocument(doc: ContractDocument): Promise<void> {
        await this.ctx.executor.insert(scContractDocuments).values({ ...doc });
    }

    async findDocument(subcontractId: SubcontractId, version: number): Promise<ContractDocument | undefined> {
        const rows = await this.ctx.executor.select().from(scContractDocuments)
            .where(and(eq(scContractDocuments.subcontractId, subcontractId), eq(scContractDocuments.version, version))).limit(1);
        const r = rows[0];
        if (r === undefined) return undefined;
        return {
            id: r.id, subcontractId: asSubcontractId(r.subcontractId), buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
            version: r.version, html: r.html, createdBy: asUserId(r.createdBy), createdAt: r.createdAt,
        };
    }

    async insertChangeRequest(request: ChangeRequest): Promise<void> {
        await this.ctx.executor.insert(scChangeRequests).values({ ...request });
    }

    async listChangeRequests(subcontractId: SubcontractId): Promise<ChangeRequest[]> {
        const rows = await this.ctx.executor.select().from(scChangeRequests)
            .where(eq(scChangeRequests.subcontractId, subcontractId)).orderBy(asc(scChangeRequests.createdAt));
        return rows.map(r => ({
            id: r.id, subcontractId: asSubcontractId(r.subcontractId), buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
            text: r.text, requestedBy: asUserId(r.requestedBy), createdAt: r.createdAt, resolvedAt: r.resolvedAt,
        }));
    }

    async resolveChangeRequests(subcontractId: SubcontractId, at: Date): Promise<void> {
        await this.ctx.executor.update(scChangeRequests).set({ resolvedAt: at })
            .where(and(eq(scChangeRequests.subcontractId, subcontractId), isNull(scChangeRequests.resolvedAt)));
    }
}
