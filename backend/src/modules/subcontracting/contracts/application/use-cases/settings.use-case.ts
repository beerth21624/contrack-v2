// ─── GET / PUT /workspaces/:ws/subcontracting/settings and GET /subcontracting/checklists ───
import { Injectable } from '@nestjs/common';
import type { SubcontractingSettingsDto, TradeId } from '@contrack/contract';
import { sanitizeContractHtml } from '@contrack/domain/subcontracting/contract-template';
import { TRADES } from '@contrack/domain/subcontracting/trades';
import { Clock } from '../../../../../shared/application/ports';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../../shared/domain';
import { SubcontractingSettingsReader } from '../../../shared/ports';
import { ScAccess } from '../../../shared/sc-access';
import { ScSettingsRepository } from '../ports/sc-settings.repository';

@Injectable()
export class GetScSettingsUseCase {
    constructor(private readonly access: ScAccess, private readonly settings: SubcontractingSettingsReader) {}

    /** Saved settings, or the defaults when the workspace never saved any. */
    async execute(input: { userId: UserId; workspaceId: WorkspaceId }): Promise<Result<SubcontractingSettingsDto, DomainError>> {
        const role = await this.access.buyer(input.userId, input.workspaceId, ['sc.read']);
        if (!role.ok) return role;
        return ok(await this.settings.get(input.workspaceId));
    }
}

@Injectable()
export class PutScSettingsUseCase {
    constructor(private readonly access: ScAccess, private readonly repo: ScSettingsRepository, private readonly clock: Clock) {}

    async execute(input: { userId: UserId; workspaceId: WorkspaceId; settings: SubcontractingSettingsDto }): Promise<Result<SubcontractingSettingsDto, DomainError>> {
        const role = await this.access.buyer(input.userId, input.workspaceId, ['sc.settings']);
        if (!role.ok) return role;
        const template = input.settings.contractTemplateHtml.trim() === '' ? '' : sanitizeContractHtml(input.settings.contractTemplateHtml);
        const data: SubcontractingSettingsDto = { ...input.settings, contractTemplateHtml: template };
        await this.repo.put(input.workspaceId, data, input.userId, this.clock.now());
        return ok(data);
    }
}

@Injectable()
export class GetTradeChecklistsUseCase {
    constructor(private readonly access: ScAccess) {}

    /** Inspection checklist suggested per trade (any signed-in user: it is not tenant data), while the platform offers the module. */
    execute(): Result<Record<TradeId, string[]>, DomainError> {
        const on = this.access.platformOn();
        if (!on.ok) return on;
        return ok(Object.fromEntries(TRADES.map(t => [t.id, [...t.checklist]])) as Record<TradeId, string[]>);
    }
}
