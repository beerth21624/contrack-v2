// ─── Vendor-list entry (ทะเบียนทีมช่าง): a crew a buyer workspace knows, linked to a vendor once it signs up ───
import type { TradeId } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import type { VendorListEntryId } from '../../../shared/ids';
import type { Phone } from '../value-objects/phone.value-object';

export interface VendorListEntryProps {
    id: VendorListEntryId;
    buyerWorkspaceId: WorkspaceId;
    vendorWorkspaceId: WorkspaceId | null;
    displayName: string;
    /** E.164. Unique within the buyer workspace. */
    phone: string;
    lineId: string;
    trades: TradeId[];
    province: string;
    privateNote: string;
    hiddenAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

export interface VendorListEntryPatch {
    displayName?: string;
    phone?: Phone;
    lineId?: string;
    trades?: TradeId[];
    province?: string;
    privateNote?: string;
    hidden?: boolean;
}

export class VendorListEntry {
    private constructor(private p: VendorListEntryProps) {}

    static create(input: {
        id: VendorListEntryId; buyerWorkspaceId: WorkspaceId; vendorWorkspaceId: WorkspaceId | null; displayName: string;
        phone: Phone; lineId: string; trades: TradeId[]; province: string; privateNote: string; createdBy: UserId; now: Date;
    }): VendorListEntry {
        return new VendorListEntry({
            id: input.id,
            buyerWorkspaceId: input.buyerWorkspaceId,
            vendorWorkspaceId: input.vendorWorkspaceId,
            displayName: input.displayName.trim(),
            phone: input.phone.value,
            lineId: input.lineId.trim(),
            trades: [...new Set(input.trades)],
            province: input.province.trim(),
            privateNote: input.privateNote.trim(),
            hiddenAt: null,
            createdBy: input.createdBy,
            createdAt: input.now,
            updatedAt: input.now,
        });
    }

    static rehydrate(props: VendorListEntryProps): VendorListEntry {
        return new VendorListEntry({ ...props });
    }

    get props(): Readonly<VendorListEntryProps> {
        return this.p;
    }

    get id(): VendorListEntryId {
        return this.p.id;
    }

    get buyerWorkspaceId(): WorkspaceId {
        return this.p.buyerWorkspaceId;
    }

    get vendorWorkspaceId(): WorkspaceId | null {
        return this.p.vendorWorkspaceId;
    }

    get phone(): string {
        return this.p.phone;
    }

    get hidden(): boolean {
        return this.p.hiddenAt !== null;
    }

    update(patch: VendorListEntryPatch, now: Date): void {
        const next = { ...this.p, updatedAt: now };
        if (patch.displayName !== undefined) next.displayName = patch.displayName.trim();
        if (patch.phone !== undefined) next.phone = patch.phone.value;
        if (patch.lineId !== undefined) next.lineId = patch.lineId.trim();
        if (patch.trades !== undefined) next.trades = [...new Set(patch.trades)];
        if (patch.province !== undefined) next.province = patch.province.trim();
        if (patch.privateNote !== undefined) next.privateNote = patch.privateNote.trim();
        if (patch.hidden !== undefined) next.hiddenAt = patch.hidden ? (this.p.hiddenAt ?? now) : null;
        this.p = next;
    }

    /** Links to the vendor that signed up with this phone. Returns false when it was already linked. */
    linkTo(vendorWorkspaceId: WorkspaceId, now: Date): boolean {
        if (this.p.vendorWorkspaceId !== null) return false;
        this.p = { ...this.p, vendorWorkspaceId, updatedAt: now };
        return true;
    }

    toProps(): VendorListEntryProps {
        return structuredClone(this.p);
    }
}
