// ─── Retention ledger of a subcontract: list (both sides), release / forfeit (buyer, ≤ balance) — plan rule 10 ───
// A move locks the subcontract row first and checks the balance as read under that lock (two releases at once cannot
// both pass the balance check).
import { Injectable } from '@nestjs/common';
import type { RetentionEntryDto } from '@contrack/contract';
import { round2 } from '@contrack/domain/subcontracting/snapshot';
import { Clock, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import { DomainError, type Result, type UserId, err, ok } from '../../../../../shared/domain';
import { asRetentionEntryId, type SubcontractId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import type { RetentionEntry } from '../../domain/entities/contract-records.entity';
import { ContractAccess, READ_BOTH } from '../contract-access';
import { logContract } from '../contract-activity';
import { retentionOf } from '../contract-state';
import { maskRetentionEntry, retentionEntryToDto } from '../contract-views';
import { RetentionRepository } from '../ports/retention.repository';

@Injectable()
export class ListRetentionUseCase {
    constructor(private readonly access: ContractAccess, private readonly retention: RetentionRepository) {}

    async execute(input: { userId: UserId; subcontractId: SubcontractId }): Promise<Result<RetentionEntryDto[], DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, READ_BOTH);
        if (!loaded.ok) return loaded;
        const list = (await this.retention.listBySubcontracts([input.subcontractId])).map(retentionEntryToDto);
        return ok(loaded.value.seesPrices ? list : list.map(maskRetentionEntry));
    }
}

@Injectable()
export class MoveRetentionUseCase {
    constructor(
        private readonly access: ContractAccess,
        private readonly retention: RetentionRepository,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    /** released = paid back to the crew; forfeited = kept (penalty, repairs) — the note says why. */
    async execute(input: { userId: UserId; subcontractId: SubcontractId; kind: 'released' | 'forfeited'; amount: number; note: string }): Promise<Result<RetentionEntryDto, DomainError>> {
        const loaded = await this.access.load(input.userId, input.subcontractId, { buyer: ['sc.payments.record'], write: true });
        if (!loaded.ok) return loaded;
        const amount = round2(input.amount);
        const now = this.clock.now();
        return this.uow.run(async (): Promise<Result<RetentionEntryDto, DomainError>> => {
            const locked = await this.access.lock(input.subcontractId);
            if (!locked.ok) return locked;
            const sc = locked.value;
            const started = sc.requireStatus('move the retention of', 'active', 'completed', 'terminated', 'closed');
            if (!started.ok) return started;
            const balance = retentionOf(sc, await this.retention.listBySubcontracts([sc.id])).balance;
            if (amount <= 0 || amount > balance) {
                return err(DomainError.unprocessable('The amount is more than the retention held', { balance, amount }));
            }
            const entry: RetentionEntry = {
                id: asRetentionEntryId(this.ids.newId()), subcontractId: sc.id, buyerWorkspaceId: sc.buyerWorkspaceId, kind: input.kind,
                amount, claimId: null, note: input.note, createdBy: input.userId, createdAt: now,
            };
            await this.retention.insert(entry);
            await logContract(this.activity, sc, 'subcontract', sc.id, `retention_${input.kind}`, input.userId, now, { amount, balanceBefore: balance });
            return ok(retentionEntryToDto(entry));
        });
    }
}
