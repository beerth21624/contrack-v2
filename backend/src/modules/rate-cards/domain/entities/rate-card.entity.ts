// ─── Rate card: one named daily wage set of a workspace's library (ช่าง ฿/วัน, คนงาน ฿/วัน) ───
// Projects copy the rates when they pick a card (snapshot, done by the frontend), so changing or archiving a card never
// changes a project's BOQ behind its back.
import type { RateCardId, UserId, WorkspaceId } from '../../../../shared/domain';
import type { DailyRate } from '../value-objects/daily-rate.value-object';
import type { RateCardName } from '../value-objects/rate-card-name.value-object';

export interface RateCardProps {
    id: RateCardId;
    workspaceId: WorkspaceId;
    name: RateCardName;
    skilledRate: DailyRate;
    labourerRate: DailyRate;
    /** null = no note. */
    note: string | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
}

export interface CreateRateCardProps {
    id: RateCardId;
    workspaceId: WorkspaceId;
    name: RateCardName;
    skilledRate: DailyRate;
    labourerRate: DailyRate;
    note: string | null;
    createdBy: UserId;
    now: Date;
}

/** The fields an update may change (undefined = keep; note null = clear). */
export interface RateCardChanges {
    name?: RateCardName;
    skilledRate?: DailyRate;
    labourerRate?: DailyRate;
    note?: string | null;
}

const copyDate = (d: Date): Date => new Date(d.getTime());

export class RateCard {
    private constructor(private props: RateCardProps) {}

    static create(input: CreateRateCardProps): RateCard {
        return new RateCard({
            id: input.id,
            workspaceId: input.workspaceId,
            name: input.name,
            skilledRate: input.skilledRate,
            labourerRate: input.labourerRate,
            note: input.note,
            createdBy: input.createdBy,
            createdAt: copyDate(input.now),
            updatedAt: copyDate(input.now),
            archivedAt: null,
        });
    }

    /** From storage (no rules re-applied). */
    static rehydrate(props: RateCardProps): RateCard {
        return new RateCard({
            ...props,
            createdAt: copyDate(props.createdAt),
            updatedAt: copyDate(props.updatedAt),
            archivedAt: props.archivedAt === null ? null : copyDate(props.archivedAt),
        });
    }

    get id(): RateCardId { return this.props.id; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get name(): RateCardName { return this.props.name; }
    get skilledRate(): DailyRate { return this.props.skilledRate; }
    get labourerRate(): DailyRate { return this.props.labourerRate; }
    get note(): string | null { return this.props.note; }
    get createdBy(): UserId { return this.props.createdBy; }
    get createdAt(): Date { return copyDate(this.props.createdAt); }
    get updatedAt(): Date { return copyDate(this.props.updatedAt); }
    get archivedAt(): Date | null { return this.props.archivedAt === null ? null : copyDate(this.props.archivedAt); }
    get isArchived(): boolean { return this.props.archivedAt !== null; }

    /** Applies the changes; false when every given value equals the current one (nothing changed). */
    update(changes: RateCardChanges, now: Date): boolean {
        const next: RateCardProps = { ...this.props };
        let changed = false;
        if (changes.name !== undefined && !changes.name.equals(next.name)) {
            next.name = changes.name;
            changed = true;
        }
        if (changes.skilledRate !== undefined && !changes.skilledRate.equals(next.skilledRate)) {
            next.skilledRate = changes.skilledRate;
            changed = true;
        }
        if (changes.labourerRate !== undefined && !changes.labourerRate.equals(next.labourerRate)) {
            next.labourerRate = changes.labourerRate;
            changed = true;
        }
        if (changes.note !== undefined && changes.note !== next.note) {
            next.note = changes.note;
            changed = true;
        }
        if (!changed) return false;
        this.props = { ...next, updatedAt: copyDate(now) };
        return true;
    }

    /** Soft delete. False when it is already archived. */
    archive(now: Date): boolean {
        if (this.props.archivedAt !== null) return false;
        this.props = { ...this.props, archivedAt: copyDate(now), updatedAt: copyDate(now) };
        return true;
    }

    /** A copy of the state (for persistence). */
    toProps(): RateCardProps {
        return { ...this.props, createdAt: this.createdAt, updatedAt: this.updatedAt, archivedAt: this.archivedAt };
    }
}
