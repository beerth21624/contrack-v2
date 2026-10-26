import type { SubcontractId } from '../../../shared/ids';
import type { ChangeRequest, ContractDocument } from '../../domain/entities/contract-records.entity';

/** Versions of the contract text and the vendor's change requests on it. */
export abstract class ContractDocumentRepository {
    abstract insertDocument(doc: ContractDocument): Promise<void>;
    abstract findDocument(subcontractId: SubcontractId, version: number): Promise<ContractDocument | undefined>;
    abstract insertChangeRequest(request: ChangeRequest): Promise<void>;
    /** Oldest first. */
    abstract listChangeRequests(subcontractId: SubcontractId): Promise<ChangeRequest[]>;
    abstract resolveChangeRequests(subcontractId: SubcontractId, at: Date): Promise<void>;
}
