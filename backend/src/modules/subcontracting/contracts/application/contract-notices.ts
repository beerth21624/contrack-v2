// ─── Notifications of the contracts stream (API-module1.md "Notifications"). Called after the transaction committed ───
import { Injectable } from '@nestjs/common';
import { type NotificationTemplate, Notifier } from '../../../../shared/application/ports';
import type { SubcontractId } from '../../shared/ids';
import type { Side } from '../domain/entities/claim.entity';
import type { Subcontract } from '../domain/entities/subcontract.entity';

export const buyerContractHref = (id: SubcontractId): string => `/subcontracting/contracts/${id}`;
export const vendorContractHref = (id: SubcontractId): string => `/vendor/contracts/${id}`;

type Payload = Record<string, string | number>;

@Injectable()
export class ContractNotices {
    constructor(private readonly notifier: Notifier) {}

    async toBuyer(sc: Subcontract, template: NotificationTemplate, payload: Payload): Promise<void> {
        await this.notifier.notify({
            template, toWorkspaceIds: [sc.buyerWorkspaceId], payload: { ...payload, href: buyerContractHref(sc.id) },
        });
    }

    /** Only when the crew has an account (a winner without one is reached when it signs up). */
    async toVendor(sc: Subcontract, template: NotificationTemplate, payload: Payload): Promise<void> {
        if (sc.vendorWorkspaceId === null) return;
        await this.notifier.notify({
            template, toWorkspaceIds: [sc.vendorWorkspaceId], payload: { ...payload, href: vendorContractHref(sc.id) },
        });
    }

    async toSide(side: Side, sc: Subcontract, template: NotificationTemplate, payload: Payload): Promise<void> {
        if (side === 'buyer') await this.toBuyer(sc, template, payload);
        else await this.toVendor(sc, template, payload);
    }
}

export const otherSide = (side: Side): Side => (side === 'buyer' ? 'vendor' : 'buyer');
