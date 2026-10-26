// ─── Variation (งานเพิ่ม-ลด): proposed → accepted | rejected, answered by the OTHER side (plan §6 rule 8) ───
import { round2 } from '@contrack/domain/subcontracting/snapshot';
import { DomainError, type Result, type UserId, type WorkspaceId, err, okVoid } from '../../../../../shared/domain';
import type { SubcontractId, VariationId } from '../../../shared/ids';
import type { Side } from './claim.entity';

export interface VariationLine {
    desc: string;
    unit: string;
    /** Signed: negative = work removed. */
    qty: number;
    unitPrice: number;
    total: number;
}

export type VariationStatus = 'proposed' | 'accepted' | 'rejected';

export interface VariationProps {
    id: VariationId;
    subcontractId: SubcontractId;
    buyerWorkspaceId: WorkspaceId;
    proposedBy: Side;
    proposedByUser: UserId;
    lines: VariationLine[];
    amount: number;
    reason: string;
    status: VariationStatus;
    decidedBy: UserId | null;
    decidedAt: Date | null;
    createdAt: Date;
}

export class Variation {
    private constructor(private props: VariationProps) {}

    static propose(input: {
        id: VariationId; subcontractId: SubcontractId; buyerWorkspaceId: WorkspaceId; proposedBy: Side; proposedByUser: UserId;
        lines: readonly { desc: string; unit: string; qty: number; unitPrice: number }[]; reason: string; now: Date;
    }): Variation {
        const lines = input.lines.map(l => ({ ...l, total: round2(l.qty * l.unitPrice) }));
        return new Variation({
            id: input.id,
            subcontractId: input.subcontractId,
            buyerWorkspaceId: input.buyerWorkspaceId,
            proposedBy: input.proposedBy,
            proposedByUser: input.proposedByUser,
            lines,
            amount: round2(lines.reduce((s, l) => s + l.total, 0)),
            reason: input.reason,
            status: 'proposed',
            decidedBy: null,
            decidedAt: null,
            createdAt: input.now,
        });
    }

    static rehydrate(props: VariationProps): Variation {
        return new Variation(structuredClone(props));
    }

    toProps(): VariationProps {
        return structuredClone(this.props);
    }

    get id(): VariationId { return this.props.id; }
    get subcontractId(): SubcontractId { return this.props.subcontractId; }
    get proposedBy(): Side { return this.props.proposedBy; }
    get amount(): number { return this.props.amount; }
    get status(): VariationStatus { return this.props.status; }
    get state(): Readonly<VariationProps> { return this.props; }

    respond(side: Side, accept: boolean, by: UserId, now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'proposed') return err(DomainError.conflict(`The variation was already ${this.props.status}`, { status: this.props.status }));
        if (side === this.props.proposedBy) return err(DomainError.forbidden('The other side answers a variation'));
        Object.assign(this.props, { status: accept ? 'accepted' : 'rejected', decidedBy: by, decidedAt: now });
        return okVoid();
    }
}
