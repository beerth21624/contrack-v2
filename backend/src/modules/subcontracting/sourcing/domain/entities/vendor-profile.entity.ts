// ─── Vendor profile: the crew's own public data, one per vendor workspace (plan §5.6) ───
// L0 is created on the first phone sign-in; L1 is reached when the profile is complete (team size, ≥ 3 portfolio
// items, trades, provinces). L2/L3 are set by later phases and never lowered here.
import type { TradeId, VendorTier } from '@contrack/contract';
import type { WorkspaceId } from '../../../../../shared/domain/ids';

export interface ReferenceRate {
    trade: TradeId;
    label: string;
    unit: string;
    rate: number;
}

export interface VendorProfileProps {
    workspaceId: WorkspaceId;
    teamName: string;
    contactName: string;
    /** E.164; '' when the profile was created without a phone sign-in. */
    phone: string;
    lineUserId: string | null;
    trades: TradeId[];
    provinces: string[];
    crewSkilled: number | null;
    crewLabourers: number | null;
    tools: string[];
    vatRegistered: boolean;
    referenceRates: ReferenceRate[];
    availableMonths: string[];
    tier: VendorTier;
    tierUpdatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type VendorProfileFields = Pick<VendorProfileProps,
    'teamName' | 'contactName' | 'trades' | 'provinces' | 'crewSkilled' | 'crewLabourers' | 'tools' | 'vatRegistered'
    | 'referenceRates' | 'availableMonths'>;

export const PORTFOLIO_FOR_L1 = 3;

export class VendorProfile {
    private constructor(private p: VendorProfileProps) {}

    static create(input: { workspaceId: WorkspaceId; teamName: string; contactName: string; phone: string; now: Date }): VendorProfile {
        return new VendorProfile({
            workspaceId: input.workspaceId,
            teamName: input.teamName.trim(),
            contactName: input.contactName.trim(),
            phone: input.phone,
            lineUserId: null,
            trades: [],
            provinces: [],
            crewSkilled: null,
            crewLabourers: null,
            tools: [],
            vatRegistered: false,
            referenceRates: [],
            availableMonths: [],
            tier: 'L0',
            tierUpdatedAt: input.now,
            createdAt: input.now,
            updatedAt: input.now,
        });
    }

    static rehydrate(props: VendorProfileProps): VendorProfile {
        return new VendorProfile({ ...props });
    }

    get props(): Readonly<VendorProfileProps> {
        return this.p;
    }

    get workspaceId(): WorkspaceId {
        return this.p.workspaceId;
    }

    /** Team size, trades, provinces and at least 3 portfolio items. */
    isComplete(portfolioCount: number): boolean {
        return (this.p.crewSkilled !== null || this.p.crewLabourers !== null) && this.p.trades.length > 0
            && this.p.provinces.length > 0 && portfolioCount >= PORTFOLIO_FOR_L1;
    }

    update(fields: VendorProfileFields, portfolioCount: number, now: Date): void {
        this.p = { ...this.p, ...fields, updatedAt: now };
        this.refreshTier(portfolioCount, now);
    }

    setPhone(phone: string, now: Date): void {
        this.p = { ...this.p, phone, updatedAt: now };
    }

    /** L0 ↔ L1 follows completeness; L2/L3 (verified by later phases) stay. */
    refreshTier(portfolioCount: number, now: Date): void {
        if (this.p.tier === 'L2' || this.p.tier === 'L3') return;
        const tier: VendorTier = this.isComplete(portfolioCount) ? 'L1' : 'L0';
        if (tier !== this.p.tier) this.p = { ...this.p, tier, tierUpdatedAt: now, updatedAt: now };
    }

    toProps(): VendorProfileProps {
        return structuredClone(this.p);
    }
}
