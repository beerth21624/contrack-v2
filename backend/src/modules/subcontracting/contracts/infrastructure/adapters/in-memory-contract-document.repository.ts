import type { SubcontractId } from '../../../shared/ids';
import { ContractDocumentRepository } from '../../application/ports/contract-document.repository';
import type { ChangeRequest, ContractDocument } from '../../domain/entities/contract-records.entity';

export class InMemoryContractDocumentRepository extends ContractDocumentRepository {
    readonly documents: ContractDocument[] = [];
    readonly changeRequests: ChangeRequest[] = [];

    insertDocument(doc: ContractDocument): Promise<void> {
        if (this.documents.some(d => d.subcontractId === doc.subcontractId && d.version === doc.version)) {
            throw new Error(`document v${doc.version} of ${doc.subcontractId} already exists`);
        }
        this.documents.push(structuredClone(doc));
        return Promise.resolve();
    }

    findDocument(subcontractId: SubcontractId, version: number): Promise<ContractDocument | undefined> {
        const d = this.documents.find(x => x.subcontractId === subcontractId && x.version === version);
        return Promise.resolve(d === undefined ? undefined : structuredClone(d));
    }

    insertChangeRequest(request: ChangeRequest): Promise<void> {
        this.changeRequests.push(structuredClone(request));
        return Promise.resolve();
    }

    listChangeRequests(subcontractId: SubcontractId): Promise<ChangeRequest[]> {
        return Promise.resolve(this.changeRequests.filter(c => c.subcontractId === subcontractId).map(c => structuredClone(c)));
    }

    resolveChangeRequests(subcontractId: SubcontractId, at: Date): Promise<void> {
        for (const c of this.changeRequests) {
            if (c.subcontractId === subcontractId && c.resolvedAt === null) c.resolvedAt = new Date(at.getTime());
        }
        return Promise.resolve();
    }
}
