// ─── Variations (งานเพิ่ม-ลด): list, propose (active only), answer (the OTHER side) — plan §4.7, rule 8 ───
// Writes lock the subcontract row first and check the variation / contract as read under that lock.
import { Injectable } from '@nestjs/common';
import type { ProposeVariationRequest, VariationDto } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import { DomainError, type Result, type UserId, err, ok } from '../../../../../shared/domain';
import { asVariationId, type SubcontractId, type VariationId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import type { Subcontract } from '../../domain/entities/subcontract.entity';
import { Variation } from '../../domain/entities/variation.entity';
import { ContractAccess, READ_BOTH } from '../contract-access';
import { logContract } from '../contract-activity';
import { ContractNotices, otherSide } from '../contract-notices';
import { openClaimOf } from '../contract-state';
import { maskVariation, variationToDto } from '../contract-views';
import { ClaimRepository } from '../ports/claim.repository';
import { SubcontractRepository } from '../ports/subcontract.repository';
import { VariationRepository } from '../ports/variation.repository';
import { formatBaht } from '../thai-format';

@Injectable()
export class ListVariationsUseCase {
    constructor(private readonly access: ContractAccess, private readonly variations: VariationRepository) {}

    async execute(input: { userId: UserId; subcontractId: SubcontractId }): Promise<Result<VariationDto[], DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, READ_BOTH);
        if (!loaded.ok) return loaded;
        const list = (await this.variations.listBySubcontracts([input.subcontractId])).map(variationToDto);
        return ok(loaded.value.seesPrices ? list : list.map(maskVariation));
    }
}

@Injectable()
export class ProposeVariationUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly variations: VariationRepository,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: { userId: UserId; subcontractId: SubcontractId } & ProposeVariationRequest): Promise<Result<VariationDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, {
            buyer: ['sc.packages.manage'], vendor: ['vendor.contract.act'], write: true,
        });
        if (!loaded.ok) return loaded;
        const side = loaded.value.side;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<{ sc: Subcontract; variation: Variation }, DomainError>> => {
            const locked = await this.access.lock(input.subcontractId);
            if (!locked.ok) return locked;
            const sc = locked.value;
            const active = sc.requireStatus('propose a variation on', 'active');
            if (!active.ok) return active;
            const variation = Variation.propose({
                id: asVariationId(this.ids.newId()), subcontractId: sc.id, buyerWorkspaceId: sc.buyerWorkspaceId, proposedBy: side,
                proposedByUser: input.userId, lines: input.lines, reason: input.reason, now,
            });
            await this.variations.insert(variation);
            await logContract(this.activity, sc, 'variation', variation.id, 'proposed', input.userId, now, { side, amount: variation.amount });
            return ok({ sc, variation });
        });
        if (!done.ok) return done;
        const { sc, variation } = done.value;
        await this.notices.toSide(otherSide(side), sc, 'sc.variation_proposed', { title: sc.title, amount: formatBaht(variation.amount) });
        const dto = variationToDto(variation);
        return ok(loaded.value.seesPrices ? dto : maskVariation(dto));
    }
}

@Injectable()
export class RespondVariationUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly subcontracts: SubcontractRepository,
        private readonly variations: VariationRepository,
        private readonly claims: ClaimRepository,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /** Accepted → the contract value changes and the last installment takes the difference. */
    async execute(input: { userId: UserId; variationId: VariationId; accept: boolean }): Promise<Result<VariationDto, DomainError>> {
        const loaded = await this.access.loadVariation(input.userId, input.variationId, {
            buyer: ['sc.packages.manage'], vendor: ['vendor.contract.act'], write: true,
        });
        if (!loaded.ok) return loaded;
        const side = loaded.value.side;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<{ sc: Subcontract; variation: Variation }, DomainError>> => {
            const locked = await this.access.lockVariation(input.variationId, loaded.value.subcontract.id);
            if (!locked.ok) return locked;
            const { subcontract: sc, variation } = locked.value;
            const active = sc.requireStatus('answer a variation on', 'active');
            if (!active.ok) return active;
            const answered = variation.respond(side, input.accept, input.userId, now);
            if (!answered.ok) return answered;
            if (input.accept) {
                const last = openClaimOf(await this.claims.listBySubcontracts([sc.id]), sc.lastInstallmentNo());
                if (last !== undefined && (last.status === 'approved' || last.status === 'paid')) {
                    return err(DomainError.conflict('The last installment is already approved: the value can no longer change', { reason: 'last_installment_approved' }));
                }
                const applied = sc.applyVariation(variation.amount, now);
                if (!applied.ok) return applied;
            }
            await this.variations.update(variation);
            if (input.accept) await this.subcontracts.update(sc);
            await logContract(this.activity, sc, 'variation', variation.id, input.accept ? 'accepted' : 'rejected', input.userId, now, {
                from: 'proposed', to: variation.status, amount: variation.amount, total: sc.total,
            });
            return ok({ sc, variation });
        });
        if (!done.ok) return done;
        const { sc, variation } = done.value;
        await this.notices.toSide(variation.proposedBy, sc, 'sc.variation_answered', {
            title: sc.title, amount: formatBaht(variation.amount), accepted: input.accept ? 'ยอมรับ' : 'ไม่ยอมรับ',
        });
        const dto = variationToDto(variation);
        return ok(loaded.value.seesPrices ? dto : maskVariation(dto));
    }
}
