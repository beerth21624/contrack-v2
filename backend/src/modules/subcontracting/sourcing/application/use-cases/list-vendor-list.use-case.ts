import { Injectable } from '@nestjs/common';
import type { TradeId, VendorListEntryDto } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import { ScAccess } from '../../../shared/sc-access';
import { VendorListRepository } from '../ports/sourcing.repositories';
import { SourcingViews } from '../services/sourcing-views.service';

export interface ListVendorListInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    trade?: TradeId;
    /** Matches the name, phone or LINE id (case-insensitive). */
    q?: string;
    /** undefined: every entry; false: visible only; true: hidden only. */
    hidden?: boolean;
}

/** `sc.read`. Every entry (or only visible / only hidden with `hidden`), filtered by trade and text, oldest first. */
@Injectable()
export class ListVendorListUseCase {
    constructor(private readonly access: ScAccess, private readonly entries: VendorListRepository, private readonly views: SourcingViews) {}

    async execute(input: ListVendorListInput): Promise<Result<VendorListEntryDto[], DomainError>> {
        const role = await this.access.buyer(input.actorId, input.workspaceId, ['sc.read']);
        if (!role.ok) return role;
        const q = input.q?.trim().toLowerCase() ?? '';
        const digits = q.replace(/\D/g, '');
        const found = (await this.entries.list(input.workspaceId)).filter(entry => {
            const e = entry.props;
            if (input.hidden !== undefined && input.hidden !== (e.hiddenAt !== null)) return false;
            if (input.trade !== undefined && !e.trades.includes(input.trade)) return false;
            if (q === '') return true;
            const localPhone = e.phone.startsWith('+66') ? `0${e.phone.slice(3)}` : e.phone;
            return e.displayName.toLowerCase().includes(q) || e.lineId.toLowerCase().includes(q)
                || (digits.length >= 3 && (localPhone.includes(digits) || e.phone.includes(digits)));
        });
        return ok(await this.views.vendorListEntries(input.workspaceId, found));
    }
}
