// ─── Who the caller is in a subcontract (buyer or vendor side) and whether they may do what they ask ───
// Both sides reach the same subcontract: the buyer through its workspace (ScAccess.buyer: member → module on →
// permission), the vendor through the crew workspace (ScAccess.vendor: member → platform on → permission; writes also
// need the buyer's module on, so a buyer that switched the module off leaves the vendor read-only).
// Not a member of either side → not_found.
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { WorkspaceAccess } from '../../../../shared/application/ports';
import { DomainError, type Result, type UserId, err, ok } from '../../../../shared/domain';
import type { Permission } from '../../../../shared/domain/permissions';
import type { ClaimId, SubcontractId, VariationId } from '../../shared/ids';
import { ScAccess } from '../../shared/sc-access';
import type { Claim, Side } from '../domain/entities/claim.entity';
import type { Subcontract } from '../domain/entities/subcontract.entity';
import type { Variation } from '../domain/entities/variation.entity';
import { ClaimRepository } from './ports/claim.repository';
import { SubcontractRepository } from './ports/subcontract.repository';
import { VariationRepository } from './ports/variation.repository';

export interface AccessNeed {
    /** Permissions a buyer-side member needs (omit: the buyer side may not do this). */
    buyer?: Permission[];
    /** Permissions a vendor-side member needs (omit: the vendor side may not do this). */
    vendor?: Permission[];
    /** A write: the vendor side also needs the buyer's module on. */
    write: boolean;
}

export interface ContractActor {
    side: Side;
    role: Role;
    /** Money may be shown (vendor side always; buyer side with sc.readPrices, widened by settings). */
    seesPrices: boolean;
}

export const READ_BOTH: AccessNeed = { buyer: ['sc.read'], vendor: ['vendor.read'], write: false };

@Injectable()
export class ContractAccess {
    constructor(
        private readonly access: ScAccess,
        private readonly workspaces: WorkspaceAccess,
        private readonly subcontracts: SubcontractRepository,
        private readonly claims: ClaimRepository,
        private readonly variations: VariationRepository,
    ) {}

    async load(userId: UserId, id: SubcontractId, need: AccessNeed): Promise<Result<{ subcontract: Subcontract } & ContractActor, DomainError>> {
        const subcontract = await this.subcontracts.findById(id);
        if (subcontract === undefined) return err(DomainError.notFound('Subcontract'));
        const actor = await this.check(userId, subcontract, need);
        return actor.ok ? ok({ subcontract, ...actor.value }) : actor;
    }

    /** A claim and its subcontract (not_found for anyone who cannot see the subcontract). */
    async loadClaim(userId: UserId, id: ClaimId, need: AccessNeed): Promise<Result<{ claim: Claim; subcontract: Subcontract } & ContractActor, DomainError>> {
        const claim = await this.claims.findById(id);
        if (claim === undefined) return err(DomainError.notFound('Claim'));
        const loaded = await this.load(userId, claim.subcontractId, need);
        return loaded.ok ? ok({ claim, ...loaded.value }) : this.renamed(loaded.error, 'Claim');
    }

    async loadVariation(userId: UserId, id: VariationId, need: AccessNeed): Promise<Result<{ variation: Variation; subcontract: Subcontract } & ContractActor, DomainError>> {
        const variation = await this.variations.findById(id);
        if (variation === undefined) return err(DomainError.notFound('Variation'));
        const loaded = await this.load(userId, variation.subcontractId, need);
        return loaded.ok ? ok({ variation, ...loaded.value }) : this.renamed(loaded.error, 'Variation');
    }

    // ── Inside a UnitOfWork: lock first, then read the state every check is made on (plan: no write on a stale read) ──

    /** Locks the subcontract row and returns its current state. */
    async lock(id: SubcontractId): Promise<Result<Subcontract, DomainError>> {
        const sc = await this.subcontracts.lockForUpdate(id);
        return sc === undefined ? err(DomainError.notFound('Subcontract')) : ok(sc);
    }

    /** Locks the claim's subcontract, then reads the claim again (its writes are serialized by that lock). */
    async lockClaim(claimId: ClaimId, subcontractId: SubcontractId): Promise<Result<{ claim: Claim; subcontract: Subcontract }, DomainError>> {
        const sc = await this.subcontracts.lockForUpdate(subcontractId);
        const claim = sc === undefined ? undefined : await this.claims.findById(claimId);
        if (sc === undefined || claim?.subcontractId !== sc.id) return err(DomainError.notFound('Claim'));
        return ok({ claim, subcontract: sc });
    }

    /** Locks the variation's subcontract, then reads the variation again. */
    async lockVariation(variationId: VariationId, subcontractId: SubcontractId): Promise<Result<{ variation: Variation; subcontract: Subcontract }, DomainError>> {
        const sc = await this.subcontracts.lockForUpdate(subcontractId);
        const variation = sc === undefined ? undefined : await this.variations.findById(variationId);
        if (sc === undefined || variation?.subcontractId !== sc.id) return err(DomainError.notFound('Variation'));
        return ok({ variation, subcontract: sc });
    }

    private renamed(error: DomainError, what: string): Result<never, DomainError> {
        return err(error.code === 'not_found' ? DomainError.notFound(what) : error);
    }

    async check(userId: UserId, sc: Subcontract, need: AccessNeed): Promise<Result<ContractActor, DomainError>> {
        const buyerRole = await this.workspaces.roleOf(userId, sc.buyerWorkspaceId);
        const vendorWs = sc.vendorWorkspaceId;
        const vendorRole = vendorWs === null ? undefined : await this.workspaces.roleOf(userId, vendorWs);
        if (buyerRole === undefined && vendorRole === undefined) return err(DomainError.notFound('Subcontract'));
        if (need.buyer !== undefined && buyerRole !== undefined) {
            const role = await this.access.buyer(userId, sc.buyerWorkspaceId, need.buyer, 'Subcontract');
            if (!role.ok) return role;
            const seesPrices = await this.access.allowed(role.value, 'sc.readPrices', sc.buyerWorkspaceId);
            return ok({ side: 'buyer', role: role.value, seesPrices });
        }
        if (need.vendor !== undefined && vendorRole !== undefined && vendorWs !== null) {
            const role = await this.access.vendor(userId, vendorWs, need.vendor, 'Subcontract');
            if (!role.ok) return role;
            if (need.write) {
                const on = await this.access.buyerModuleOn(sc.buyerWorkspaceId);
                if (!on.ok) return on;
            }
            return ok({ side: 'vendor', role: role.value, seesPrices: true });
        }
        return err(DomainError.forbidden());
    }
}
