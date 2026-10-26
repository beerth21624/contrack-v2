// ─── One past job in a vendor profile (photos are uploaded file ids) ───
import type { TradeId } from '@contrack/contract';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import type { PortfolioItemId } from '../../../shared/ids';

export interface PortfolioItemProps {
    id: PortfolioItemId;
    vendorWorkspaceId: WorkspaceId;
    title: string;
    trade: TradeId;
    year: number | null;
    district: string;
    province: string;
    photoFileIds: string[];
    note: string;
    createdAt: Date;
}

export class PortfolioItem {
    private constructor(private readonly p: PortfolioItemProps) {}

    static create(props: PortfolioItemProps): PortfolioItem {
        return new PortfolioItem({ ...props, title: props.title.trim(), photoFileIds: [...new Set(props.photoFileIds)] });
    }

    static rehydrate(props: PortfolioItemProps): PortfolioItem {
        return new PortfolioItem({ ...props });
    }

    get props(): Readonly<PortfolioItemProps> {
        return this.p;
    }

    get id(): PortfolioItemId {
        return this.p.id;
    }

    get vendorWorkspaceId(): WorkspaceId {
        return this.p.vendorWorkspaceId;
    }

    toProps(): PortfolioItemProps {
        return structuredClone(this.p);
    }
}
