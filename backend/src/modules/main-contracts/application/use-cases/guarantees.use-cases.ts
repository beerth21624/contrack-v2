// ─── Contract guarantees (bank guarantees, cash, cheques, bonds): list `contracts.read`, add / change / return `contracts.manage` ───
import { Injectable } from '@nestjs/common';
import type { ContractGuaranteeDto, CreateGuaranteeRequest, PatchGuaranteeRequest } from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { round2 } from '@contrack/domain/money';
import { AuditLog, Clock, FileService, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { requireStatus } from '../../domain/main-contract-state';
import { type GuaranteeRecord, MainContractRepository } from '../ports/main-contract.repository';
import { MainContractViews } from '../main-contract-views';
import { MainContractAccess, transact } from '../main-contract.service';

function checkDates(issueDate: string | null, expiryDate: string | null): Result<void, DomainError> {
    if (issueDate !== null && expiryDate !== null && expiryDate < issueDate) {
        return err(DomainError.validation('expiryDate is before issueDate', { reason: 'expiry_before_issue' }));
    }
    return ok(undefined);
}

/** GET /main-contracts/:contractId/guarantees — `contracts.read`. */
@Injectable()
export class ListGuaranteesUseCase {
    constructor(private readonly contracts: MainContractAccess, private readonly repo: MainContractRepository, private readonly views: MainContractViews) {}

    async execute(userId: UserId, contractId: string): Promise<Result<ContractGuaranteeDto[], DomainError>> {
        const loaded = await this.contracts.contract(userId, contractId, ['contracts.read'], false);
        if (!loaded.ok) return loaded;
        const { contract } = loaded.value;
        return ok(await this.views.guarantees(await this.repo.guaranteesOf(contract.workspaceId, contract.id)));
    }
}

/** POST /main-contracts/:contractId/guarantees — `contracts.manage`; a draft, signed or completed contract. */
@Injectable()
export class CreateGuaranteeUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly files: FileService,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: CreateGuaranteeRequest }): Promise<Result<ContractGuaranteeDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.contracts.contract(userId, input.contractId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const dates = checkDates(body.issueDate, body.expiryDate);
        if (!dates.ok) return dates;
        const fileIds = [...new Set(body.fileIds.map(id => id.toLowerCase()))];
        if (fileIds.length > 0) {
            const uploaded = await this.files.assertUploadedBy(fileIds, userId);
            if (!uploaded.ok) return uploaded;
        }
        const created = await transact(this.uow, async (): Promise<Result<GuaranteeRecord, DomainError>> => {
            const c = await this.repo.lockContract(ws, loaded.value.contract.id);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const allowed = requireStatus(c.status, ['draft', 'signed', 'completed']);
            if (!allowed.ok) return allowed;
            const now = this.clock.now();
            const g: GuaranteeRecord = {
                id: this.ids.newId(), contractId: c.id, workspaceId: ws, projectId: c.projectId, kind: body.kind, form: body.form,
                issuer: body.issuer, refNo: body.refNo, amount: round2(body.amount), issueDate: body.issueDate, expiryDate: body.expiryDate,
                status: 'active', returnedAt: null, fileIds, note: body.note, createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insertGuarantee(g);
            await this.audit.record({
                workspaceId: ws, projectId: c.projectId, actor: userId, entityType: 'contract_guarantee', entityId: g.id, action: 'create',
                data: { contractId: c.id, kind: g.kind, form: g.form, amount: g.amount, expiryDate: g.expiryDate },
            });
            return ok(g);
        });
        if (!created.ok) return created;
        const [dto] = await this.views.guarantees([created.value]);
        return dto === undefined ? err(DomainError.notFound('Guarantee')) : ok(dto);
    }
}

/**
 * PATCH /guarantees/:guaranteeId — `contracts.manage`. Returning one = `{status: 'returned'}` (`returnedAt` default
 * today); back to another status clears `returnedAt`. Not on a cancelled contract.
 */
@Injectable()
export class PatchGuaranteeUseCase {
    constructor(
        private readonly contracts: MainContractAccess,
        private readonly repo: MainContractRepository,
        private readonly files: FileService,
        private readonly views: MainContractViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; guaranteeId: string; body: PatchGuaranteeRequest }): Promise<Result<ContractGuaranteeDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.contracts.guarantee(userId, input.guaranteeId, ['contracts.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const before = loaded.value.guarantee;
        const fileIds = body.fileIds === undefined ? undefined : [...new Set(body.fileIds.map(id => id.toLowerCase()))];
        const added = (fileIds ?? []).filter(id => !before.fileIds.includes(id));
        if (added.length > 0) {
            const uploaded = await this.files.assertUploadedBy(added, userId);
            if (!uploaded.ok) return uploaded;
        }
        const saved = await transact(this.uow, async (): Promise<Result<GuaranteeRecord, DomainError>> => {
            const c = await this.repo.lockContract(ws, before.contractId);
            if (c === undefined) return err(DomainError.notFound('MainContract'));
            const allowed = requireStatus(c.status, ['draft', 'signed', 'completed', 'closed', 'terminated']);
            if (!allowed.ok) return allowed;
            const g = await this.repo.findGuarantee(before.id);
            if (g?.workspaceId !== ws) return err(DomainError.notFound('Guarantee'));
            const issueDate = body.issueDate !== undefined ? body.issueDate : g.issueDate;
            const expiryDate = body.expiryDate !== undefined ? body.expiryDate : g.expiryDate;
            const dates = checkDates(issueDate, expiryDate);
            if (!dates.ok) return dates;
            const now = this.clock.now();
            const status = body.status ?? g.status;
            const returnedAt = status === 'returned'
                ? (body.returnedAt ?? g.returnedAt ?? bangkokToday(now))
                : null;
            const next: GuaranteeRecord = {
                ...g,
                kind: body.kind ?? g.kind,
                form: body.form ?? g.form,
                issuer: body.issuer ?? g.issuer,
                refNo: body.refNo ?? g.refNo,
                amount: body.amount !== undefined ? round2(body.amount) : g.amount,
                issueDate, expiryDate, status, returnedAt,
                fileIds: fileIds ?? g.fileIds,
                note: body.note ?? g.note,
                updatedAt: now,
            };
            await this.repo.saveGuarantee(next);
            const changed: Record<string, unknown> = {};
            for (const key of ['kind', 'form', 'issuer', 'refNo', 'amount', 'issueDate', 'expiryDate', 'status', 'returnedAt', 'note'] as const) {
                if (next[key] !== g[key]) changed[key] = [g[key], next[key]];
            }
            await this.audit.record({
                workspaceId: ws, projectId: g.projectId, actor: userId, entityType: 'contract_guarantee', entityId: g.id,
                action: status === 'returned' && g.status !== 'returned' ? 'return' : 'update', data: changed,
            });
            return ok(next);
        });
        if (!saved.ok) return saved;
        const [dto] = await this.views.guarantees([saved.value]);
        return dto === undefined ? err(DomainError.notFound('Guarantee')) : ok(dto);
    }
}
